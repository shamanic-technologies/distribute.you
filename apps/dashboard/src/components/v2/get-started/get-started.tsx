"use client";

/**
 * `/get-started`: onboarding v2, signed out, in the dashboard v2 (Keel) language.
 *
 * Explee's order: a website, then real output one step at a time: the company read
 * and its competitors (steps 1 and 2), the ONE offer to sell (3) and the ONE audience
 * to write to (4), picked from proposals, then up to 100 companies of that audience
 * with the right person at each (5) and the first emails (6). The account and the
 * card are asked on ONE screen at the end (the wall).
 *
 * Steps 3 and 4 do not wait for the visitor: the moment the website is known, the
 * offer proposals (read off the site) and the audience proposals (from the brand's
 * ideal customer) are prepared in parallel with steps 1 and 2, so a pick is on screen
 * as soon as the stage reaches it.
 *
 * Every read runs on the ANONYMOUS org (`/api/anon/v1`, a closed allowlist bound to
 * this session's brand), so nothing here spends on anybody else, and nothing is sent.
 * Rules live in `lib/v2/get-started.ts`. The current `/onboarding` is untouched.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import posthog from "posthog-js";
import {
  ApiError,
  checkAudienceCompanyEmail,
  confirmAudienceSegments,
  confirmBrandOffers,
  extractBrandFields,
  getAudienceCompanies,
  getOfferSalesPaths,
  getPublicCatalogueSignedOut,
  previewColdEmail,
  proposeAudienceSegments,
  proposeBrandOffers,
  saveOfferLifetimeRevenue,
  saveOfferSalesPath,
  saveOfferUserFields,
  stateBrandLegRates,
  suggestBrandIcp,
  upsertBrand,
  type AudienceCompanyRow,
  type AudienceSegmentProposal,
  type CompanyRowEmailCheck,
  type OfferProposal,
  type PreviewEmail,
} from "@/lib/api";
import { startAnonSession } from "@/lib/anon-session-client";
import { refusalExits, type RefusalExits } from "@/lib/claimed-signup";
import { websiteInputProblem } from "@/lib/website-input";
import { channelMinimumCents, channelMinimumsFromWire } from "@/lib/channel-minimums";
import { NEW_ORG_CHANNEL_SLUG } from "@/lib/v2/new-org-wizard";
import { EMPTY_LEG_CATALOGUE, legCatalogueFromWire, type LegCatalogue } from "@/lib/legs";
import { SALES_PATH_CHANNEL_SLUGS, offeredFromCatalogue, selectionFromSteps, type SalesPathSelection } from "@/lib/offer-sales-path";
import type { OfferSalesPaths as OfferSalesPathsData, SalesPathLeg } from "@/lib/offer-sales-paths";
import { OfferSalesPath } from "@/components/v2/offer-sales-path";
import { OfferSalesPaths } from "@/components/v2/offer-sales-paths";
import {
  COMPANY_FIELDS,
  COMPETITOR_FIELDS,
  EMAIL_CAP,
  GET_STARTED_SNAPSHOT_KEY,
  GET_STARTED_STEPS,
  GIVE_DRAFT_FIELDS,
  LEVER_DRAFT_FIELDS,
  NEXT_STEPS,
  OFFER_FIELDS,
  SALES_PATH_CHANNEL_LABEL,
  VALUE_FIELDS,
  firstLaunchedPath,
  launchPlan,
  parseDraftedSteps,
  planFloorUsd,
  salesStepsDraftField,
  answerLines,
  leversLLMPrompt,
  parseLifetimeRevenue,
  parseUsdEstimate,
  stepIndex,
  PREWRITTEN_EMAILS,
  canWriteAnother,
  emailPieces,
  employeesLabel,
  highlightKindLabel,
  hostOf,
  offerSourceText,
  parseCompetitors,
  parseGetStartedSnapshot,
  providerLabel,
  settledPhase,
  sizeDots,
  stageDwellMs,
  stageMove,
  valueLines,
  valueText,
  verdictLabel,
  websiteUrl,
  type Competitor,
  type GetStartedAudience,
  type GetStartedEmail,
  type GetStartedOffer,
  type GetStartedSnapshot,
  type GiveDraftKey,
  type LeverDraftKey,
  type GetStartedStepKey,
  type StepPhase,
} from "@/lib/v2/get-started";
import { Initials, Shimmer } from "@/components/v2/ui";
import { OfferIcon } from "@/components/v2/new-org-icons";
import { CountUp, Typewriter, formatElapsed, stagger, useElapsed } from "./motion";
import { BrandLogo } from "@/components/brand-logo";
import { pricingLegFor, recommendedBudgetForPreview } from "./launch";
import { AccountCardWall } from "./account-card-wall";
import { JournalRail, JournalStrip, type JournalData } from "./journal";
import { stepViewName, withStageTransition } from "./view-transition";

type StepState = StepPhase;

/**
 * How long a finished step stays on the stage before it flies into the rail, and how
 * long it is held further when the next one is still being prepared. The companies
 * table is where the visitor reads and clicks, so it is held until the first email is
 * written (it takes a minute and a half) rather than flying away under the pointer.
 */
const STAGE_DWELL_MS: Partial<Record<GetStartedStepKey, number>> = { companies: 6000 };
const STAGE_HOLD_MS: Partial<Record<GetStartedStepKey, number>> = { companies: 150_000 };
const DEFAULT_DWELL_MS = 1600;
const DEFAULT_HOLD_MS = 12_000;

/** What a signed-in visitor reads instead of a walk (same words as the session route). */
const SIGNED_IN_WALK_MESSAGE = "You are signed in. Add this brand from your dashboard instead.";

/**
 * The 100 companies are built page by page, and each company not already cached costs
 * the anonymous org an Apollo credit (~12 cents). So the first page is small (it lands
 * in about 3 s) and the rest is built only as the visitor scrolls to it.
 */
const FIRST_PAGE = 10;
const NEXT_PAGE = 30;

const rowKey = (audienceId: string, index: number) => `${audienceId}:${index}`;

export function GetStarted() {
  const params = useSearchParams();
  const { isSignedIn } = useAuth();

  const [website, setWebsite] = useState(params.get("url") ?? "");
  const [inputError, setInputError] = useState<string | null>(null);
  const [exits, setExits] = useState<RefusalExits | null>(null);
  const [started, setStarted] = useState(false);

  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [overview, setOverview] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [steps, setSteps] = useState<Record<GetStartedStepKey, StepState>>(() => initialSteps());
  const [floorUsd, setFloorUsd] = useState(1);
  // The step and leg catalogue, and each channel's floor, off the public catalogue.
  const [catalogue, setCatalogue] = useState<LegCatalogue>(EMPTY_LEG_CATALOGUE);
  const [floorCents, setFloorCents] = useState<Map<string, number>>(new Map());
  const [recommendedUsd, setRecommendedUsd] = useState<number | null>(null);
  const [wallOpen, setWallOpen] = useState(false);
  const [wallNote, setWallNote] = useState<string | null>(null);

  // Step 3: the offers read off the site; the ONE picked is confirmed on the brand.
  const [offerProposals, setOfferProposals] = useState<OfferProposal[]>([]);
  const [offerMain, setOfferMain] = useState(0);
  const [offer, setOffer] = useState<GetStartedOffer | null>(null);
  const [offerBusy, setOfferBusy] = useState<number | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  // Step 4: who to write to, in words; the ONE picked is created under the offer.
  const icpRef = useRef("");
  const offerSource = useRef<{ lines: string[]; ov: string }>({ lines: [], ov: "" });
  const [audienceProposals, setAudienceProposals] = useState<AudienceSegmentProposal[]>([]);
  const [audience, setAudience] = useState<GetStartedAudience | null>(null);
  const [audienceBusy, setAudienceBusy] = useState<number | null>(null);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const createdAudiences = useRef(new Map<string, GetStartedAudience>());
  // Every proposed audience is created in ONE confirm as soon as the offer is picked:
  // human-service then builds each one's people search (~90 s) while the visitor reads
  // the proposals, so the picked one's companies are ready sooner. The launch sends
  // only the picked one (the others go back to suggested).
  const prebuild = useRef<Promise<void> | null>(null);
  const [building, setBuilding] = useState<Record<string, boolean>>({});
  // Step 5: up to 100 companies per picked audience, page by page.
  const [rows, setRows] = useState<Record<string, AudienceCompanyRow[]>>({});
  const [rowsDone, setRowsDone] = useState<Record<string, boolean>>({});
  const [rowsNote, setRowsNote] = useState<Record<string, string>>({});
  const loading = useRef(new Set<string>());
  const [loadingMore, setLoadingMore] = useState<Record<string, boolean>>({});
  // How many rows the visitor has asked to see, per audience (grows as they scroll).
  const wanted = useRef(new Map<string, number>());
  const rowCount = useRef(new Map<string, number>());
  // Step 6: one email per row, the first ones ahead, the rest on click, capped.
  const [emails, setEmails] = useState<Record<string, PreviewEmail>>({});
  const [writing, setWriting] = useState<Record<string, boolean>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const [selectedRow, setSelectedRow] = useState(0);
  // The row's person, found and verified live (the first 10 rows only).
  const [checks, setChecks] = useState<Record<string, CompanyRowEmailCheck>>({});
  const checkQueue = useRef<Promise<void>>(Promise.resolve());
  const checkAsked = useRef(new Set<string>());

  // Steps 5 to 8: questions about the offer, each prefilled from ONE site read made as
  // soon as the offer is picked. The first emails wait for the answers: they are
  // written from them.
  const [valueInput, setValueInput] = useState("");
  // The sales path: the steps their sales go through (drafted off the site), the legs
  // between them, both saved on the offer; then the paths features-service ranks.
  const [selection, setSelection] = useState<SalesPathSelection>({ steps: new Set(), legs: new Set() });
  const selectionTouched = useRef(false);
  const draftedSteps = useRef<string[] | null>(null);
  const [salesPaths, setSalesPaths] = useState<OfferSalesPathsData | null>(null);
  const [pathsState, setPathsState] = useState<"idle" | "loading" | "failed">("idle");
  const [levers, setLevers] = useState<Record<LeverDraftKey, string>>(() => emptyRecord(LEVER_DRAFT_FIELDS));
  const [gives, setGives] = useState<Record<GiveDraftKey, string>>(() => emptyRecord(GIVE_DRAFT_FIELDS));
  const [drafted, setDrafted] = useState<"no" | "running" | "done" | "failed">("no");
  const [answered, setAnswered] = useState(false);
  const answeredRef = useRef(false);
  answeredRef.current = answered;
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  // The first companies' emails, held until the answers exist.
  const pendingPrewrite = useRef<{ aud: GetStartedAudience; rows: AudienceCompanyRow[] } | null>(null);

  const [restoredBudget, setRestoredBudget] = useState<number | null>(null);
  const [restoredEmail, setRestoredEmail] = useState<GetStartedEmail | null>(null);
  // The stage shows ONE step: the one the walk is on (`stageIdx`), or one the person
  // opened from the rail or the stepper (`focus`, cleared when the walk moves on).
  const [stageIdx, setStageIdx] = useState(0);
  const [focus, setFocus] = useState<GetStartedStepKey | null>(null);
  const audienceRef = useRef<GetStartedAudience | null>(null);
  audienceRef.current = audience;
  const snapRef = useRef<GetStartedSnapshot | null>(null);

  const ran = useRef(false);

  // Back from the Google sign-up round trip (or a reload): the preview is restored
  // from this tab's snapshot and the wall opens at the step it was on.
  useEffect(() => {
    const snap = parseGetStartedSnapshot(sessionStorage.getItem(GET_STARTED_SNAPSHOT_KEY));
    if (!snap) return;
    if (params.get("resume") !== "1" && !isSignedIn) return;
    applySnapshot(snap);
    setWallOpen(params.get("resume") === "1");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The steps, the legs and each channel's floor, off the public catalogue: no session
  // needed. Asked again on a failure (a cold gateway), then stated with a retry: the
  // sales path screens cannot be drawn without it.
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  async function loadCatalogue(attempts = 3) {
    setCatalogueFailed(false);
    for (let i = 0; i < attempts; i += 1) {
      try {
        const cat = await getPublicCatalogueSignedOut();
        const mins = channelMinimumsFromWire(cat.channels);
        const cents = channelMinimumCents(mins, NEW_ORG_CHANNEL_SLUG);
        if (cents != null) setFloorUsd(cents / 100);
        const floors = new Map<string, number>();
        for (const slug of SALES_PATH_CHANNEL_SLUGS) {
          const c = channelMinimumCents(mins, slug);
          if (c != null) floors.set(slug, c);
        }
        setFloorCents(floors);
        setCatalogue(legCatalogueFromWire(cat));
        return;
      } catch (e) {
        console.error(`[get-started] catalogue read failed (attempt ${i + 1}):`, e);
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      }
    }
    setCatalogueFailed(true);
  }
  useEffect(() => {
    void loadCatalogue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offered = useMemo(() => offeredFromCatalogue(catalogue, SALES_PATH_CHANNEL_SLUGS), [catalogue]);

  // The drafted steps tick the screen once both the draft and the catalogue are in,
  // unless the visitor already ticked something.
  useEffect(() => {
    if (selectionTouched.current || !draftedSteps.current || offered.legs.length === 0) return;
    const keys = parseDraftedSteps(draftedSteps.current, offered.steps);
    if (keys.length > 0) setSelection(selectionFromSteps(keys, offered.legs));
  }, [offered, drafted]);

  // A website carried from a link starts the walk at once, like Explee's hero.
  useEffect(() => {
    if (ran.current || started || isSignedIn) return;
    const carried = params.get("url");
    if (carried && !websiteInputProblem(carried) && params.get("resume") !== "1") void start(carried);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySnapshot(s: GetStartedSnapshot) {
    snapRef.current = s;
    setWebsite(s.website);
    setBrandId(s.brandId);
    setBrandName(s.brandName);
    setDomain(s.domain);
    setOverview(s.overview);
    setFacts(s.facts);
    setCompetitors(s.competitors);
    setOffer(s.offer);
    setAudience(s.audience);
    setRestoredBudget(s.budgetUsd);
    if (s.email) setRestoredEmail(s.email);
    if (s.salesPath) {
      selectionTouched.current = true;
      setSelection({ steps: new Set(s.salesPath.steps), legs: new Set(s.salesPath.legs) });
    }
    if (s.lifetimeRevenueUsd != null) setValueInput(String(s.lifetimeRevenueUsd));
    setAnswered(!!s.answered);
    setStarted(true);
    ran.current = true;
    setStageIdx(s.audience ? stepIndex("audience") : s.offer ? stepIndex("offer") : 0);
    setSteps({
      company: "done",
      competitors: s.competitors.length ? "done" : "failed",
      offer: s.offer ? "done" : "failed",
      audience: s.audience ? "done" : "failed",
      value: s.lifetimeRevenueUsd != null ? "done" : "failed",
      salesSteps: s.salesPath ? "done" : "failed",
      legs: s.salesPath ? "done" : "failed",
      paths: s.pathsDone ? "done" : "failed",
      levers: s.answered ? "done" : "failed",
      gives: s.answered ? "done" : "failed",
      companies: "failed",
      email: s.email ? "done" : "failed",
    });
  }

  function saveSnapshot(patch: Partial<GetStartedSnapshot>) {
    const base = snapRef.current;
    if (!base) return;
    const next = { ...base, ...patch };
    snapRef.current = next;
    try {
      sessionStorage.setItem(GET_STARTED_SNAPSHOT_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("[get-started] snapshot write failed:", e);
    }
  }

  const setStep = (k: GetStartedStepKey, v: StepState) => setSteps((cur) => ({ ...cur, [k]: v }));

  // ── Steps 3 and 4, prepared in the background ─────────────────────────────

  /** The offers the site describes; the brand-service split runs off step 1's read. */
  async function prepareOffers(id: string, lines: string[], ov: string) {
    const text = offerSourceText(lines, ov);
    setStep("offer", "running");
    if (!text) {
      setStep("offer", "failed");
      return;
    }
    try {
      const { offers, mainOfferIndex } = await proposeBrandOffers(id, text);
      setOfferProposals(offers);
      setOfferMain(mainOfferIndex >= 0 && mainOfferIndex < offers.length ? mainOfferIndex : 0);
      setStep("offer", offers.length ? "choose" : "failed");
    } catch (e) {
      console.error("[get-started] offer proposals failed:", e);
      setStep("offer", "failed");
    }
  }

  /** Who to write to: the brand's ideal customer, split into at most 6 audiences in words. */
  async function prepareAudiences(id: string) {
    setStep("audience", "running");
    try {
      const { icp } = await suggestBrandIcp(id);
      icpRef.current = icp;
      const { segments } = await proposeAudienceSegments(id, icp);
      setAudienceProposals(segments.slice(0, 6));
      setStep("audience", segments.length ? "choose" : "failed");
    } catch (e) {
      console.error("[get-started] audience proposals failed:", e);
      setStep("audience", "failed");
    }
  }

  /** Step 3: confirm the ONE offer picked, so the brand ends with exactly that offer. */
  async function pickOffer(i: number) {
    if (!brandId || offer || offerBusy != null) return;
    const picked = offerProposals[i];
    if (!picked) return;
    setOfferBusy(i);
    setOfferError(null);
    try {
      const { chosenOfferId } = await confirmBrandOffers(brandId, [picked], 0);
      const next = { offerId: chosenOfferId, name: picked.name, description: picked.description };
      withStageTransition(() => {
        setOffer(next);
        setStep("offer", "done");
        setFocus(null);
      });
      saveSnapshot({ offer: next });
      posthog.capture("get_started_offer_picked", { offers: offerProposals.length });
      // What the recommended budget buys, priced on this offer. Best effort: the wall
      // opens with the floor stated when no price is held.
      recommendedBudgetForPreview(brandId, chosenOfferId, floorUsd)
        .then(setRecommendedUsd)
        .catch((e) => console.error("[get-started] price read failed:", e));
      void draftAnswers(brandId, chosenOfferId);
    } catch (e) {
      console.error("[get-started] offer confirm failed:", e);
      setOfferError("We could not save this offer. Try again.");
    } finally {
      setOfferBusy(null);
    }
  }

  /**
   * Steps 6 to 8 prefilled from ONE site read on the picked offer (suggest mode, so a
   * value the owner already confirmed overlays the draft). A failed read leaves the
   * fields blank for the visitor to fill; it does not stop the walk.
   */
  async function draftAnswers(id: string, offerId: string) {
    setDrafted("running");
    try {
      const stepsField = offered.steps.length
        ? [salesStepsDraftField(offered.steps.map((k) => ({ key: k, label: catalogue.steps.get(k)?.label ?? k })))]
        : [];
      const fields = [...VALUE_FIELDS, ...stepsField, ...LEVER_DRAFT_FIELDS, ...GIVE_DRAFT_FIELDS].map((f) => ({ key: f.key, description: f.description }));
      const r = await extractBrandFields([id], fields, { mode: "suggest", urlStrategy: "landing", offerId });
      const said = r.fields.salesSteps?.value;
      draftedSteps.current = Array.isArray(said) ? said.map(String) : typeof said === "string" ? said.split("\n") : [];
      const usd = parseUsdEstimate(r.fields.clientLifetimeRevenueUsd?.value);
      setValueInput((cur) => cur || (usd != null ? String(usd) : ""));
      setLevers((cur) => fillBlank(cur, LEVER_DRAFT_FIELDS, (k) => valueLines(r.fields[k]?.value).join("\n")));
      setGives((cur) => fillBlank(cur, GIVE_DRAFT_FIELDS, (k) => valueLines(r.fields[k]?.value).join("\n")));
      setDrafted("done");
    } catch (e) {
      console.error("[get-started] answer drafts failed:", e);
      setDrafted("failed");
    }
  }

  // A question step opens once the one before it is answered; while its draft is still
  // being read it shows as running rather than as an empty form.
  useEffect(() => {
    const ready = drafted === "done" || drafted === "failed";
    setSteps((cur) => {
      const next = { ...cur };
      const open = (k: GetStartedStepKey, prevDone: boolean, needsDraft: boolean) => {
        if (next[k] === "done" || !prevDone) return;
        next[k] = needsDraft && !ready ? "running" : "choose";
      };
      open("value", cur.audience === "done", true);
      open("salesSteps", cur.value === "done", true);
      open("legs", cur.salesSteps === "done", false);
      if (next.paths !== "done" && cur.legs === "done") next.paths = salesPaths ? "choose" : pathsState === "failed" ? "failed" : "running";
      open("levers", cur.paths === "done", true);
      open("gives", cur.levers === "done", true);
      return JSON.stringify(next) === JSON.stringify(cur) ? cur : next;
    });
  }, [drafted, steps.audience, steps.value, steps.salesSteps, steps.legs, steps.paths, steps.levers, salesPaths, pathsState]);

  /** Saves the ticked steps and legs on the offer (brand-service replaces the whole selection). */
  async function saveSelection(next: SalesPathSelection, done: GetStartedStepKey) {
    if (!brandId || !offer || answerBusy) return;
    setAnswerBusy(true);
    setAnswerError(null);
    try {
      await saveOfferSalesPath(brandId, offer.offerId, [...next.steps], [...next.legs]);
      withStageTransition(() => {
        setStep(done, "done");
        setFocus(null);
      });
      saveSnapshot({ salesPath: { steps: [...next.steps], legs: [...next.legs] } });
      posthog.capture(done === "salesSteps" ? "get_started_steps_ticked" : "get_started_legs_ticked", {
        steps: next.steps.size,
        legs: next.legs.size,
      });
    } catch (e) {
      console.error("[get-started] sales path save failed:", e);
      setAnswerError("We could not save this. Try again.");
    } finally {
      setAnswerBusy(false);
    }
  }

  /** The paths the saved legs make, ranked by features-service on expected ROI. */
  async function loadPaths() {
    if (!brandId || !offer) return;
    setPathsState("loading");
    try {
      const data = await getOfferSalesPaths(brandId, offer.offerId);
      setSalesPaths(data);
      setPathsState("idle");
      const first = firstLaunchedPath(data.paths);
      const leg = pricingLegFor(first?.entryLegKey);
      if (leg)
        recommendedBudgetForPreview(brandId, offer.offerId, floorUsd, leg)
          .then(setRecommendedUsd)
          .catch((e) => console.error("[get-started] price read failed:", e));
    } catch (e) {
      console.error("[get-started] sales paths read failed:", e);
      setPathsState("failed");
    }
  }

  // The paths are read once the legs are saved (and again on a restored walk).
  useEffect(() => {
    if (brandId && offer && steps.legs === "done" && !salesPaths && pathsState === "idle") void loadPaths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, offer?.offerId, steps.legs, salesPaths, pathsState]);

  /** A rate overwritten from a path's detail: the brand's own rate for the leg, then the paths re-ranked. */
  async function stateLegRate(leg: SalesPathLeg, ratePct: number | null) {
    if (!brandId || !leg.fromStep) return;
    await stateBrandLegRates(brandId, [{ fromStep: leg.fromStep.label, toStep: leg.toStep.label, ratePct }]);
    posthog.capture("get_started_rate_stated", { leg: leg.legKey, cleared: ratePct == null });
    await loadPaths();
  }

  /** Step: the ranked paths seen; the one launched first is where the money goes. */
  function confirmPaths() {
    withStageTransition(() => {
      setStep("paths", "done");
      setFocus(null);
    });
    saveSnapshot({ pathsDone: true });
    posthog.capture("get_started_paths_seen", { paths: salesPaths?.paths.length ?? 0 });
  }

  /** Step 6: what one client is worth, saved on the offer. */
  async function confirmValue() {
    if (!brandId || !offer || answerBusy) return;
    const parsed = parseLifetimeRevenue(valueInput);
    if ("problem" in parsed) {
      setAnswerError(parsed.problem);
      return;
    }
    setAnswerBusy(true);
    setAnswerError(null);
    try {
      await saveOfferLifetimeRevenue(brandId, offer.offerId, parsed.usd);
      withStageTransition(() => {
        setStep("value", "done");
        setFocus(null);
      });
      saveSnapshot({ lifetimeRevenueUsd: parsed.usd });
    } catch (e) {
      console.error("[get-started] lifetime revenue save failed:", e);
      setAnswerError("We could not save this. Try again.");
    } finally {
      setAnswerBusy(false);
    }
  }

  /** Step 7: the six offer points, saved on the offer. */
  async function confirmLevers() {
    if (!brandId || !offer || answerBusy) return;
    setAnswerBusy(true);
    setAnswerError(null);
    try {
      const fields: Partial<Record<LeverDraftKey, string | string[]>> = {};
      for (const f of LEVER_DRAFT_FIELDS) {
        const lines = answerLines(levers[f.key]);
        if (lines.length === 0) continue;
        fields[f.key] = f.key === "socialProof" ? lines : lines.join("\n");
      }
      if (Object.keys(fields).length > 0) await saveOfferUserFields(brandId, offer.offerId, fields);
      withStageTransition(() => {
        setStep("levers", "done");
        setFocus(null);
      });
    } catch (e) {
      console.error("[get-started] offer points save failed:", e);
      setAnswerError("We could not save your offer. Try again.");
    } finally {
      setAnswerBusy(false);
    }
  }

  /** Step 8: what is given away and never promised, saved; then the first emails are written. */
  async function confirmGives() {
    if (!brandId || !offer || answerBusy) return;
    setAnswerBusy(true);
    setAnswerError(null);
    try {
      await saveOfferUserFields(brandId, offer.offerId, {
        giveForFree: answerLines(gives.giveForFree),
        neverGive: answerLines(gives.neverGive),
      });
      withStageTransition(() => {
        setStep("gives", "done");
        setAnswered(true);
        setFocus(null);
      });
      answeredRef.current = true;
      saveSnapshot({ answered: true });
      posthog.capture("get_started_answers_done");
      const held = pendingPrewrite.current;
      if (held && audienceRef.current?.audienceId === held.aud.audienceId) {
        pendingPrewrite.current = null;
        prewrite(held.aud, held.rows);
      }
    } catch (e) {
      console.error("[get-started] give lists save failed:", e);
      setAnswerError("We could not save these lists. Try again.");
    } finally {
      setAnswerBusy(false);
    }
  }

  useEffect(() => {
    if (!brandId || !offer || audienceProposals.length === 0 || prebuild.current) return;
    const segs = audienceProposals;
    const offerId = offer.offerId;
    prebuild.current = confirmAudienceSegments(brandId, offerId, icpRef.current || segs[0].description, segs)
      .then(({ audiences }) => {
        segs.forEach((seg, i) => {
          const made = audiences.find((a) => a.name === seg.name) ?? audiences[i];
          if (made) createdAudiences.current.set(seg.name, { audienceId: made.id, name: seg.name, description: seg.description });
        });
      })
      .catch((e) => console.error("[get-started] audience prebuild failed:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, offer?.offerId, audienceProposals]);

  /** Step 4: the ONE audience picked (created with the others above), then its companies load. */
  async function pickAudience(i: number) {
    if (!brandId || !offer || audienceBusy != null) return;
    const seg = audienceProposals[i];
    if (!seg) return;
    if (prebuild.current && !createdAudiences.current.has(seg.name)) {
      setAudienceBusy(i);
      await prebuild.current;
      setAudienceBusy(null);
    }
    const known = createdAudiences.current.get(seg.name);
    if (known) {
      chooseAudience(known);
      return;
    }
    setAudienceBusy(i);
    setAudienceError(null);
    try {
      const { audiences } = await confirmAudienceSegments(brandId, offer.offerId, icpRef.current || seg.description, [seg]);
      const made = audiences[0];
      if (!made) throw new Error("no audience created");
      const next = { audienceId: made.id, name: seg.name, description: seg.description };
      createdAudiences.current.set(seg.name, next);
      chooseAudience(next);
      posthog.capture("get_started_audience_picked", { audiences: audienceProposals.length });
    } catch (e) {
      console.error("[get-started] audience confirm failed:", e);
      setAudienceError("We could not set up this audience. Try again.");
    } finally {
      setAudienceBusy(null);
    }
  }

  function chooseAudience(next: GetStartedAudience) {
    const loaded = rows[next.audienceId]?.length ?? 0;
    withStageTransition(() => {
      setAudience(next);
      setSelectedRow(0);
      setFocus(null);
      setSteps((cur) => ({
        ...cur,
        audience: "done",
        companies: loaded ? "done" : "running",
        email: firstEmailFor(next.audienceId) ? "done" : loaded ? cur.email : "waiting",
      }));
    });
    saveSnapshot({ audience: next });
  }

  const writtenKeys = useRef(new Set<string>());
  const firstEmailFor = (audienceId: string) => [...writtenKeys.current].some((k) => k.startsWith(`${audienceId}:`));

  // ── Step 5: the companies, page by page ──────────────────────────────────

  useEffect(() => {
    if (audience) wantRows(audience, FIRST_PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience?.audienceId]);

  /** Asks for at least `n` rows of an audience; the loader builds up to that and stops. */
  function wantRows(aud: GetStartedAudience, n: number) {
    const id = aud.audienceId;
    wanted.current.set(id, Math.max(n, wanted.current.get(id) ?? 0));
    if (rowsDone[id] || loading.current.has(id)) return;
    void loadCompanies(aud);
  }

  async function loadCompanies(aud: GetStartedAudience) {
    const id = aud.audienceId;
    loading.current.add(id);
    setLoadingMore((cur) => ({ ...cur, [id]: true }));
    let offset = rowCount.current.get(id) ?? 0;
    let waits = 0;
    let first = offset === 0;
    try {
      while (offset < (wanted.current.get(id) ?? FIRST_PAGE)) {
        const limit = Math.min(offset === 0 ? FIRST_PAGE : NEXT_PAGE, 100 - offset);
        const page = await getAudienceCompanies(id, { offset, limit });
        // human-service is still building this audience's people search (~90 s after
        // it was created): asked again every 3 s, for up to 4 minutes, with the wait shown.
        if (page.status === "unavailable" && page.reason === "not_built_yet" && waits < 80) {
          waits += 1;
          setBuilding((cur) => (cur[id] ? cur : { ...cur, [id]: true }));
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        setBuilding((cur) => (cur[id] ? { ...cur, [id]: false } : cur));
        if (page.status !== "ready") {
          setRowsNote((cur) => ({ ...cur, [id]: companiesNote(page.reason) }));
          setRowsDone((cur) => ({ ...cur, [id]: true }));
          if (audienceRef.current?.audienceId === id && first) {
            setStep("companies", "failed");
            setStep("email", "failed");
          }
          return;
        }
        const got = page.rows;
        rowCount.current.set(id, offset + got.length);
        setRows((cur) => ({ ...cur, [id]: mergeRows(cur[id] ?? [], got) }));
        if (first && got.length) {
          first = false;
          if (audienceRef.current?.audienceId === id) {
            setStep("companies", "done");
            // The emails are written from the answers: held until they exist.
            if (answeredRef.current) prewrite(aud, got);
            else pendingPrewrite.current = { aud, rows: got };
          }
        }
        if (page.done || page.nextOffset == null || got.length === 0) {
          setRowsDone((cur) => ({ ...cur, [id]: true }));
          break;
        }
        offset = page.nextOffset;
      }
      if (audienceRef.current?.audienceId === id && first && offset === 0) {
        setStep("companies", "failed");
        setStep("email", "failed");
      }
    } catch (e) {
      console.error("[get-started] companies read failed:", e);
      const outOfCredit = e instanceof ApiError && (e.status === 402 || (e.status === 502 && e.body?.upstreamStatus === 402));
      setRowsNote((cur) => ({
        ...cur,
        [id]: outOfCredit ? "Your free preview credit is used up, so we stopped finding companies." : "We could not find more companies just now.",
      }));
      setRowsDone((cur) => ({ ...cur, [id]: true }));
      if (audienceRef.current?.audienceId === id && first) {
        setStep("companies", "failed");
        setStep("email", "failed");
      }
    } finally {
      loading.current.delete(id);
      setLoadingMore((cur) => ({ ...cur, [id]: false }));
    }
  }

  // ── Step 6: the emails ───────────────────────────────────────────────────

  /** The first rows' emails, written ahead: the first alone (it reads the site), then the next ones together. */
  function prewrite(aud: GetStartedAudience, first: AudienceCompanyRow[]) {
    const writable = first.filter(rowWritable).slice(0, PREWRITTEN_EMAILS);
    if (writable.length === 0) {
      setStep("email", "failed");
      return;
    }
    setStep("email", "running");
    void (async () => {
      await writeEmail(aud, writable[0]);
      await Promise.all(writable.slice(1).map((r) => writeEmail(aud, r)));
    })();
    for (const r of writable) queueCheck(aud.audienceId, r.index);
  }

  /** Writes one row's email (content-generation, billed to this anonymous org). The same person returns the stored email. */
  async function writeEmail(aud: GetStartedAudience, row: AudienceCompanyRow): Promise<void> {
    const key = rowKey(aud.audienceId, row.index);
    // An email is written from the offer points and the give lists: none before them.
    if (!answeredRef.current) return;
    if (requested.current.has(key) || !brandId) return;
    if (!canWriteAnother(requested.current.size)) return;
    requested.current.add(key);
    setWriting((cur) => ({ ...cur, [key]: true }));
    setEmailErrors((cur) => {
      const next = { ...cur };
      delete next[key];
      return next;
    });
    try {
      const mail = await writeWithRetry(() =>
        previewColdEmail({
          brandId,
          recipient: {
            firstName: row.person.firstName!,
            lastName: row.person.lastNameObfuscated || row.person.firstName!.slice(0, 1),
            title: row.person.title!,
            companyName: row.company.name,
            ...(row.company.domain ? { companyDomain: row.company.domain } : {}),
          },
          audience: aud.name,
          offerId: offer?.offerId ?? snapRef.current?.offer?.offerId ?? null,
        }),
      );
      writtenKeys.current.add(key);
      setEmails((cur) => ({ ...cur, [key]: mail }));
      if (audienceRef.current?.audienceId === aud.audienceId) setStep("email", "done");
      if (!snapRef.current?.email) saveSnapshot({ email: { subject: mail.subject, bodyText: mail.bodyText, recipient: mail.recipient } });
    } catch (e) {
      console.error("[get-started] email preview failed:", e);
      // A failed write does not count against the cap.
      requested.current.delete(key);
      setEmailErrors((cur) => ({
        ...cur,
        [key]:
          e instanceof ApiError && e.status === 402
            ? "Your free preview credit is used up. This email will be written once your account is set up."
            : "We could not write this email just now. Click the row to try again.",
      }));
      if (audienceRef.current?.audienceId === aud.audienceId && !firstEmailFor(aud.audienceId)) setStep("email", "failed");
    } finally {
      setWriting((cur) => ({ ...cur, [key]: false }));
    }
  }

  /** One row's person, found and verified live, one row at a time (a billed reveal, ~6s). */
  function queueCheck(audienceId: string, index: number) {
    const key = rowKey(audienceId, index);
    if (index >= 10 || checkAsked.current.has(key)) return;
    checkAsked.current.add(key);
    setChecks((cur) => ({ ...cur, [key]: { index, status: "checking", finder: null, verifier: null, verdict: null, deliverable: null, maskedEmail: null, checkedAt: null } }));
    checkQueue.current = checkQueue.current.then(async () => {
      try {
        const got = await checkAudienceCompanyEmail(audienceId, index);
        setChecks((cur) => ({ ...cur, [key]: got }));
      } catch (e) {
        console.error("[get-started] email check failed:", e);
        setChecks((cur) => {
          const next = { ...cur };
          delete next[key];
          return next;
        });
      }
    });
  }

  /** A row clicked: its email on the stage, written now when it is not yet (up to the cap). */
  function openRow(index: number) {
    if (!audience) return;
    const row = (rows[audience.audienceId] ?? []).find((r) => r.index === index);
    if (!row) return;
    const key = rowKey(audience.audienceId, index);
    const have = !!emails[key] || requested.current.has(key);
    if (!have && rowWritable(row) && !canWriteAnother(requested.current.size)) {
      setWallNote(`You have read ${EMAIL_CAP} emails. Start outreach to write one for every company.`);
      setWallOpen(true);
      return;
    }
    withStageTransition(() => {
      setSelectedRow(index);
      setStageIdx(stepIndex("email"));
      setFocus(null);
    });
    if (!have && rowWritable(row)) {
      void writeEmail(audience, row);
      queueCheck(audience.audienceId, index);
    }
  }

  // ── The stage ────────────────────────────────────────────────────────────

  // The stage walks forward on its own: a finished step is held for a moment (longer
  // while the next one is still being prepared), then flies into the rail as the next
  // one takes the stage.
  const phases = GET_STARTED_STEPS.map((s) => steps[s.key]);
  const phaseKey = phases.join(",");
  const settledAt = useRef<{ idx: number; at: number } | null>(null);
  useEffect(() => {
    const mv = stageMove(phases, stageIdx);
    if (!mv) return;
    const here = GET_STARTED_STEPS[stageIdx].key;
    if (!settledAt.current || settledAt.current.idx !== stageIdx) settledAt.current = { idx: stageIdx, at: Date.now() };
    const target = mv.dwell ? stageDwellMs(phases[mv.to], STAGE_DWELL_MS[here] ?? DEFAULT_DWELL_MS, STAGE_HOLD_MS[here] ?? DEFAULT_HOLD_MS) : 0;
    const wait = Math.max(0, target - (Date.now() - settledAt.current.at));
    const t = setTimeout(
      () =>
        withStageTransition(() => {
          setStageIdx(mv.to);
          setFocus(null);
        }),
      wait,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey, stageIdx]);

  /** Opens a finished step on the stage; the walk takes over again when it moves on. */
  function openStep(key: GetStartedStepKey) {
    const idx = GET_STARTED_STEPS.findIndex((s) => s.key === key);
    withStageTransition(() => setFocus(idx === stageIdx ? null : key));
  }

  async function start(raw: string) {
    if (ran.current) return;
    const problem = websiteInputProblem(raw);
    if (problem || !raw.trim()) {
      setInputError(problem ?? "Enter your website.");
      return;
    }
    // A signed-in visitor would build this walk inside the org they are signed in
    // to: the Clerk session outranks the anonymous one on every call, so the brand
    // lands in their active org (a customer's, for staff). Adding a brand from an
    // account is the dashboard's job. The session route refuses it too.
    if (isSignedIn) {
      setInputError(SIGNED_IN_WALK_MESSAGE);
      setExits({ signIn: null, signUp: { href: "/v2", label: "Open your dashboard" } });
      return;
    }
    ran.current = true;
    setInputError(null);
    setExits(null);
    setStarted(true);
    setStep("company", "running");
    posthog.capture("get_started_website_submitted");

    const url = websiteUrl(raw);
    const session = await startAnonSession(url);
    if (!session.started) {
      ran.current = false;
      setStarted(false);
      setSteps(initialSteps());
      setInputError(session.message);
      setExits(refusalExits({ reason: session.reason, domain: hostOf(url), brandUrl: url }));
      return;
    }

    let id: string;
    let createdName: string | null = null;
    try {
      const brand = await upsertBrand(url);
      id = brand.brandId;
      setBrandId(id);
      createdName = brand.name;
      setBrandName(brand.name);
      setDomain(brand.domain ?? hostOf(url));
    } catch (e) {
      console.error("[get-started] brand create failed:", e);
      ran.current = false;
      setStarted(false);
      setSteps(initialSteps());
      setInputError("We could not read this website. Check it and try again.");
      return;
    }

    const host = hostOf(url);
    snapRef.current = {
      version: 2,
      website: url,
      brandId: id,
      brandName: createdName,
      domain: host,
      overview: "",
      facts: [],
      competitors: [],
      offer: null,
      audience: null,
      budgetUsd: null,
      email: null,
    };
    saveSnapshot({});
    setSteps((cur) => ({ ...cur, competitors: "running", offer: "running", audience: "running" }));

    // ONE extraction reads steps 1, 2 and the offer lines; then the offer split and the
    // ideal customer + audience split run in parallel. The anonymous org holds $30,
    // enough for both reads' holds at once.
    const siteRead = (async () => {
      try {
        const r = await extractBrandFields([id], [...COMPANY_FIELDS, ...COMPETITOR_FIELDS, ...OFFER_FIELDS], {
          mode: "suggest",
          urlStrategy: "landing",
        });
        const ov = valueText(r.fields.companyOverview?.value);
        const fs = valueLines(r.fields.companyFacts?.value).slice(0, 4);
        const list = parseCompetitors(r.fields.competitorsWithDomains?.value, host);
        const lines = valueLines(r.fields.offerLines?.value);
        setOverview(ov);
        setFacts(fs);
        setCompetitors(list);
        setStep("company", ov || fs.length ? "done" : "failed");
        setStep("competitors", list.length ? "done" : "failed");
        saveSnapshot({ overview: ov, facts: fs, competitors: list });
        offerSource.current = { lines, ov };
      } catch (e) {
        console.error("[get-started] company read failed:", e);
        setStep("company", "failed");
        setStep("competitors", "failed");
      }
    })();
    await siteRead;
    // The ideal customer is drafted from what the read stored, so it waits for it (an
    // empty profile is refused); the offer split and the audience split then run together.
    await Promise.all([prepareOffers(id, offerSource.current.lines, offerSource.current.ov), prepareAudiences(id)]);
    posthog.capture("get_started_preview_ready");
  }

  const plan = useMemo(() => launchPlan(salesPaths?.paths ?? []), [salesPaths]);
  const firstPath = useMemo(() => firstLaunchedPath(salesPaths?.paths ?? []), [salesPaths]);
  const canLaunch = started && !!brandId && !!offer && !!audience && steps.paths === "done" && plan.length > 0 && answered;
  const current = useMemo(() => GET_STARTED_STEPS.findIndex((s) => steps[s.key] === "running"), [steps]);

  if (!started) {
    return (
      <Hero
        website={website}
        onWebsite={(v) => {
          setWebsite(v);
          setInputError(null);
          setExits(null);
        }}
        onSubmit={() => void start(website)}
        error={inputError}
        exits={exits}
      />
    );
  }

  const stagedKey: GetStartedStepKey = focus ?? GET_STARTED_STEPS[stageIdx].key;
  const audRows = audience ? rows[audience.audienceId] ?? [] : [];
  const writtenCount = Object.keys(emails).length;
  const selectedKey = audience ? rowKey(audience.audienceId, selectedRow) : null;
  const PICK_LINES: Partial<Record<GetStartedStepKey, string>> = {
    offer: "Pick the offer to sell first.",
    audience: "Pick who to write to first.",
    value: "Tell us what one client is worth.",
    salesSteps: "Tick the steps your sales go through today.",
    legs: "Tick how your leads move from one step to the next.",
    paths: "See where we put your money first.",
    levers: "Check your offer, then continue.",
    gives: "Say what you give away, then we write the emails.",
  };
  const pick = steps[stagedKey] === "choose" ? PICK_LINES[stagedKey] ?? null : null;
  const journal: JournalData = {
    steps,
    staged: stagedKey,
    name: brandName,
    domain,
    overview,
    competitors,
    offer,
    audience,
    audienceProposals,
    audienceBusy,
    rows: audRows,
    written: writtenCount,
    stepCount: selection.steps.size,
    legCount: selection.legs.size,
    firstPathLabel: firstPath ? firstPath.steps.map((x) => x.label).join(" → ") : null,
    lifetimeRevenue: valueInput,
    leverCount: LEVER_DRAFT_FIELDS.filter((f) => answerLines(levers[f.key]).length > 0).length,
    giveCount: answerLines(gives.giveForFree).length,
    onPickAudience: (i) => void pickAudience(i),
    onFocus: openStep,
  };

  function stageFor(key: GetStartedStepKey): React.ReactNode {
    if (key === "company") return <CompanyCard state={steps.company} name={brandName} domain={domain} website={website} overview={overview} facts={facts} />;
    if (key === "competitors") return <CompetitorsCard state={steps.competitors} competitors={competitors} />;
    if (key === "offer")
      return (
        <OfferStage
          state={steps.offer}
          proposals={offerProposals}
          main={offerMain}
          picked={offer}
          busy={offerBusy}
          error={offerError}
          onPick={(i) => void pickOffer(i)}
          onRetry={() => brandId && void prepareOffers(brandId, offerSource.current.lines, offerSource.current.ov)}
        />
      );
    if (key === "audience")
      return (
        <AudienceStage
          state={steps.audience}
          proposals={audienceProposals}
          picked={audience}
          busy={audienceBusy}
          error={audienceError}
          waitingForOffer={!offer}
          onPick={(i) => void pickAudience(i)}
          onRetry={() => brandId && void prepareAudiences(brandId)}
        />
      );
    if (key === "salesSteps" || key === "legs")
      return (
        <SalesPathStage
          part={key === "salesSteps" ? "steps" : "legs"}
          state={steps[key]}
          catalogue={catalogue}
          catalogueFailed={catalogueFailed}
          onRetryCatalogue={() => void loadCatalogue()}
          selection={selection}
          drafted={key === "salesSteps" && !!draftedSteps.current?.length}
          onChange={(next) => {
            selectionTouched.current = true;
            setSelection(next);
            setAnswerError(null);
          }}
          busy={answerBusy}
          error={steps[key] === "choose" ? answerError : null}
          onContinue={() => void saveSelection(selection, key)}
        />
      );
    if (key === "paths")
      return (
        <PathsStage
          state={steps.paths}
          data={salesPaths}
          loading={pathsState === "loading"}
          failed={pathsState === "failed"}
          highlightPathKey={firstPath?.pathKey ?? null}
          canContinue={plan.length > 0}
          onRetry={() => void loadPaths()}
          onStateRate={stateLegRate}
          onContinue={confirmPaths}
        />
      );
    if (key === "value")
      return (
        <ValueStage
          state={steps.value}
          value={valueInput}
          onValue={(v) => {
            setValueInput(v);
            setAnswerError(null);
          }}
          drafted={drafted === "done" && !!valueInput}
          busy={answerBusy}
          error={steps.value === "choose" ? answerError : null}
          onContinue={() => void confirmValue()}
        />
      );
    if (key === "levers")
      return (
        <LeversStage
          state={steps.levers}
          offerName={offer?.name ?? ""}
          values={levers}
          onValue={(k, v) => setLevers((cur) => ({ ...cur, [k]: v }))}
          busy={answerBusy}
          error={steps.levers === "choose" ? answerError : null}
          onContinue={() => void confirmLevers()}
        />
      );
    if (key === "gives")
      return (
        <GivesStage
          state={steps.gives}
          values={gives}
          onValue={(k, v) => setGives((cur) => ({ ...cur, [k]: v }))}
          busy={answerBusy}
          error={steps.gives === "choose" ? answerError : null}
          onContinue={() => void confirmGives()}
        />
      );
    if (key === "companies")
      return (
        <CompaniesStage
          state={steps.companies}
          audienceName={audience?.name ?? null}
          rows={audRows}
          done={audience ? !!rowsDone[audience.audienceId] : false}
          loadingMore={audience ? !!loadingMore[audience.audienceId] : false}
          building={audience ? !!building[audience.audienceId] : false}
          onMore={() => audience && wantRows(audience, (rowCount.current.get(audience.audienceId) ?? 0) + NEXT_PAGE)}
          note={audience ? rowsNote[audience.audienceId] ?? null : null}
          emailState={(i) => (audience ? emailStateFor(rowKey(audience.audienceId, i)) : "none")}
          onOpen={openRow}
        />
      );
    return (
      <EmailsStage
        state={steps.email}
        rows={audRows}
        selected={selectedRow}
        mail={selectedKey ? emails[selectedKey] : undefined}
        error={selectedKey ? emailErrors[selectedKey] ?? null : null}
        emailState={(i) => (audience ? emailStateFor(rowKey(audience.audienceId, i)) : "none")}
        check={(i) => (audience ? checks[rowKey(audience.audienceId, i)] : undefined)}
        written={requested.current.size}
        onOpen={openRow}
      />
    );
  }

  function emailStateFor(key: string): RowEmailState {
    if (emails[key]) return "written";
    if (writing[key]) return "writing";
    if (emailErrors[key]) return "failed";
    return "none";
  }

  return (
    <div className="k-canvas min-h-[100dvh] lg:flex lg:h-[100dvh] lg:flex-col">
      {canLaunch && (
        <div className="gs-down sticky top-0 z-20 border-b border-[var(--line-subtle)] bg-[var(--bg-raised)] lg:static">
          <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
            <span className="gs-pop hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[16px]" style={{ animationDelay: "200ms" }} aria-hidden="true">
              $
            </span>
            <div className="min-w-0 flex-1">
              <p className="k-fg text-[14px] font-medium">
                <CountUp value={30} format={(n) => `$${Math.round(n)}`} ms={700} /> of free credit to start
              </p>
              <p className="k-fg3 hidden text-[12px] sm:block">No charge today. We write and send the emails, you get the replies.</p>
            </div>
            <button
              type="button"
              className="k-btn-accent gs-glow h-8 px-3"
              onClick={() => {
                setWallNote(null);
                setWallOpen(true);
              }}
            >
              Start outreach
            </button>
          </div>
        </div>
      )}

      <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[296px_minmax(0,1fr)]">
        <JournalRail {...journal} />
        <main className="k-scroll lg:min-h-0 lg:overflow-y-auto">
          <div className="mx-auto max-w-[1040px] px-4 py-6 sm:px-6 sm:py-8">
            <Stepper steps={steps} staged={stagedKey} onOpen={openStep} nextLit={steps.email === "done"} />
            <LiveStatus current={current} domain={domain} pick={pick} />
            <div className="mt-4">
              <JournalStrip {...journal} />
            </div>

            {focus && (
              <div className="gs-in mt-4 flex items-center gap-2 text-[12px]">
                <span className="k-fg3">You are looking back at a finished step.</span>
                <button type="button" className="k-btn-ghost h-6 px-2" onClick={() => withStageTransition(() => setFocus(null))}>
                  Back to the live step
                </button>
              </div>
            )}

            <div key={stagedKey} className="gs-in mt-4" style={{ viewTransitionName: stepViewName(stagedKey) }}>
              {stageFor(stagedKey)}
            </div>

            {canLaunch && stagedKey === "email" && (
              <div className="gs-in mt-6 flex justify-end" style={{ animationDelay: "200ms" }}>
                <button
                  type="button"
                  className="k-btn-accent h-9 px-4"
                  onClick={() => {
                    setWallNote(null);
                    setWallOpen(true);
                  }}
                >
                  Start outreach with $30 free
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {wallOpen && brandId && offer && audience && plan.length > 0 && (
        <AccountCardWall
          brandId={brandId}
          website={websiteUrl(website)}
          brandName={brandName ?? domain ?? website}
          offer={offer}
          audience={audience}
          note={wallNote}
          email={(selectedKey ? emails[selectedKey] : undefined) ?? firstWritten(emails, audience.audienceId) ?? restoredEmail}
          floorUsd={planFloorUsd(plan, floorCents, floorUsd)}
          recommendedUsd={restoredBudget ?? recommendedUsd}
          budgetChosen={restoredBudget != null}
          plan={plan}
          entryLegKey={firstPath?.entryLegKey ?? null}
          answered={answered}
          onBudget={(usd) => saveSnapshot({ budgetUsd: usd })}
          onClose={() => setWallOpen(false)}
        />
      )}
    </div>
  );
}

function initialSteps(): Record<GetStartedStepKey, StepState> {
  return {
    company: "waiting",
    competitors: "waiting",
    offer: "waiting",
    audience: "waiting",
    value: "waiting",
    salesSteps: "waiting",
    legs: "waiting",
    paths: "waiting",
    levers: "waiting",
    gives: "waiting",
    companies: "waiting",
    email: "waiting",
  };
}

function emptyRecord<K extends string>(fields: ReadonlyArray<{ key: K }>): Record<K, string> {
  return Object.fromEntries(fields.map((f) => [f.key, ""])) as Record<K, string>;
}

/** Fills only the answers still blank: a draft never replaces what the visitor typed. */
function fillBlank<K extends string>(cur: Record<K, string>, fields: ReadonlyArray<{ key: K }>, draft: (k: K) => string): Record<K, string> {
  const next = { ...cur };
  for (const f of fields) if (!next[f.key].trim()) next[f.key] = draft(f.key);
  return next;
}

/** A row we can write to: the person has a first name and a title. */
function rowWritable(r: AudienceCompanyRow): boolean {
  return !!r.person.firstName && !!r.person.title;
}

/** Rows merged by index, in order: a page asked twice never doubles a company. */
function mergeRows(cur: AudienceCompanyRow[], got: AudienceCompanyRow[]): AudienceCompanyRow[] {
  const by = new Map(cur.map((r) => [r.index, r]));
  for (const r of got) by.set(r.index, r);
  return [...by.values()].sort((a, b) => a.index - b.index);
}

function firstWritten(emails: Record<string, PreviewEmail>, audienceId: string): PreviewEmail | undefined {
  const key = Object.keys(emails)
    .filter((k) => k.startsWith(`${audienceId}:`))
    .sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1]))[0];
  return key ? emails[key] : undefined;
}

function companiesNote(reason: string | null): string {
  if (reason === "no_match") return "We found no company matching this audience. Pick another one.";
  if (reason === "not_built_yet") return "This audience is still being prepared. Come back in a minute, or pick another one.";
  return "The companies of this audience cannot be listed for free. Pick another one.";
}

type RowEmailState = "none" | "writing" | "written" | "failed";

// ── Pieces ──────────────────────────────────────────────────────────────────

function Hero({
  website,
  onWebsite,
  onSubmit,
  error,
  exits,
}: {
  website: string;
  onWebsite: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  exits: RefusalExits | null;
}) {
  return (
    <div className="k-canvas flex min-h-[100dvh] items-center justify-center px-6">
      <div className="w-full max-w-[560px]">
        <p className="k-label gs-in">distribute.you</p>
        <h1 className="gs-in k-fg mt-3 text-[28px] font-medium leading-9 tracking-[-0.01em]" style={{ animationDelay: "60ms" }}>
          See who we would sell to for you.
        </h1>
        <p className="gs-in k-fg2 mt-2 text-[14px] leading-6" style={{ animationDelay: "120ms" }}>
          Type your website. In about a minute we read your company, find your competitors, and show you 100 companies we would write to, with the first emails. No account needed.
        </p>
        <form
          className="gs-in k-card mt-6 flex items-center gap-2 p-2"
          style={{ animationDelay: "180ms" }}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <input
            className="k-input h-9 min-w-0 flex-1 px-3 text-[14px]"
            placeholder="yourcompany.com"
            value={website}
            onChange={(e) => onWebsite(e.target.value)}
            autoFocus
            inputMode="url"
            aria-label="Your website"
          />
          <button type="submit" className="k-btn-accent h-9 px-4">
            Start
          </button>
        </form>
        <ol className="gs-in mt-5 grid grid-cols-3 gap-2" style={{ animationDelay: "240ms" }} aria-label="What you will see">
          {["Your company", "100 companies", "Your first emails"].map((label, i) => (
            <li key={label} className="k-fg3 flex items-center gap-2 text-[12px]">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] text-[10px] tabular-nums">{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        {error && (
          <p className="gs-in mt-3 text-[13px] text-[var(--data-rose)]" role="alert">
            {error}
          </p>
        )}
        {exits && (
          <p className="k-fg2 mt-2 text-[13px]">
            {exits.signIn && (
              <>
                {exits.signIn.lead}{" "}
                <a className="k-accent-text underline" href={exits.signIn.href}>
                  {exits.signIn.label}
                </a>
                .{" "}
              </>
            )}
            <a className="k-accent-text underline" href={exits.signUp.href}>
              {exits.signUp.label}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

const settled = settledPhase;

/**
 * Explee's stepper: numbered marks joined by rails that fill as each step lands, the
 * step on the stage named in a raised pill, then "what happens next": the three steps
 * the account turns on, drawn dotted until the preview's email is written, then lit.
 * A finished step's mark opens it on the stage.
 */
function Stepper({
  steps,
  staged,
  onOpen,
  nextLit,
}: {
  steps: Record<GetStartedStepKey, StepState>;
  staged: GetStartedStepKey;
  onOpen: (key: GetStartedStepKey) => void;
  nextLit: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:gap-5">
      <ol className="flex min-w-0 flex-1 items-center" aria-label="Progress">
        {GET_STARTED_STEPS.map((s, i) => {
          const st = steps[s.key];
          const active = s.key === staged;
          const prevSettled = i > 0 && settled(steps[GET_STARTED_STEPS[i - 1].key]);
          const openable = settled(st) && !active;
          const mark = (
            <>
              <StepMark index={i + 1} state={st} />
              {active ? <span key={s.key} className="gs-in whitespace-nowrap">{s.label}</span> : <span className="sr-only">{s.label}</span>}
            </>
          );
          const cls = `inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full text-[12px] ${
            active ? "k-card gs-glow k-fg px-2.5 font-medium" : settled(st) ? "k-fg2" : "k-fg3"
          }`;
          return (
            <li key={s.key} className={`flex items-center ${i > 0 ? "flex-1" : ""}`} aria-current={active ? "step" : undefined}>
              {i > 0 && (
                <span className="relative mx-1.5 h-px min-w-2 flex-1 overflow-hidden bg-[var(--line)] sm:mx-2" aria-hidden="true">
                  <span className="gs-fill absolute inset-y-0 left-0 bg-[var(--bg-strong)]" style={{ width: prevSettled ? "100%" : "0%" }} />
                </span>
              )}
              {openable ? (
                <button type="button" className={`${cls} k-hover`} onClick={() => onOpen(s.key)} title={`Open: ${s.label}`}>
                  {mark}
                </button>
              ) : (
                <span className={cls}>{mark}</span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="shrink-0" aria-label="What happens next">
        <p className="k-label mb-1.5 xl:text-center">What happens next</p>
        <ol className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
          {NEXT_STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-1.5 xl:flex-col xl:gap-1" style={nextLit ? stagger(i, 160) : undefined}>
              <span
                key={nextLit ? "lit" : "ghost"}
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums ${
                  nextLit ? "gs-pop border border-[var(--fg-2)] text-[var(--fg-1)]" : "border border-dashed border-[var(--line-strong)] text-[var(--fg-4)]"
                }`}
                style={nextLit ? stagger(i, 160) : undefined}
              >
                {GET_STARTED_STEPS.length + i + 1}
              </span>
              <span className={`whitespace-nowrap text-[11.5px] ${nextLit ? "k-fg2" : "k-fg4"}`}>{label}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function StepMark({ index, state }: { index: number; state: StepState }) {
  if (state === "running")
    return (
      <span key="running" className="gs-pop relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--run)] text-[10px] tabular-nums text-[var(--run)]" aria-label="Running">
        {index}
        <span className="k-dot-pulse absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" aria-hidden="true" />
      </span>
    );
  if (state === "choose")
    return (
      <span key="choose" className="gs-pop inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--accent)] text-[10px] tabular-nums text-[var(--accent)]" aria-label="Your pick">
        {index}
      </span>
    );
  if (state === "done")
    return (
      <span key="done" className="gs-pop inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-strong)] text-[10px] text-white tabular-nums">
        {index}
      </span>
    );
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--line-strong)] text-[10px] tabular-nums">{index}</span>
  );
}

const STATUS: Record<GetStartedStepKey, (domain: string | null) => string> = {
  company: (d) => `Reading ${d ?? "your site"} and finding your competitors`,
  competitors: () => "Finding your competitors",
  offer: () => "Reading what you sell",
  audience: () => "Working out who to write to",
  value: () => "Estimating what a client is worth to you",
  salesSteps: () => "Reading how your sales work today",
  legs: () => "Saving your sales steps",
  paths: () => "Ranking every way your sales can run",
  levers: () => "Drafting your offer from your site",
  gives: () => "Drafting what you could give away",
  companies: () => "Finding companies that match, with the right person at each",
  email: () => "Writing your first emails. The first one takes about a minute and a half.",
};

/**
 * What is being worked on right now, and for how long, or the pick the stage is
 * waiting on. Every line names a real step.
 */
function LiveStatus({ current, domain, pick }: { current: number; domain: string | null; pick: string | null }) {
  const key = pick ? null : current >= 0 ? GET_STARTED_STEPS[current].key : null;
  const secs = useElapsed(key);
  return (
    <p key={pick ? `pick:${pick}` : key ?? "ready"} className="gs-in mt-4 flex min-h-5 items-center gap-2 text-[13px]">
      {pick ? (
        <span className="gs-pop h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
      ) : key ? (
        <span className="k-dot-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--run)] text-[var(--run)]" />
      ) : (
        <span className="gs-pop h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-teal)]" />
      )}
      <span className="k-fg2 min-w-0" aria-live="polite">
        {pick ?? (key ? STATUS[key](domain) : "Your preview is ready.")}
      </span>
      {key && (
        <span className="k-mono k-fg3 text-[12px] tabular-nums" aria-hidden="true">
          {formatElapsed(secs)}
        </span>
      )}
    </p>
  );
}

function StepCard({
  index,
  title,
  state,
  meta,
  children,
}: {
  index: number;
  title: string;
  state: StepState;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`gs-fade k-card relative overflow-hidden p-4 ${state === "waiting" ? "translate-y-0.5 opacity-50" : "opacity-100"}`}>
      {state === "running" && (
        <span className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" aria-hidden="true">
          <span className="k-indeterminate block h-full w-1/3 rounded-full bg-[var(--accent)]" />
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className="k-label">{`Step ${index}`}</span>
        <h2 className="k-fg min-w-0 truncate text-[14px] font-medium">{title}</h2>
        {meta && <span className="ml-auto shrink-0">{meta}</span>}
      </div>
      {/* Keyed on the state so the content rises in the moment it lands. */}
      <div key={state} className="gs-in mt-3">
        {children}
      </div>
    </section>
  );
}

function StateWord({ state, doneLabel }: { state: StepState; doneLabel?: React.ReactNode }) {
  if (state === "running")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
        <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
        Working
      </span>
    );
  if (state === "done")
    return (
      <span key="done" className="gs-pop k-fg3 inline-flex items-center gap-1.5 text-[12px] tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
        {doneLabel ?? "Done"}
      </span>
    );
  if (state === "choose")
    return (
      <span key="choose" className="gs-pop inline-flex items-center gap-1.5 text-[12px] text-[var(--accent)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        Your pick
      </span>
    );
  if (state === "failed") return <span className="text-[12px] text-[var(--data-amber)]">Nothing found</span>;
  if (state === "notLive") return <span className="k-chip">Not live yet</span>;
  return <span className="k-fg4 text-[12px]">Waiting</span>;
}

function Rows({ n }: { n: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: n }).map((_, i) => (
        <Shimmer key={i} className="h-5" />
      ))}
    </div>
  );
}

function CompanyCard({
  state,
  name,
  domain,
  website,
  overview,
  facts,
}: {
  state: StepState;
  name: string | null;
  domain: string | null;
  website: string;
  overview: string;
  facts: string[];
}) {
  return (
    <StepCard index={1} title="Your company" state={state} meta={<StateWord state={state} />}>
      <div className="flex items-center gap-3">
        <span className="gs-pop inline-flex">
          <BrandLogo domain={domain} size={28} className="rounded-md" />
        </span>
        <div className="min-w-0">
          <p className="k-fg truncate text-[14px] font-medium">{name ?? domain ?? website}</p>
          {domain && <p className="k-fg3 k-mono truncate text-[12px]">{domain}</p>}
        </div>
      </div>
      {state === "running" ? (
        <div className="mt-3">
          <Rows n={3} />
        </div>
      ) : state === "failed" ? (
        <p className="k-fg3 mt-3 text-[13px]">We could not read enough from your site to describe it. The rest of the preview still runs.</p>
      ) : (
        <>
          {overview && <p className="k-fg2 mt-3 text-[13px] leading-5">{overview}</p>}
          {facts.length > 0 && (
            <div className="k-inset mt-3 grid gap-1.5 rounded-lg p-3">
              {facts.map((f, i) => (
                <p key={f} className="gs-in k-fg2 flex gap-2 text-[12px] leading-5" style={stagger(i + 1, 90)}>
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                  {f}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </StepCard>
  );
}

function CompetitorsCard({ state, competitors }: { state: StepState; competitors: Competitor[] }) {
  return (
    <StepCard
      index={2}
      title="Competitors"
      state={state}
      meta={<StateWord state={state} doneLabel={<><CountUp value={competitors.length} format={(n) => String(Math.round(n))} ms={600} /> found</>} />}
    >
      {state === "running" || state === "waiting" ? (
        <Rows n={3} />
      ) : competitors.length === 0 ? (
        <p className="k-fg3 text-[13px]">We found no direct competitor on your site. This does not change what we send.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
          {competitors.map((c, i) => (
            <li key={c.domain ?? c.name} className="gs-pop k-inset flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5" style={stagger(i, 60)}>
              <BrandLogo domain={c.domain} size={16} className="rounded-sm" />
              <span className="k-fg2 truncate text-[13px]">{c.domain ?? c.name}</span>
            </li>
          ))}
        </ul>
      )}
    </StepCard>
  );
}

/** Step 3 on the stage: every segment as a card with its size ring; picking one samples it. */

/** Step 3: the offers read off the site. Picking one confirms it on the brand. */
function OfferStage({
  state,
  proposals,
  main,
  picked,
  busy,
  error,
  onPick,
  onRetry,
}: {
  state: StepState;
  proposals: OfferProposal[];
  main: number;
  picked: GetStartedOffer | null;
  busy: number | null;
  error: string | null;
  onPick: (i: number) => void;
  onRetry: () => void;
}) {
  return (
    <StepCard index={3} title="What you sell" state={state} meta={<StateWord state={state} doneLabel={picked ? "Picked" : undefined} />}>
      {state === "running" || state === "waiting" ? (
        <OptionSkeleton />
      ) : proposals.length === 0 && !picked ? (
        <RetryNote text="We could not tell what you sell from your site." onRetry={onRetry} />
      ) : (
        <>
          <p className="k-fg2 text-[13px]">
            {proposals.length > 1 ? `We found ${proposals.length} things you sell. Pick the one to sell first; you can add the others later.` : "This is what we would sell for you."}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {proposals.map((o, i) => {
              const on = picked ? picked.name === o.name : false;
              const locked = !!picked && !on;
              return (
                <button
                  key={`${o.name}-${i}`}
                  type="button"
                  onClick={() => onPick(i)}
                  disabled={!!picked || busy != null}
                  aria-pressed={on}
                  style={stagger(i, 80)}
                  className={`gs-in k-card flex items-start gap-3 p-3 text-left transition-shadow duration-200 ${on ? "ring-1 ring-[var(--accent)]" : locked ? "opacity-50" : "k-hover"}`}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                    <OfferIcon token={o.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="k-fg text-[14px] font-medium leading-5">{o.name}</span>
                      {i === main && proposals.length > 1 && !picked && <span className="k-chip">Main</span>}
                    </span>
                    <span className="k-fg2 mt-1 block text-[12.5px] leading-5">{o.description}</span>
                    {busy === i && <span className="k-fg3 mt-1.5 block text-[12px]">Saving your pick</span>}
                    {on && <span className="k-accent-text mt-1.5 block text-[12px]">Picked</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

/** The step and leg screens of the sales path: the shared picker, one part per screen. */
function SalesPathStage({
  part,
  state,
  catalogue,
  catalogueFailed,
  onRetryCatalogue,
  selection,
  drafted,
  onChange,
  busy,
  error,
  onContinue,
}: {
  part: "steps" | "legs";
  state: StepState;
  catalogue: LegCatalogue;
  catalogueFailed: boolean;
  onRetryCatalogue: () => void;
  selection: SalesPathSelection;
  drafted: boolean;
  onChange: (next: SalesPathSelection) => void;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const done = state === "done";
  const key = part === "steps" ? "salesSteps" : "legs";
  const channelNames = useMemo(() => new Map(SALES_PATH_CHANNEL_SLUGS.map((s) => [s, SALES_PATH_CHANNEL_LABEL[s] ?? s])), []);
  const empty = part === "steps" ? selection.steps.size === 0 : selection.legs.size === 0;
  const label = (k: string | null) => (k ? catalogue.steps.get(k)?.label ?? k : "Start");
  return (
    <StepCard
      index={stepIndex(key) + 1}
      title={part === "steps" ? "Your sales steps" : "How leads move"}
      state={state}
      meta={<StateWord state={state} doneLabel={part === "steps" ? `${selection.steps.size} steps` : `${selection.legs.size} ways`} />}
    >
      {catalogueFailed && catalogue.legs.size === 0 && state !== "waiting" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="k-fg2 text-[13px]">We could not load the sales steps just now.</p>
          <button type="button" className="k-btn h-8 px-3" onClick={onRetryCatalogue}>
            Try again
          </button>
        </div>
      ) : state === "waiting" || state === "running" || catalogue.legs.size === 0 ? (
        <OptionSkeleton />
      ) : done ? (
        <ul className="flex flex-wrap gap-1.5">
          {part === "steps"
            ? [...selection.steps].map((s) => (
                <li key={s} className="k-chip">
                  {label(s)}
                </li>
              ))
            : [...catalogue.legs.values()]
                .filter((l) => selection.legs.has(l.legKey))
                .map((l) => (
                  <li key={l.legKey} className="k-chip">
                    {label(l.fromKey)} → {label(l.toKey)}
                  </li>
                ))}
        </ul>
      ) : (
        <>
          <p className="k-fg2 mb-3 text-[13px]">
            {part === "steps"
              ? "Which steps do your sales go through today, before someone becomes a paying client?"
              : "How do you move a lead from one step to the next today? Tick every way that applies."}
          </p>
          {part === "steps" && drafted && <p className="k-fg3 -mt-1 mb-3 text-[12px]">We ticked what we read on your site. Change anything.</p>}
          <OfferSalesPath
            catalogue={catalogue}
            channelNames={channelNames}
            selection={selection}
            onChange={onChange}
            part={part}
            stepsIntro="A paying client is always the last step."
            legsIntro="We run the ways marked with a channel. Your team keeps the others."
          />
          <div className="mt-4 flex items-center gap-3">
            {empty && <span className="k-fg3 text-[12px]">{part === "steps" ? "Tick at least one step." : "Tick at least one way."}</span>}
            <button type="button" className="k-btn-accent ml-auto h-9 px-4" onClick={onContinue} disabled={busy || empty}>
              {busy ? "Saving..." : "Continue"}
            </button>
          </div>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

/** Every path the ticked legs make, ranked by expected ROI; the one launched first is framed. */
function PathsStage({
  state,
  data,
  loading,
  failed,
  highlightPathKey,
  canContinue,
  onRetry,
  onStateRate,
  onContinue,
}: {
  state: StepState;
  data: OfferSalesPathsData | null;
  loading: boolean;
  failed: boolean;
  highlightPathKey: string | null;
  canContinue: boolean;
  onRetry: () => void;
  onStateRate: (leg: SalesPathLeg, ratePct: number | null) => Promise<void>;
  onContinue: () => void;
}) {
  const done = state === "done";
  return (
    <StepCard index={stepIndex("paths") + 1} title="Where your money goes" state={state} meta={<StateWord state={state} />}>
      {state === "waiting" ? (
        <OptionSkeleton />
      ) : (
        <>
          <p className="k-fg2 mb-3 text-[13px] leading-5">
            Every way your sales can run, with the return we expect from each. We put your budget on the framed one first.
          </p>
          <OfferSalesPaths
            data={data ?? undefined}
            pending={(loading || state === "running") && !data}
            failed={failed}
            highlightPathKey={highlightPathKey}
            intro="Best return first. Open a path to see the conversion rates behind it, and change any of them."
            onStateRate={done ? undefined : onStateRate}
          />
          <p className="k-fg3 mt-3 text-[12px] leading-5">
            This ranking comes from the conversion rates we measure and the ones you give us. As your results come in, it updates, and your budget follows the best return.
          </p>
          {failed && (
            <button type="button" className="k-btn mt-2 h-8 px-3" onClick={onRetry}>
              Try again
            </button>
          )}
          {!done && (
            <div className="mt-4 flex items-center gap-3">
              {data && !canContinue && <span className="k-fg3 text-[12px]">None of these paths starts with a way we run. Go back and tick one.</span>}
              <button type="button" className="k-btn-accent ml-auto h-9 px-4" onClick={onContinue} disabled={!canContinue}>
                Continue
              </button>
            </div>
          )}
        </>
      )}
    </StepCard>
  );
}

/** Step 6: what one client brings over their lifetime, prefilled with our estimate. */
function ValueStage({
  state,
  value,
  onValue,
  drafted,
  busy,
  error,
  onContinue,
}: {
  state: StepState;
  value: string;
  onValue: (v: string) => void;
  drafted: boolean;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const done = state === "done";
  return (
    <StepCard index={stepIndex("value") + 1} title="What a client is worth" state={state} meta={<StateWord state={state} />}>
      {state === "waiting" || state === "running" ? (
        <OptionSkeleton />
      ) : (
        <>
          <p className="k-fg2 text-[13px]">How much revenue does one client bring you over their whole lifetime?</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="k-fg2 text-[14px]">$</span>
            <input
              className="k-input h-9 w-36 px-2 text-right text-[15px] tabular-nums"
              inputMode="numeric"
              value={value}
              onChange={(e) => onValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !done) onContinue();
              }}
              disabled={done || busy}
              aria-label="Lifetime revenue of one client, in dollars"
            />
            {drafted && !done && <span className="k-chip">Our estimate from your site</span>}
            {!done && (
              <button type="button" className="k-btn-accent ml-auto h-9 px-4" onClick={onContinue} disabled={busy}>
                {busy ? "Saving..." : "Continue"}
              </button>
            )}
          </div>
          <p className="k-fg3 mt-2 text-[12px] leading-5">We use it to show what each campaign returns. You can change it later.</p>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

/**
 * A short answer shown as bullets; a click turns it into a text area, leaving it turns
 * it back. The text is the source: one line per bullet.
 */
function EditableAnswer({
  value,
  onValue,
  disabled,
  placeholder,
  label,
}: {
  value: string;
  onValue: (v: string) => void;
  disabled: boolean;
  placeholder: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const lines = answerLines(value);
  if (editing && !disabled)
    return (
      <textarea
        autoFocus
        className="k-input min-h-[96px] w-full resize-y px-2 py-1.5 text-[13px] leading-5"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        onBlur={() => setEditing(false)}
        aria-label={label}
        placeholder={placeholder}
      />
    );
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={disabled}
      className={`w-full rounded-lg px-2 py-1.5 text-left ${disabled ? "" : "k-hover cursor-text"}`}
      aria-label={`Edit: ${label}`}
    >
      {lines.length ? (
        <ul className="grid gap-1">
          {lines.map((l, i) => (
            <li key={i} className="k-fg2 flex gap-2 text-[13px] leading-5">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
      ) : (
        <span className="k-fg4 text-[13px]">{placeholder}</span>
      )}
    </button>
  );
}

/** Step 7: the six offer points (Hormozi), each its own box, click to edit. */
function LeversStage({
  state,
  offerName,
  values,
  onValue,
  busy,
  error,
  onContinue,
}: {
  state: StepState;
  offerName: string;
  values: Record<LeverDraftKey, string>;
  onValue: (k: LeverDraftKey, v: string) => void;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const done = state === "done";
  async function copyAll() {
    try {
      await navigator.clipboard.writeText(leversLLMPrompt(offerName, values));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("[get-started] copy failed:", e);
    }
  }
  return (
    <StepCard
      index={stepIndex("levers") + 1}
      title="Your offer, in six points"
      state={state}
      meta={
        state === "choose" || done ? (
          <button type="button" className="k-btn-ghost h-7 px-2 text-[12px]" onClick={() => void copyAll()}>
            {copied ? "Copied" : "Copy all for LLM"}
          </button>
        ) : (
          <StateWord state={state} />
        )
      }
    >
      {state === "waiting" || state === "running" ? (
        <OptionSkeleton />
      ) : (
        <>
          <p className="k-fg2 text-[13px]">We drafted these from your site. Click any box to change it: every email is written from them.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {LEVER_DRAFT_FIELDS.map((f, i) => (
              <div key={f.key} className="gs-in k-card p-3" style={stagger(i, 60)}>
                <p className="k-fg text-[13px] font-medium">{f.label}</p>
                <p className="k-fg3 mt-0.5 text-[12px]">{f.question}</p>
                <div className="mt-2">
                  <EditableAnswer value={values[f.key]} onValue={(v) => onValue(f.key, v)} disabled={done || busy} placeholder="Click to answer" label={f.label} />
                </div>
              </div>
            ))}
          </div>
          {!done && (
            <div className="mt-3 flex justify-end">
              <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue} disabled={busy}>
                {busy ? "Saving..." : "Continue"}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

/** Step 8: what the brand gives away to a prospect who replies, and what it never promises. */
function GivesStage({
  state,
  values,
  onValue,
  busy,
  error,
  onContinue,
}: {
  state: StepState;
  values: Record<GiveDraftKey, string>;
  onValue: (k: GiveDraftKey, v: string) => void;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const done = state === "done";
  return (
    <StepCard index={stepIndex("gives") + 1} title="What you give away" state={state} meta={<StateWord state={state} />}>
      {state === "waiting" || state === "running" ? (
        <OptionSkeleton />
      ) : (
        <>
          <p className="k-fg2 text-[13px]">Something free makes people reply. Tell us what we may offer, and what we must never promise.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {GIVE_DRAFT_FIELDS.map((f, i) => (
              <div key={f.key} className="gs-in k-card p-3" style={stagger(i, 80)}>
                <p className="k-fg text-[13px] font-medium">{f.label}</p>
                <p className="k-fg3 mt-0.5 text-[12px]">{f.question}</p>
                <div className="mt-2">
                  <EditableAnswer value={values[f.key]} onValue={(v) => onValue(f.key, v)} disabled={done || busy} placeholder="Click to add, one per line" label={f.label} />
                </div>
              </div>
            ))}
          </div>
          {!done && (
            <div className="mt-3 flex items-center justify-end gap-3">
              <span className="k-fg3 text-[12px]">Next, we write your first emails.</span>
              <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue} disabled={busy}>
                {busy ? "Saving..." : "Write my emails"}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

/** Step 4: who to write to, in words (at most 6). Picking one builds its companies. */
function AudienceStage({
  state,
  proposals,
  picked,
  busy,
  error,
  waitingForOffer,
  onPick,
  onRetry,
}: {
  state: StepState;
  proposals: AudienceSegmentProposal[];
  picked: GetStartedAudience | null;
  busy: number | null;
  error: string | null;
  waitingForOffer: boolean;
  onPick: (i: number) => void;
  onRetry: () => void;
}) {
  return (
    <StepCard index={4} title="Who to write to" state={state} meta={<StateWord state={state} doneLabel={picked ? "Picked" : undefined} />}>
      {state === "running" || state === "waiting" ? (
        <OptionSkeleton />
      ) : proposals.length === 0 ? (
        <RetryNote text="We could not work out who to write to." onRetry={onRetry} />
      ) : (
        <>
          <p className="k-fg2 text-[13px]">
            {waitingForOffer ? "Pick your offer first, then who to write to." : "Pick one audience. We find 100 companies in it and the right person at each."}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {proposals.map((a, i) => {
              const on = picked?.name === a.name;
              return (
                <button
                  key={`${a.name}-${i}`}
                  type="button"
                  onClick={() => onPick(i)}
                  disabled={waitingForOffer || busy != null}
                  aria-pressed={on}
                  style={stagger(i, 70)}
                  className={`gs-in k-card flex flex-col p-3 text-left transition-shadow duration-200 ${on ? "ring-1 ring-[var(--accent)]" : "k-hover"}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--data-violet)_14%,transparent)] text-[var(--data-violet)]">
                      <OfferIcon token={a.icon} />
                    </span>
                    <span className="k-fg min-w-0 text-[14px] font-medium leading-5">{a.name}</span>
                  </span>
                  <span className="k-fg2 mt-2 block text-[12.5px] leading-5">{a.description}</span>
                  {busy === i && <span className="k-fg3 mt-2 block text-[12px]">Finding companies</span>}
                  {on && busy !== i && <span className="k-accent-text mt-2 block text-[12px]">Picked</span>}
                </button>
              );
            })}
          </div>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

function RetryNote({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="k-fg3 text-[13px]">{text}</p>
      <button type="button" className="k-btn h-7 px-3" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function OptionSkeleton() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="k-inset rounded-lg p-3">
          <Rows n={3} />
        </div>
      ))}
    </div>
  );
}

/** Five dots filled by size, then the figure: Explee's size cell. */
function SizeCell({ count }: { count: number | null }) {
  const label = employeesLabel(count);
  if (!label) return <span className="k-fg4">{"—"}</span>;
  const n = sizeDots(count);
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="inline-flex gap-[3px]" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((d) => (
          <span key={d} className={`h-1 w-1 rounded-full ${d <= n ? "bg-[var(--fg-2)]" : "bg-[var(--line-strong)]"}`} />
        ))}
      </span>
      {label}
    </span>
  );
}

/** The same states as a mark alone, for the narrow people list (the word is its label). */
function EmailMark({ state }: { state: RowEmailState }) {
  if (state === "writing")
    return <span role="img" aria-label="Writing" className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--fg-3)] border-t-transparent motion-reduce:animate-none" />;
  if (state === "written") return <span role="img" aria-label="Written" className="gs-pop inline-block h-2 w-2 rounded-full bg-[var(--data-teal)]" />;
  if (state === "failed") return <span role="img" aria-label="Not written" className="inline-block h-2 w-2 rounded-full bg-[var(--data-amber)]" />;
  return null;
}

function EmailDot({ state }: { state: RowEmailState }) {
  if (state === "writing")
    return (
      <span className="k-fg3 inline-flex items-center gap-1.5 text-[12px]">
        <span aria-hidden className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
        Writing
      </span>
    );
  if (state === "written")
    return (
      <span className="gs-pop inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
        Written
      </span>
    );
  if (state === "failed") return <span className="text-[12px] text-[var(--data-amber)]">Not written</span>;
  return <span className="k-fg3 text-[12px]">Read email</span>;
}

/**
 * Step 5: the audience's companies with the ONE person we would write to at each,
 * streamed page by page. A row opens that person's email.
 */
function CompaniesStage({
  state,
  audienceName,
  rows,
  done,
  loadingMore,
  building,
  onMore,
  note,
  emailState,
  onOpen,
}: {
  state: StepState;
  audienceName: string | null;
  rows: AudienceCompanyRow[];
  done: boolean;
  loadingMore: boolean;
  building: boolean;
  onMore: () => void;
  note: string | null;
  emailState: (index: number) => RowEmailState;
  onOpen: (index: number) => void;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <span className="k-label">{`Step ${stepIndex("companies") + 1}`}</span>
        <h2 className="k-fg min-w-0 truncate text-[14px] font-medium">{audienceName ? `Companies in ${audienceName}` : "Companies that match"}</h2>
        <span className="ml-auto shrink-0">
          <StateWord
            state={state === "done" && loadingMore ? "running" : state}
            doneLabel={<><CountUp value={rows.length} format={(n) => String(Math.round(n))} ms={600} /> found</>}
          />
        </span>
      </div>
      {rows.length === 0 ? (
        state === "failed" ? (
          <div className="k-card p-4">
            <p className="k-fg3 text-[13px]">{note ?? "We found no company for this audience. Pick another one."}</p>
          </div>
        ) : (
          <div className="k-card p-4">
            <BuildingNote building={building} />
            <Rows n={8} />
          </div>
        )
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line-subtle)]">
                  <th className="k-label px-3 py-2.5 text-left font-normal first:pl-4">Company</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Description</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Location</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Size</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">We write to</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal last:pr-4">Email</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const name = [r.person.firstName, r.person.lastNameObfuscated].filter(Boolean).join(" ");
                  return (
                    <tr
                      key={r.index}
                      className="gs-in k-row cursor-pointer border-b border-[var(--line-subtle)] last:border-0"
                      style={stagger(i % NEXT_PAGE, 30)}
                      onClick={() => onOpen(r.index)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(r.index);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Read the email to ${name || r.company.name}`}
                    >
                      <td className="px-3 py-2 first:pl-4">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <BrandLogo domain={r.company.domain} size={20} className="shrink-0 rounded-md" />
                          <span className="min-w-0">
                            <span className="k-fg block max-w-[200px] truncate font-medium">{r.company.name}</span>
                            {r.company.domain && <span className="k-fg3 k-mono block max-w-[200px] truncate text-[12px]">{r.company.domain}</span>}
                          </span>
                        </span>
                      </td>
                      <td className="k-fg2 px-3 py-2">
                        {r.company.description ? <span className="line-clamp-2 max-w-[280px] text-[12.5px] leading-5">{r.company.description}</span> : <span className="k-fg4">{"—"}</span>}
                        {r.company.industry && <span className="k-fg3 mt-0.5 block max-w-[280px] truncate text-[11.5px] capitalize">{r.company.industry}</span>}
                      </td>
                      <td className="k-fg2 px-3 py-2">
                        <span className="block max-w-[170px] truncate">{r.company.location ?? r.company.country ?? <span className="k-fg4">{"—"}</span>}</span>
                      </td>
                      <td className="k-fg2 px-3 py-2">
                        <SizeCell count={r.company.employeeCount} />
                      </td>
                      <td className="px-3 py-2">
                        {name ? (
                          <span className="flex min-w-0 items-center gap-2">
                            <Initials name={name} size={20} round />
                            <span className="min-w-0">
                              <span className="k-fg block max-w-[170px] truncate">{name}</span>
                              {r.person.title && <span className="k-fg3 block max-w-[170px] truncate text-[12px]">{r.person.title}</span>}
                            </span>
                          </span>
                        ) : (
                          <span className="k-fg4">{"—"}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 last:pr-4">
                        <EmailDot state={emailState(r.index)} />
                      </td>
                    </tr>
                  );
                })}
                {loadingMore &&
                  [0, 1, 2].map((i) => (
                    <tr key={`more-${i}`}>
                      <td colSpan={6} className="px-4 py-2.5">
                        <Shimmer className="h-5" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!done && <MoreSentinel onMore={onMore} busy={loadingMore} />}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line-subtle)] px-4 py-2.5">
            <p className="k-fg3 min-w-0 flex-1 text-[12px] tabular-nums">
              {done ? `${rows.length} companies, one person each.` : `${rows.length} of up to 100 companies so far.`} Click a row to read the email we would send. Last names stay masked until your account is set up.
              {note && done ? ` ${note}` : ""}
            </p>
            {!done && (
              <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" disabled={loadingMore} onClick={onMore}>
                {loadingMore ? "Finding more" : "Show more"}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** What the empty table is waiting on, with the time it has taken so far. */
function BuildingNote({ building }: { building: boolean }) {
  const secs = useElapsed(building ? "building" : "finding");
  return (
    <p className="k-fg3 mb-3 flex items-center gap-2 text-[12px]">
      <span className="k-dot-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--run)] text-[var(--run)]" />
      <span className="min-w-0 flex-1">
        {building
          ? "Building the search for this audience. The first time takes about a minute and a half."
          : "Finding companies that match, and the right person at each."}
      </span>
      <span className="k-mono tabular-nums" aria-hidden="true">
        {formatElapsed(secs)}
      </span>
    </p>
  );
}

/**
 * Builds the next page when the bottom of the table scrolls into view: the rest of
 * the 100 is built only as the visitor reaches it, so an Apollo credit is only spent
 * on a company somebody looks at.
 */
function MoreSentinel({ onMore, busy }: { onMore: () => void; busy: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onMore);
  cb.current = onMore;
  useEffect(() => {
    const el = ref.current;
    if (!el || busy || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) cb.current();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [busy]);
  return <div ref={ref} aria-hidden="true" className="h-px" />;
}

/** One row's person, found and verified live: a masked domain, never the address. */
function RowCheck({ check }: { check: CompanyRowEmailCheck | undefined }) {
  if (!check) return null;
  if (check.status === "checking" || check.status === "pending")
    return (
      <span className="k-fg3 inline-flex items-center gap-1.5 text-[11.5px]">
        <span aria-hidden className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
        Finding and verifying the email
      </span>
    );
  const finder = providerLabel(check.finder);
  const verifier = providerLabel(check.verifier);
  if (check.status === "found")
    return (
      <span className="gs-pop block text-[11.5px]">
        <span className="k-fg k-mono">{check.maskedEmail ?? "—"}</span>
        <span className="k-fg3">
          {finder ? ` found via ${finder}` : " found"}
          {verifier && `, ${verifier}: `}
          {verifier && <span style={{ color: check.deliverable ? "var(--run)" : "var(--data-amber)" }}>{verdictLabel(check.verdict) ?? "no verdict"}</span>}
        </span>
      </span>
    );
  return <span className="gs-in k-fg3 block text-[11.5px]">{finder ? `No email found via ${finder}` : "No email found"}</span>;
}

/** Step 6: the people on the left, the selected one's email on the right (Explee's layout). */
function EmailsStage({
  state,
  rows,
  selected,
  mail,
  error,
  emailState,
  check,
  written,
  onOpen,
}: {
  state: StepState;
  rows: AudienceCompanyRow[];
  selected: number;
  mail: PreviewEmail | undefined;
  error: string | null;
  emailState: (index: number) => RowEmailState;
  check: (index: number) => CompanyRowEmailCheck | undefined;
  written: number;
  onOpen: (index: number) => void;
}) {
  const row = rows.find((r) => r.index === selected);
  const sel = emailState(selected);
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <span className="k-label">{`Step ${stepIndex("email") + 1}`}</span>
        <h2 className="k-fg min-w-0 truncate text-[14px] font-medium">Your first emails</h2>
        <span className="k-fg3 ml-auto shrink-0 text-[12px] tabular-nums">
          {written} of {EMAIL_CAP} free previews
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="k-card p-4">
          <p className="k-fg3 text-[13px]">{state === "failed" ? "We need at least one person to write to." : "Waiting for the first companies."}</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ul className="k-card k-scroll grid max-h-[560px] content-start overflow-y-auto overflow-x-hidden p-1.5" aria-label="People">
            {rows.map((r, i) => {
              const name = [r.person.firstName, r.person.lastNameObfuscated].filter(Boolean).join(" ") || r.company.name;
              const on = r.index === selected;
              return (
                <li key={r.index} className="gs-in" style={stagger(Math.min(i, 12), 30)}>
                  <button
                    type="button"
                    onClick={() => onOpen(r.index)}
                    aria-pressed={on}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left ${on ? "k-selected" : "k-hover"}`}
                  >
                    <Initials name={name} size={24} round />
                    <span className="min-w-0 flex-1">
                      <span className="k-fg block truncate text-[13px] font-medium">{name}</span>
                      <span className="k-fg3 block truncate text-[12px]">
                        {[r.person.title, r.company.domain ?? r.company.name].filter(Boolean).join(" · ")}
                      </span>
                      <span className="mt-1 block">
                        <RowCheck check={check(r.index)} />
                      </span>
                    </span>
                    <span className="flex h-5 w-3 shrink-0 items-center justify-center">
                      <EmailMark state={emailState(r.index)} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="k-card h-fit overflow-hidden">
            {row && (
              <div className="flex items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-3">
                <BrandLogo domain={row.company.domain} size={28} className="rounded-md" />
                <div className="min-w-0">
                  <p className="k-fg truncate text-[14px] font-medium">
                    {[row.person.firstName, row.person.lastNameObfuscated].filter(Boolean).join(" ") || "—"}
                  </p>
                  <p className="k-fg3 truncate text-[12px]">{[row.person.title, row.company.name].filter(Boolean).join(" at ")}</p>
                </div>
              </div>
            )}
            {mail ? (
              <div key={mail.id}>
                <div className="gs-in flex gap-3 border-b border-[var(--line-subtle)] px-4 py-2 text-[13px]">
                  <span className="k-label w-14 shrink-0 pt-0.5">Subject</span>
                  <span className="k-fg font-medium">{mail.subject}</span>
                </div>
                <EmailBody mail={mail} />
              </div>
            ) : sel === "writing" ? (
              <div className="px-4 py-4">
                <p className="k-fg3 mb-3 flex items-center gap-2 text-[12px]">
                  <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
                  {rows.some((r) => emailState(r.index) === "written")
                    ? "Writing this email. It takes about half a minute."
                    : "Writing this email. The first one takes about a minute and a half; the next ones are faster."}
                </p>
                <Rows n={6} />
              </div>
            ) : (
              <p className="k-fg3 px-4 py-4 text-[13px]">{error ?? (row && !row.person.firstName ? "We have no name for this person, so no email can be written." : "Click a person to write their email.")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * The first email for a brand takes ~110 s (brand-service reads the site, then the
 * model writes), and the Cloudflare edge in front of the gateway closes a request at
 * ~100 s while content-generation keeps going and stores the email. A repeat of the
 * same call returns the stored email in milliseconds, so anything that is not an
 * answer from the producer (a timeout, a gateway error) is asked again. A 4xx is an
 * answer and is never retried.
 */
async function writeWithRetry<T>(call: () => Promise<T>): Promise<T> {
  let last: unknown = null;
  for (let i = 0; i < 6; i++) {
    try {
      return await call();
    } catch (e) {
      last = e;
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
      console.warn(`[get-started] email still being written (attempt ${i + 1}):`, e);
      await new Promise((r) => setTimeout(r, 15000));
    }
  }
  throw last;
}

const KIND_COLOR: Record<string, string> = {
  prospect: "var(--data-sky)",
  brand: "var(--accent)",
  audience: "var(--data-violet)",
  instruction: "var(--data-amber)",
};

/**
 * The written email with each explained sentence marked. Hovering (mouse), focusing or
 * tapping a sentence shows why it was written and from what input, in a panel under
 * the body, so it reads the same on a phone as on a desktop. Every reason is the one
 * the writing model reported and content-generation checked.
 */
function ExplainedBody({ mail }: { mail: PreviewEmail }) {
  const pieces = useMemo(() => emailPieces(mail.bodyText, mail.highlights), [mail.bodyText, mail.highlights]);
  const [active, setActive] = useState<number | null>(null);
  const shown = active != null ? pieces[active]?.highlight ?? null : null;
  return (
    <div className="gs-in">
      <p className="k-fg2 whitespace-pre-line px-3 py-3 text-[13px] leading-6">
        {pieces.map((p, i) =>
          p.highlight ? (
            <span
              key={i}
              role="button"
              tabIndex={0}
              aria-pressed={active === i}
              aria-label={`${p.text} Why: ${p.highlight.reason}`}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") setActive(i);
              }}
              onFocus={() => setActive(i)}
              // A tap focuses THEN clicks, so a toggle here would close what focus just
              // opened. Click opens; another sentence replaces it.
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActive((cur) => (cur === i ? null : i));
                }
              }}
              className="cursor-pointer rounded-[3px] outline-none transition-colors"
              style={{
                textDecorationLine: "underline",
                textDecorationStyle: "dotted",
                textDecorationColor: KIND_COLOR[p.highlight.kind] ?? "var(--fg-3)",
                textUnderlineOffset: 3,
                background: active === i ? `color-mix(in oklab, ${KIND_COLOR[p.highlight.kind] ?? "var(--fg-3)"} 16%, transparent)` : undefined,
              }}
            >
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
      <div className="border-t border-[var(--line-subtle)] px-3 py-2.5" aria-live="polite">
        {shown ? (
          <div key={active} className="gs-in text-[12px] leading-5">
            <p className="flex flex-wrap items-center gap-x-2">
              <span className="font-medium" style={{ color: KIND_COLOR[shown.kind] ?? "var(--fg-2)" }}>
                {highlightKindLabel(shown.kind)}
              </span>
              <span className="k-fg3">{shown.sourceLabel}</span>
            </p>
            <p className="k-fg mt-0.5">{shown.reason}</p>
            {shown.sourceValue && <p className="k-fg3 mt-0.5 line-clamp-3">Source: {shown.sourceValue}</p>}
          </div>
        ) : (
          <p className="k-fg3 text-[12px]">Hover or tap an underlined sentence to see why it was written, and from what.</p>
        )}
      </div>
    </div>
  );
}

function EmailBody({ mail }: { mail: PreviewEmail }) {
  const explained = (mail.highlights?.length ?? 0) > 0;
  const [typed, setTyped] = useState(false);
  useEffect(() => setTyped(false), [mail.id]);
  if (explained && typed) return <ExplainedBody mail={mail} />;
  return <Typewriter text={mail.bodyText} className="k-fg2 whitespace-pre-line px-3 py-3 text-[13px] leading-6" onDone={explained ? () => setTyped(true) : undefined} />;
}
