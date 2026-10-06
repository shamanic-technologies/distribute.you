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
 * Rules live in `lib/v2/get-started.ts`.
 *
 * The SAME walk is the dashboard's "Add a brand" / "New brand" / "Finish setup"
 * (`org`, on `/v2/orgs/:orgId/new-brand`): every call names that org explicitly
 * (`setApiActiveOrgOverride`), no anonymous session, no account or phone wall; the
 * brand lands in that org and the walk ends on its credit step (`OrgLaunch`).
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import posthog from "posthog-js";
import { BRAND_WHY } from "@/lib/brand-why";
import {
  ApiError,
  checkAudienceCompanyEmail,
  confirmAudienceSegments,
  confirmBrandOffers,
  createBrandWithoutWebsite,
  extractBrandFields,
  getBrand,
  getAudienceCompanies,
  getOfferSalesPaths,
  getPublicCatalogueSignedOut,
  listAudiences,
  listBrandOffers,
  previewColdEmail,
  proposeAudienceSegments,
  proposeBrandOffers,
  saveOfferChannels,
  saveOfferLifetimeRevenue,
  saveOfferSalesPath,
  saveOfferSelectedSalesPaths,
  saveOfferUserFields,
  setApiActiveOrgOverride,
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
import { roiUnavailableLabel, type OfferSalesPaths as OfferSalesPathsData, type SalesPathLeg } from "@/lib/offer-sales-paths";
import { salesPathChannels, selectedPathKeys, type SalesPathChannel } from "@/lib/offer-active-sales-paths";
import { campaignsOfOffer, campaignTag, type OfferCampaign } from "@/lib/offer-campaigns";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { OfferSalesPath } from "@/components/v2/offer-sales-path";
import { OfferSalesPaths, PathAvatar } from "@/components/v2/offer-sales-paths";
import { CampaignLeg } from "@/components/v2/offer-campaigns";
import { SelectCard } from "@/components/v2/select-card";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { channelMarkForSlug } from "@/lib/acquisition-channels";
import {
  COMPANY_FIELDS,
  COMPETITOR_FIELDS,
  EMAIL_CAP,
  GET_STARTED_ORG_RESUME_MAX_AGE_MS,
  GET_STARTED_SNAPSHOT_KEY,
  GET_STARTED_STEPS,
  getStartedOrgSnapshotKey,
  firstOpenStepIndex,
  snapshotResumable,
  GIVE_DRAFT_FIELDS,
  LEVER_DRAFT_FIELDS,
  SERVICES_DRAFT_FIELD,
  NEXT_STEPS,
  OFFER_FIELDS,
  REOPENABLE_STEPS,
  SALES_PATH_CHANNEL_LABEL,
  VALUE_FIELDS,
  leadCountLabel,
  previousStep,
  campaignPlan,
  campaignPlanProblem,
  chosenCampaignOutlook,
  parseCampaignBudget,
  plannedKey,
  setPlannedOn,
  initialSalesSteps,
  salesStepsDraftField,
  answerLines,
  leversLLMPrompt,
  parseLifetimeRevenue,
  parseUsdEstimate,
  stepIndex,
  PREWRITTEN_EMAILS,
  canWriteAnother,
  countryFlag,
  emailPieces,
  highlightKindLabel,
  hostOf,
  offerSourceText,
  parseCompetitors,
  parseGetStartedSnapshot,
  settledPhase,
  stageDwellMs,
  stageMove,
  valueLines,
  valueText,
  websiteUrl,
  type Competitor,
  type GetStartedAudience,
  type GetStartedEmail,
  type GetStartedOffer,
  type GetStartedSnapshot,
  type GiveDraftKey,
  type LeverDraftKey,
  type GetStartedStepKey,
  type PlannedCampaign,
  type StepPhase,
  wallCopy,
} from "@/lib/v2/get-started";
import { Initials, Shimmer, StateDot } from "@/components/v2/ui";
import { OfferIcon } from "@/components/v2/new-org-icons";
import { CountUp, Typewriter, formatElapsed, stagger, useElapsed } from "./motion";
import { BrandLogo } from "@/components/brand-logo";
import { pricingLegFor, recommendedBudgetForPreview, type LaunchCampaign } from "./launch";
import { AccountCardWall } from "./account-card-wall";
import { OrgLaunch } from "./org-launch";
import { v2NewBrandHref } from "@/lib/v2/routes";
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

/**
 * The walk run from the dashboard, on a real org the person is a member of. `brandId`
 * is set by "Finish setup" (an unfinished brand of that org, resumed).
 */
export interface OrgWalk {
  orgId: string;
  brandId: string | null;
}

export function GetStarted({ org }: { org?: OrgWalk } = {}) {
  const params = useSearchParams();
  const { isSignedIn } = useAuth();
  // From the dashboard, every call names the org it acts on: never an anonymous
  // session, never whichever org the session happens to be on. Set before any read.
  useEffect(() => {
    if (!org) return;
    setApiActiveOrgOverride(org.orgId);
    return () => setApiActiveOrgOverride(null);
  }, [org?.orgId]);
  const snapshotKey = org ? getStartedOrgSnapshotKey(org.orgId) : GET_STARTED_SNAPSHOT_KEY;
  const wall = wallCopy();

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
  // The step and leg catalogue, and each channel's floor, off the public catalogue.
  const [catalogue, setCatalogue] = useState<LegCatalogue>(EMPTY_LEG_CATALOGUE);
  const [floorCents, setFloorCents] = useState<Map<string, number>>(new Map());
  const [wallOpen, setWallOpen] = useState(false);
  const [wallNote, setWallNote] = useState<string | null>(null);

  // Step 3: the offers read off the site; the ONE picked is confirmed on the brand.
  const [offerProposals, setOfferProposals] = useState<OfferProposal[]>([]);
  // From the dashboard, a brand that already holds offers (a resumed setup, a brand the
  // org had) picks one of THEM: never proposed and confirmed a second one.
  const existingOffers = useRef<{ offerId: string; name: string }[] | null>(null);
  const [offerMain, setOfferMain] = useState(0);
  const [offer, setOffer] = useState<GetStartedOffer | null>(null);
  const [offerBusy, setOfferBusy] = useState<number | null>(null);
  // A pick moves the walk on at once; the offer is confirmed behind it. Until then the
  // rail and the cards show the PENDING pick, and anything needing the offer awaits it.
  const [pendingOffer, setPendingOffer] = useState<{ name: string; description: string } | null>(null);
  const offerPromise = useRef<Promise<GetStartedOffer> | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  // Step 4: who to write to, in words; the ONE picked is created under the offer.
  const icpRef = useRef("");
  const offerSource = useRef<{ lines: string[]; ov: string }>({ lines: [], ov: "" });
  const [audienceProposals, setAudienceProposals] = useState<AudienceSegmentProposal[]>([]);
  const [audience, setAudience] = useState<GetStartedAudience | null>(null);
  const [audienceBusy, setAudienceBusy] = useState<number | null>(null);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const createdAudiences = useRef(new Map<string, GetStartedAudience>());
  const [pendingAudience, setPendingAudience] = useState<{ name: string; description: string } | null>(null);
  // Each proposed audience's market size (human-service's people count, ~45 s after it is created).
  const [audienceCounts, setAudienceCounts] = useState<Record<string, number>>({});
  const [prebuilt, setPrebuilt] = useState(false);
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
  // The paths are read off the SAVED legs, so only once a save has landed.
  const [legsSaved, setLegsSaved] = useState(false);
  // As on the Sales path page: the channels the offer accepts (the ones we run, off the
  // catalogue), the paths ticked (never ticked = the ones returning more than they cost),
  // and the campaigns those paths use, each on or off with its budget. The first two are
  // saved on the offer as their step is confirmed; the campaigns start at the launch.
  const [pathChannels, setPathChannels] = useState<SalesPathChannel[]>([]);
  const [accepted, setAccepted] = useState<ReadonlySet<string> | null>(null);
  const [pickedPaths, setPickedPaths] = useState<ReadonlySet<string> | null>(null);
  const [campaignRows, setCampaignRows] = useState<PlannedCampaign[]>([]);
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

  const [restoredEmail, setRestoredEmail] = useState<GetStartedEmail | null>(null);
  // The stage shows ONE step: the one the walk is on (`stageIdx`), or one the person
  // opened from the rail or the stepper (`focus`, cleared when the walk moves on).
  const [stageIdx, setStageIdx] = useState(0);
  const [focus, setFocus] = useState<GetStartedStepKey | null>(null);
  const audienceRef = useRef<GetStartedAudience | null>(null);
  audienceRef.current = audience;
  const snapRef = useRef<GetStartedSnapshot | null>(null);

  const ran = useRef(false);

  // Back from the Google sign-up round trip, a reload or a new tab: the walk is restored
  // from the browser's snapshot (2026-10-05: a reload restarted it from scratch), and the
  // wall opens at the step it was on after the round trip. A link naming ANOTHER website
  // starts that one instead.
  const resumed = useRef(false);
  const pendingResume = useRef<GetStartedSnapshot | null>(null);
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(snapshotKey);
    } catch (e) {
      console.error("[get-started] snapshot read failed:", e);
    }
    const snap = parseGetStartedSnapshot(raw);
    if (org) {
      // The org's own walk: resumed at once (it bills the org it names, on purpose).
      // "Finish setup" names its brand: another brand's snapshot is not that one.
      const fits = !!snap && (!org.brandId || snap.brandId === org.brandId) && snapshotResumable(snap, Date.now(), GET_STARTED_ORG_RESUME_MAX_AGE_MS);
      if (snap && fits) {
        applySnapshot(snap);
        resumed.current = true;
        resumePreparing(snap);
      } else if (org.brandId) void startExisting(org.brandId);
      return;
    }
    if (!snap) return;
    const roundTrip = params.get("resume") === "1";
    const carried = params.get("url");
    if (!roundTrip && carried && hostOf(websiteUrl(carried)) !== hostOf(snap.website)) return;
    if (!roundTrip && !snapshotResumable(snap, Date.now())) return;
    applySnapshot(snap);
    setWallOpen(roundTrip);
    if (!roundTrip) pendingResume.current = snap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What was still being prepared is asked again only once Clerk says the visitor is
  // signed OUT: a signed-in call would bill their active org (see `start`).
  useEffect(() => {
    const snap = pendingResume.current;
    if (!snap || isSignedIn !== false) return;
    pendingResume.current = null;
    resumed.current = true;
    resumePreparing(snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

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
        const floors = new Map<string, number>();
        for (const ch of cat.channels) {
          const c = channelMinimumCents(mins, ch.slug);
          if (c != null) floors.set(ch.slug, c);
        }
        setFloorCents(floors);
        // The channels step lists only the ones we run (owner 2026-10-06: no "coming soon").
        const runnable = salesPathChannels(cat.channels).filter((c) => c.managed && !c.customerOperated);
        setPathChannels(runnable);
        setAccepted((cur) => cur ?? new Set(runnable.map((c) => c.slug)));
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

  // The drafted steps, plus the positive reply every offer gets, tick the screen once
  // both the draft and the catalogue are in, unless the visitor already ticked something.
  useEffect(() => {
    if (selectionTouched.current || !draftedSteps.current || offered.legs.length === 0) return;
    const keys = initialSalesSteps(draftedSteps.current, offered.steps);
    if (keys.length > 0) setSelection(selectionFromSteps(keys, offered.legs));
  }, [offered, drafted]);

  // A website carried from a link starts the walk at once, like Explee's hero.
  useEffect(() => {
    if (ran.current || started || (isSignedIn && !org)) return;
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
    if (s.email) setRestoredEmail(s.email);
    if (s.salesPath) {
      selectionTouched.current = true;
      setLegsSaved(true);
      setSelection({ steps: new Set(s.salesPath.steps), legs: new Set(s.salesPath.legs) });
    }
    if (s.channels) setAccepted(new Set(s.channels));
    if (s.selectedPaths) setPickedPaths(new Set(s.selectedPaths));
    if (s.campaigns) setCampaignRows(s.campaigns);
    if (s.lifetimeRevenueUsd != null) setValueInput(String(s.lifetimeRevenueUsd));
    setAnswered(!!s.answered);
    if (s.icp) icpRef.current = s.icp;
    setStarted(true);
    ran.current = true;
    const restored: Record<GetStartedStepKey, StepState> = {
      company: "done",
      competitors: s.competitors.length ? "done" : "failed",
      offer: s.offer ? "done" : "failed",
      audience: s.audience ? "done" : "failed",
      value: s.lifetimeRevenueUsd != null ? "done" : "failed",
      salesSteps: s.salesPath ? "done" : "failed",
      legs: s.salesPath ? "done" : "failed",
      channels: s.channels ? "done" : "failed",
      paths: s.pathsDone ? "done" : "failed",
      campaigns: s.campaignsDone ? "done" : "failed",
      levers: s.answered ? "done" : "failed",
      gives: s.answered ? "done" : "failed",
      companies: s.audience ? "running" : "failed",
      email: s.email ? "done" : "failed",
    };
    setSteps(restored);
    setStageIdx(firstOpenStepIndex(GET_STARTED_STEPS.map((st) => restored[st.key])));
  }

  /**
   * A reload drops whatever was still being prepared: the offers and audiences to pick
   * from, and the drafted answers of the question steps. Asked again for the steps not
   * done (the brand, its offer and audience are already saved and are not re-created).
   */
  function resumePreparing(s: GetStartedSnapshot) {
    if (!s.offer) void prepareOffers(s.brandId, [], s.overview);
    if (!s.audience) {
      if (s.icp) {
        setStep("audience", "running");
        proposeAudienceSegments(s.brandId, s.icp)
          .then(({ segments }) => {
            setAudienceProposals(segments.slice(0, 6));
            setStep("audience", segments.length ? "choose" : "failed");
          })
          .catch((e) => {
            console.error("[get-started] audience proposals failed on resume:", e);
            setStep("audience", "failed");
          });
      } else void prepareAudiences(s.brandId);
    }
  }

  // The question steps' drafts, read again once the catalogue is in (a resumed walk
  // whose offer was picked but whose answers were not all given).
  useEffect(() => {
    if (!resumed.current || !brandId || !offer || answered || drafted !== "no" || offered.steps.length === 0) return;
    void draftAnswers(brandId, offer.offerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, offer?.offerId, answered, drafted, offered]);

  function saveSnapshot(patch: Partial<GetStartedSnapshot>) {
    const base = snapRef.current;
    if (!base) return;
    const next = { ...base, ...patch, savedAt: Date.now() };
    snapRef.current = next;
    try {
      localStorage.setItem(snapshotKey, JSON.stringify(next));
    } catch (e) {
      console.error("[get-started] snapshot write failed:", e);
    }
  }

  const setStep = (k: GetStartedStepKey, v: StepState) => setSteps((cur) => ({ ...cur, [k]: v }));

  // ── Steps 3 and 4, prepared in the background ─────────────────────────────

  /** The offers the site describes; the brand-service split runs off step 1's read. */
  async function prepareOffers(id: string, lines: string[], ov: string) {
    setStep("offer", "running");
    if (org) {
      try {
        const { offers } = await listBrandOffers(id);
        if (offers.length > 0) {
          existingOffers.current = offers.map((o) => ({ offerId: o.offerId, name: o.name }));
          setOfferProposals(offers.map((o) => ({ name: o.name, description: "", icon: "" })));
          setOfferMain(0);
          setStep("offer", "choose");
          return;
        }
      } catch (e) {
        console.error("[get-started] brand offers read failed:", e);
        setStep("offer", "failed");
        return;
      }
    }
    const text = offerSourceText(lines, ov);
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
      saveSnapshot({ icp });
      const { segments } = await proposeAudienceSegments(id, icp);
      setAudienceProposals(segments.slice(0, 6));
      setStep("audience", segments.length ? "choose" : "failed");
    } catch (e) {
      console.error("[get-started] audience proposals failed:", e);
      setStep("audience", "failed");
    }
  }

  /** Step 3: confirm the ONE offer picked, so the brand ends with exactly that offer. */
  /** A click moves the walk on at once: the step is done, the next one takes the stage. */
  function advance(k: GetStartedStepKey) {
    withStageTransition(() => {
      setStep(k, "done");
      setFocus(null);
      setStageIdx(stepIndex(k) + 1);
    });
  }

  /** A write behind a click failed: back to that step, with the reason. */
  function reopen(k: GetStartedStepKey, message: string) {
    withStageTransition(() => {
      setStep(k, "choose");
      setFocus(null);
      setStageIdx(stepIndex(k));
    });
    setAnswerError(message);
  }

  /** The confirmed offer, waiting for a pick still being saved. */
  async function ensureOffer(): Promise<GetStartedOffer> {
    if (offer) return offer;
    if (offerPromise.current) return offerPromise.current;
    throw new Error("no offer picked");
  }

  /** Step 3: the ONE offer picked moves the walk on at once; it is confirmed behind it. */
  function pickOffer(i: number) {
    if (!brandId || offer || pendingOffer) return;
    const picked = offerProposals[i];
    if (!picked) return;
    setOfferError(null);
    setPendingOffer({ name: picked.name, description: picked.description });
    advance("offer");
    posthog.capture("get_started_offer_picked", { offers: offerProposals.length });
    const id = brandId;
    const held = existingOffers.current?.find((o) => o.name === picked.name) ?? null;
    const p = (async () => {
      const { chosenOfferId } = held ? { chosenOfferId: held.offerId } : await confirmBrandOffers(id, [picked], 0);
      const next = { offerId: chosenOfferId, name: picked.name, description: picked.description };
      setOffer(next);
      saveSnapshot({ offer: next });
      void draftAnswers(id, chosenOfferId);
      return next;
    })();
    offerPromise.current = p;
    p.catch((e) => {
      console.error("[get-started] offer confirm failed:", e);
      offerPromise.current = null;
      setPendingOffer(null);
      withStageTransition(() => {
        setStep("offer", "choose");
        setFocus(null);
        setStageIdx(stepIndex("offer"));
      });
      setOfferError("We could not save this offer. Try again.");
    });
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
        ? [
            salesStepsDraftField(
              offered.steps.map((k) => {
                const st = catalogue.steps.get(k);
                return { key: k, label: st?.description ? `${st.label}: ${st.description}` : st?.label ?? k };
              }),
            ),
          ]
        : [];
      const fields = [...VALUE_FIELDS, ...stepsField, ...LEVER_DRAFT_FIELDS, ...GIVE_DRAFT_FIELDS, SERVICES_DRAFT_FIELD].map((f) => ({ key: f.key, description: f.description }));
      const r = await extractBrandFields([id], fields, { mode: "suggest", urlStrategy: "landing", offerId });
      const said = r.fields.salesSteps?.value;
      draftedSteps.current = Array.isArray(said) ? said.map(String) : typeof said === "string" ? said.split("\n") : [];
      const usd = parseUsdEstimate(r.fields.clientLifetimeRevenueUsd?.value);
      setValueInput((cur) => cur || (usd != null ? String(usd) : ""));
      setLevers((cur) => fillBlank(cur, LEVER_DRAFT_FIELDS, (k) => valueLines(r.fields[k]?.value).join("\n")));
      setGives((cur) => fillBlank(cur, GIVE_DRAFT_FIELDS, (k) => valueLines(r.fields[k]?.value).join("\n")));
      setDrafted("done");
      // No screen asks for it: saved as drafted so the offer page shows what is sold.
      const services = valueLines(r.fields.services?.value);
      if (services.length > 0) {
        saveOfferUserFields(id, offerId, { services }).catch((e) =>
          console.error("[get-started] offer services save failed:", { brandId: id, offerId, e }),
        );
      }
    } catch (e) {
      console.error("[get-started] answer drafts failed:", e);
      // No draft, but the positive reply is still ticked (it never came from the site).
      draftedSteps.current = [];
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
      open("channels", cur.legs === "done", false);
      // The paths and the campaigns are features-service's answer over what was saved: each
      // waits for its re-read after the step before it is confirmed.
      const ranked = salesPaths ? "choose" : pathsState === "failed" ? "failed" : "running";
      if (next.paths !== "done" && cur.channels === "done") next.paths = ranked;
      if (next.campaigns !== "done" && cur.paths === "done") next.campaigns = ranked;
      open("levers", cur.campaigns === "done", true);
      open("gives", cur.levers === "done", true);
      return JSON.stringify(next) === JSON.stringify(cur) ? cur : next;
    });
  }, [drafted, steps.audience, steps.value, steps.salesSteps, steps.legs, steps.channels, steps.paths, steps.campaigns, steps.levers, salesPaths, pathsState]);

  /** Saves the ticked steps and legs on the offer (brand-service replaces the whole selection). */
  async function saveSelection(next: SalesPathSelection, done: GetStartedStepKey) {
    if (!brandId) return;
    setAnswerError(null);
    advance(done);
    try {
      const o = await ensureOffer();
      await saveOfferSalesPath(brandId, o.offerId, [...next.steps], [...next.legs]);
      saveSnapshot({ salesPath: { steps: [...next.steps], legs: [...next.legs] } });
      posthog.capture(done === "salesSteps" ? "get_started_steps_ticked" : "get_started_legs_ticked", {
        steps: next.steps.size,
        legs: next.legs.size,
      });
      // The paths are re-ranked off what was just saved.
      setSalesPaths(null);
      setPathsState("idle");
      if (done === "legs") setLegsSaved(true);
    } catch (e) {
      console.error("[get-started] sales path save failed:", e);
      reopen(done, "We could not save this. Try again.");
    }
  }

  /**
   * Every path the saved legs and channels make, ranked by features-service on expected
   * ROI, with the campaigns the ticked paths use (the Sales path page's read). The campaigns
   * step opens on the best proactive one, its budget priced the way the "Add a brand"
   * modal prices one; what the visitor already set is kept.
   */
  async function loadPaths() {
    if (!brandId || !offer) return;
    setPathsState("loading");
    try {
      const data = await getOfferSalesPaths(brandId, offer.offerId, "catalogue");
      setPickedPaths((cur) => cur ?? selectedPathKeys({ offerId: offer.offerId, stated: false, combinationKeys: null, statedAt: null }, data.paths));
      const served = campaignsOfOffer(data.campaigns ?? [], data.paths, roiUnavailableLabel);
      const best = [...served].filter((c) => !c.reactive && c.managed !== false).sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity))[0];
      const leg = best && best.featureSlug === NEW_ORG_CHANNEL_SLUG ? pricingLegFor(best.legKey) : null;
      const recommended = leg
        ? await recommendedBudgetForPreview(brandId, offer.offerId, floorFor(NEW_ORG_CHANNEL_SLUG), leg).catch((e) => {
            console.error("[get-started] price read failed:", e);
            return null;
          })
        : null;
      setCampaignRows((cur) => campaignPlan(served, floorFor, recommended, cur));
      setSalesPaths(data);
      setPathsState("idle");
    } catch (e) {
      console.error("[get-started] sales paths read failed:", e);
      setPathsState("failed");
    }
  }

  /**
   * A channel's smallest daily budget, whole dollars (billing refuses less). A channel the
   * catalogue publishes no floor for asks a whole dollar, and billing judges the write.
   */
  function floorFor(featureSlug: string): number {
    const cents = floorCents.get(featureSlug);
    return cents == null ? 1 : Math.ceil(cents / 100);
  }

  // The paths are read once the legs are saved (and again on a restored walk).
  useEffect(() => {
    if (brandId && offer && legsSaved && !salesPaths && pathsState === "idle") void loadPaths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, offer?.offerId, legsSaved, salesPaths, pathsState]);

  /** A rate overwritten from a path's detail: the brand's own rate for the leg, then the paths re-ranked. */
  async function stateLegRate(leg: SalesPathLeg, ratePct: number | null) {
    if (!brandId || !leg.fromStep) return;
    await stateBrandLegRates(brandId, [{ fromStep: leg.fromStep.label, toStep: leg.toStep.label, ratePct }]);
    posthog.capture("get_started_rate_stated", { leg: leg.legKey, cleared: ratePct == null });
    await loadPaths();
  }

  /** What a client is worth, changed from a path's detail: saved on the offer, then the paths re-ranked. */
  async function stateLifetimeRevenue(usd: number) {
    if (!brandId) return;
    const o = await ensureOffer();
    await saveOfferLifetimeRevenue(brandId, o.offerId, usd);
    setValueInput(String(usd));
    saveSnapshot({ lifetimeRevenueUsd: usd });
    await loadPaths();
  }

  /** Step: the channels the offer accepts, saved on it; the paths are re-ranked off them. */
  async function confirmChannels() {
    if (!brandId || !accepted) return;
    setAnswerError(null);
    advance("channels");
    try {
      const o = await ensureOffer();
      await saveOfferChannels(brandId, o.offerId, [...accepted]);
      saveSnapshot({ channels: [...accepted] });
      posthog.capture("get_started_channels_ticked", { channels: accepted.size });
      // Other channels make other paths: the ticks start again from the ranking.
      setPickedPaths(null);
      setSalesPaths(null);
      setPathsState("idle");
    } catch (e) {
      console.error("[get-started] channels save failed:", e);
      reopen("channels", "We could not save this. Try again.");
    }
  }

  /** Step: the paths ticked, saved on the offer; the campaigns they use are read again. */
  async function confirmPaths() {
    if (!brandId || !pickedPaths) return;
    setAnswerError(null);
    advance("paths");
    try {
      const o = await ensureOffer();
      await saveOfferSelectedSalesPaths(brandId, o.offerId, [...pickedPaths]);
      saveSnapshot({ pathsDone: true, selectedPaths: [...pickedPaths] });
      posthog.capture("get_started_paths_seen", { paths: salesPaths?.paths.length ?? 0, ticked: pickedPaths.size });
      setSalesPaths(null);
      setPathsState("idle");
    } catch (e) {
      console.error("[get-started] sales paths save failed:", e);
      reopen("paths", "We could not save this. Try again.");
    }
  }

  /** Step: the campaigns set; they start once the credit is added. */
  function confirmCampaigns() {
    const problem = campaignPlanProblem(campaignRows, floorFor);
    if (problem) {
      setAnswerError(problem);
      return;
    }
    setAnswerError(null);
    advance("campaigns");
    saveSnapshot({ campaigns: campaignRows, campaignsDone: true });
    posthog.capture("get_started_campaigns_set", { on: campaignRows.filter((c) => c.on).length });
  }

  function changeCampaigns(next: PlannedCampaign[]) {
    setCampaignRows(next);
    setAnswerError(null);
    saveSnapshot({ campaigns: next });
  }

  /** Step 6: what one client is worth, saved on the offer. */
  async function confirmValue() {
    if (!brandId) return;
    const parsed = parseLifetimeRevenue(valueInput);
    if ("problem" in parsed) {
      setAnswerError(parsed.problem);
      return;
    }
    setAnswerError(null);
    advance("value");
    saveSnapshot({ lifetimeRevenueUsd: parsed.usd });
    try {
      const o = await ensureOffer();
      await saveOfferLifetimeRevenue(brandId, o.offerId, parsed.usd);
    } catch (e) {
      console.error("[get-started] lifetime revenue save failed:", e);
      reopen("value", "We could not save this. Try again.");
    }
  }

  /** Step 7: the six offer points, saved on the offer. */
  async function confirmLevers() {
    if (!brandId) return;
    setAnswerError(null);
    const fields: Partial<Record<LeverDraftKey, string | string[]>> = {};
    for (const f of LEVER_DRAFT_FIELDS) {
      const lines = answerLines(levers[f.key]);
      if (lines.length === 0) continue;
      fields[f.key] = f.key === "socialProof" ? lines : lines.join("\n");
    }
    advance("levers");
    try {
      const o = await ensureOffer();
      if (Object.keys(fields).length > 0) await saveOfferUserFields(brandId, o.offerId, fields);
    } catch (e) {
      console.error("[get-started] offer points save failed:", e);
      reopen("levers", "We could not save your offer. Try again.");
    }
  }

  /** Step 8: what is given away and never promised, saved; then the first emails are written. */
  async function confirmGives() {
    if (!brandId) return;
    setAnswerError(null);
    advance("gives");
    try {
      const o = await ensureOffer();
      await saveOfferUserFields(brandId, o.offerId, {
        giveForFree: answerLines(gives.giveForFree),
        neverGive: answerLines(gives.neverGive),
      });
      // The emails are written from these: only now.
      setAnswered(true);
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
      reopen("gives", "We could not save these lists. Try again.");
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
        setPrebuilt(true);
      })
      .catch(async (e) => {
        // A resumed walk re-proposes the audiences an earlier visit already created
        // (names are unique per offer): those are the ones meant, so they are adopted.
        if (!(e instanceof ApiError && e.status === 409)) throw e;
        await adoptExistingAudiences(brandId, offerId, segs);
        setPrebuilt(true);
      })
      .catch((e) => console.error("[get-started] audience prebuild failed:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, offer?.offerId, audienceProposals]);

  /** Step 4: the ONE audience picked (created with the others above), then its companies load. */
  // Each audience's market size, read once human-service has counted it (~45 s after
  // the prebuild created it): asked every 3 s until every created audience has one.
  useEffect(() => {
    if (!brandId || !offer || !prebuilt) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      if (stop) return;
      tries += 1;
      try {
        const { audiences } = await listAudiences(brandId, { offerId: offer.offerId });
        const counts: Record<string, number> = {};
        for (const [name, a] of createdAudiences.current) {
          const row = audiences.find((x) => x.id === a.audienceId);
          if (row && row.apolloCount != null) counts[name] = row.apolloCount;
        }
        setAudienceCounts(counts);
        if (Object.keys(counts).length >= createdAudiences.current.size) return;
      } catch (e) {
        console.error("[get-started] audience counts read failed:", e);
      }
      if (tries < 60 && !stop) setTimeout(() => void tick(), 3000);
    };
    void tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, offer?.offerId, prebuilt]);

  /** Step 4: the ONE audience picked moves the walk on at once; it is created (or found) behind it. */
  function pickAudience(i: number) {
    if (!brandId || audienceBusy != null) return;
    if (!offer && !offerPromise.current) return;
    const seg = audienceProposals[i];
    if (!seg) return;
    setAudienceError(null);
    if (steps.audience !== "done") {
      setPendingAudience({ name: seg.name, description: seg.description });
      advance("audience");
    } else {
      setAudienceBusy(i);
    }
    const id = brandId;
    void (async () => {
      try {
        const o = await ensureOffer();
        // The batch that creates every proposed audience starts once the offer lands:
        // wait for it to start rather than create this one a second time.
        for (let t = 0; t < 30 && !prebuild.current; t += 1) await new Promise((r) => setTimeout(r, 100));
        if (prebuild.current && !createdAudiences.current.has(seg.name)) await prebuild.current;
        let known = createdAudiences.current.get(seg.name);
        if (!known) {
          try {
            const { audiences } = await confirmAudienceSegments(id, o.offerId, icpRef.current || seg.description, [seg]);
            const made = audiences[0];
            if (!made) throw new Error("no audience created");
            known = { audienceId: made.id, name: seg.name, description: seg.description };
            createdAudiences.current.set(seg.name, known);
          } catch (e) {
            // Created by an earlier visit of this walk (a reload): adopted, never re-created.
            if (!(e instanceof ApiError && e.status === 409)) throw e;
            await adoptExistingAudiences(id, o.offerId, [seg]);
            known = createdAudiences.current.get(seg.name);
            if (!known) throw e;
          }
        }
        chooseAudience(known);
        posthog.capture("get_started_audience_picked", { audiences: audienceProposals.length });
      } catch (e) {
        console.error("[get-started] audience confirm failed:", e);
        setPendingAudience(null);
        withStageTransition(() => {
          setStep("audience", "choose");
          setFocus(null);
          setStageIdx(stepIndex("audience"));
        });
        setAudienceError("We could not set up this audience. Try again.");
      } finally {
        setAudienceBusy(null);
      }
    })();
  }

  /** The offer's audiences already created under these names (by an earlier visit), adopted as created. */
  async function adoptExistingAudiences(id: string, offerId: string, segs: AudienceSegmentProposal[]) {
    const { audiences } = await listAudiences(id, { offerId, limit: 100 });
    for (const seg of segs) {
      const row = audiences.find((a) => a.name === seg.name);
      if (row) createdAudiences.current.set(seg.name, { audienceId: row.id, name: seg.name, description: seg.description });
    }
  }

  function chooseAudience(next: GetStartedAudience) {
    const loaded = rows[next.audienceId]?.length ?? 0;
    setPendingAudience(null);
    withStageTransition(() => {
      setAudience(next);
      setSelectedRow(0);
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
    // The payment window is open: the page behind stands still.
    if (wallOpen) return;
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
  }, [phaseKey, stageIdx, wallOpen]);

  /** Back: a question step before this one is reopened to be answered again; any other is shown. */
  function goBack(from: GetStartedStepKey) {
    const prev = previousStep(from);
    if (!prev) return;
    if (REOPENABLE_STEPS.has(prev) && steps[prev] === "done") {
      withStageTransition(() => {
        setStep(prev, "choose");
        setFocus(null);
        setStageIdx(stepIndex(prev));
      });
      return;
    }
    withStageTransition(() => setFocus(prev));
  }

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
    // account is the dashboard's job (`org`, which names its org). The session route
    // refuses it too.
    if (isSignedIn && !org) {
      setInputError(SIGNED_IN_WALK_MESSAGE);
      setExits({ signIn: null, signUp: { href: "/v2", label: "Open your dashboard" } });
      return;
    }
    ran.current = true;
    setInputError(null);
    setExits(null);
    setStarted(true);
    setStep("company", "running");
    const url = websiteUrl(raw);
    // `website` feeds the owner's Telegram visit recap (lib/visit-recap.ts): a brand
    // added from the dashboard is not a visit.
    if (org) posthog.capture("brand_walk_website_submitted", { org_id: org.orgId });
    else posthog.capture("get_started_website_submitted", { website: raw.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "") });
    if (!org) {
      const session = await startAnonSession(url);
      if (!session.started) {
        ran.current = false;
        setStarted(false);
        setSteps(initialSteps());
        setInputError(session.message);
        setExits(refusalExits({ reason: session.reason, domain: hostOf(url), brandUrl: url }));
        return;
      }
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
    await walkBrand(id, createdName, hostOf(url), url);
  }

  /** Dashboard only: a brand with no website, created from what it sells (its own words). */
  async function startWithoutWebsite(name: string, text: string) {
    if (ran.current || !org) return;
    if (!name.trim()) return setInputError("Give your brand a name.");
    if (!text.trim()) return setInputError("Tell us what you sell.");
    ran.current = true;
    setInputError(null);
    setStarted(true);
    setStep("company", "running");
    posthog.capture("brand_walk_no_website", { org_id: org.orgId });
    let id: string;
    try {
      ({ brandId: id } = await createBrandWithoutWebsite(name.trim(), text.trim()));
    } catch (e) {
      console.error("[get-started] no-website brand create failed:", e);
      ran.current = false;
      setStarted(false);
      setSteps(initialSteps());
      setInputError("We could not create this brand. Try again.");
      return;
    }
    setBrandId(id);
    setBrandName(name.trim());
    setDomain(null);
    setWebsite("");
    await walkBrand(id, name.trim(), null, "", text.trim());
  }

  /** "Finish setup": an unfinished brand of this org, walked from what it already holds. */
  async function startExisting(id: string) {
    if (ran.current) return;
    ran.current = true;
    setStarted(true);
    setStep("company", "running");
    let b: { name: string | null; domain: string | null };
    try {
      const got = await getBrand(id);
      if (!got) throw new Error(`brand ${id} not found in this org`);
      b = got.brand;
    } catch (e) {
      console.error("[get-started] unfinished brand read failed:", e);
      ran.current = false;
      setStarted(false);
      setSteps(initialSteps());
      setInputError("We could not open this brand. Type its website to start again.");
      return;
    }
    const url = b.domain ? websiteUrl(b.domain) : "";
    setBrandId(id);
    setBrandName(b.name);
    setDomain(b.domain);
    setWebsite(url);
    await walkBrand(id, b.name, b.domain, url);
  }

  /**
   * From a brand that exists (just created, or an unfinished one resumed): the reads that
   * fill the walk. A brand with no website has only its own words to read (`ownWords`).
   */
  async function walkBrand(id: string, createdName: string | null, host: string | null, url: string, ownWords: string | null = null) {
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
      email: null,
    };
    saveSnapshot({});
    setSteps((cur) => ({ ...cur, competitors: "running", offer: "running", audience: "running" }));

    // ONE extraction reads steps 1, 2 and the offer lines; then the offer split and the
    // ideal customer + audience split run in parallel. The anonymous org holds $30,
    // enough for both reads' holds at once.
    const siteRead = (async () => {
      if (!url) {
        const ov = (ownWords ?? "").trim();
        setOverview(ov);
        setStep("company", ov ? "done" : "failed");
        setStep("competitors", "failed");
        saveSnapshot({ overview: ov });
        offerSource.current = { lines: [], ov };
        return;
      }
      try {
        const r = await extractBrandFields([id], [...COMPANY_FIELDS, ...COMPETITOR_FIELDS, ...OFFER_FIELDS], {
          mode: "suggest",
          urlStrategy: "landing",
        });
        const ov = valueText(r.fields.companyOverview?.value);
        const fs = valueLines(r.fields.companyFacts?.value).slice(0, 4);
        const list = parseCompetitors(r.fields.competitorsWithDomains?.value, host ?? "");
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
    // The ideal customer is drafted from what the read stored (an empty profile is
    // refused), so it waits for it; the offer split and the audience split then run together.
    await Promise.all([prepareOffers(id, offerSource.current.lines, offerSource.current.ov), prepareAudiences(id)]);
    posthog.capture("get_started_preview_ready");
  }

  // The campaigns as features-service names them (the step draws them, the launch names them).
  const servedCampaigns = useMemo(
    () => new Map(campaignsOfOffer(salesPaths?.campaigns ?? [], salesPaths?.paths ?? [], roiUnavailableLabel).map((c) => [plannedKey(c), c])),
    [salesPaths],
  );
  const launchCampaigns = useMemo<LaunchCampaign[]>(
    () =>
      campaignRows.flatMap((c) => {
        const served = servedCampaigns.get(plannedKey(c));
        if (!served) return [];
        return [{ ...c, label: SALES_PATH_CHANNEL_LABEL[c.featureSlug] ?? served.channelName, outcome: served.toLabel }];
      }),
    [campaignRows, servedCampaigns],
  );
  const canLaunch =
    started && !!brandId && !!offer && !!audience && steps.campaigns === "done" && launchCampaigns.some((c) => c.on && !c.reactive) && answered;
  const current = useMemo(() => GET_STARTED_STEPS.findIndex((s) => steps[s.key] === "running"), [steps]);

  const orgBar = org ? <OrgBar orgId={org.orgId} snapshotKey={snapshotKey} started={started} /> : null;

  if (!started) {
    return (
      <Hero
        top={orgBar}
        onWithoutWebsite={org ? (name, text) => void startWithoutWebsite(name, text) : null}
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
    channels: "Tick the channels we may use.",
    paths: "Tick the sales paths to run.",
    campaigns: "Turn on your campaigns and set their budgets.",
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
    offer: offer ?? (pendingOffer ? { offerId: "", ...pendingOffer } : null),
    audience: audience ?? (pendingAudience ? { audienceId: "", ...pendingAudience } : null),
    // A resumed walk holds the picked audience but not the proposals (they are not saved):
    // the rail still names it rather than "Audiences 0".
    audienceProposals:
      audienceProposals.length || !audience ? audienceProposals : [{ name: audience.name, description: audience.description, icon: "", iconConfidence: 0 }],
    audienceBusy,
    rows: audRows,
    written: writtenCount,
    stepCount: selection.steps.size,
    legCount: selection.legs.size,
    channelCount: accepted?.size ?? 0,
    pathCount: pickedPaths?.size ?? 0,
    campaignCount: campaignRows.filter((c) => c.on).length,
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
          picked={offer ?? pendingOffer}
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
          picked={audience ?? pendingAudience}
          busy={audienceBusy}
          error={audienceError}
          counts={audienceCounts}
          counting={prebuilt || !!offerPromise.current}
          waitingForOffer={!offer && !pendingOffer}
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
    if (key === "channels")
      return (
        <ChannelsStage
          state={steps.channels}
          channels={pathChannels}
          accepted={accepted}
          onToggle={(slug, on) => {
            setAccepted((cur) => {
              const next = new Set(cur ?? []);
              if (on) next.add(slug);
              else next.delete(slug);
              return next;
            });
            setAnswerError(null);
          }}
          error={steps.channels === "choose" ? answerError : null}
          onContinue={() => void confirmChannels()}
        />
      );
    if (key === "paths")
      return (
        <PathsStage
          state={steps.paths}
          data={salesPaths}
          loading={pathsState === "loading"}
          failed={pathsState === "failed"}
          selected={pickedPaths}
          onToggle={(k, on) =>
            setPickedPaths((cur) => {
              const next = new Set(cur ?? []);
              if (on) next.add(k);
              else next.delete(k);
              return next;
            })
          }
          error={steps.paths === "choose" ? answerError : null}
          onRetry={() => void loadPaths()}
          onStateRate={stateLegRate}
          onStateLifetimeRevenue={stateLifetimeRevenue}
          onContinue={() => void confirmPaths()}
        />
      );
    if (key === "campaigns")
      return (
        <CampaignsStage
          state={steps.campaigns}
          rows={campaignRows}
          served={servedCampaigns}
          failed={pathsState === "failed"}
          floorFor={floorFor}
          onChange={changeCampaigns}
          error={steps.campaigns === "choose" ? answerError : null}
          onRetry={() => void loadPaths()}
          onContinue={confirmCampaigns}
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
      {orgBar}
      {canLaunch && (
        <div className="gs-down sticky top-0 z-20 border-b border-[var(--line-subtle)] bg-[var(--bg-raised)] lg:static">
          <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
            <span className="gs-pop hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[16px]" style={{ animationDelay: "200ms" }} aria-hidden="true">
              $
            </span>
            <div className="min-w-0 flex-1">
              {org ? (
                <>
                  <p className="k-fg text-[14px] font-medium">Your brand is ready to launch.</p>
                  <p className="k-fg3 hidden text-[12px] sm:block">We write and send the emails, you get the replies.</p>
                </>
              ) : (
                <>
                  <p className="k-fg text-[14px] font-medium">
                    <CountUp value={wall.creditUsd} format={(n) => `$${Math.round(n)}`} ms={700} /> {wall.bannerTitle}
                  </p>
                  <p className="k-fg3 hidden text-[12px] sm:block">We write and send the emails, you get the replies.</p>
                </>
              )}
            </div>
            <button
              type="button"
              className="k-btn-accent gs-glow h-8 px-3"
              onClick={() => {
                setWallNote(null);
                setWallOpen(true);
              }}
            >
              {org ? "Launch" : "Start outreach"}
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
              <BackContext.Provider value={previousStep(stagedKey) ? () => goBack(stagedKey) : null}>{stageFor(stagedKey)}</BackContext.Provider>
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
                  {org ? "Launch" : wall.bannerCta}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {wallOpen && brandId && offer && audience && launchCampaigns.length > 0 && org && (
        <OrgLaunch
          orgId={org.orgId}
          brandId={brandId}
          website={website.trim() ? websiteUrl(website) : ""}
          offer={offer}
          targetAudience={icpRef.current}
          note={wallNote}
          campaigns={launchCampaigns}
          answered={answered}
          snapshotKey={snapshotKey}
          onClose={() => setWallOpen(false)}
        />
      )}
      {wallOpen && brandId && offer && audience && launchCampaigns.length > 0 && !org && (
        <AccountCardWall
          brandId={brandId}
          website={websiteUrl(website)}
          brandName={brandName ?? domain ?? website}
          offer={offer}
          audience={audience}
          targetAudience={icpRef.current}
          note={wallNote}
          email={(selectedKey ? emails[selectedKey] : undefined) ?? firstWritten(emails, audience.audienceId) ?? restoredEmail}
          campaigns={launchCampaigns}
          outlook={chosenCampaignOutlook(campaignRows, salesPaths?.campaigns ?? [], salesPaths?.paths ?? [])}
          answered={answered}
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
    channels: "waiting",
    paths: "waiting",
    campaigns: "waiting",
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
  top,
  onWithoutWebsite,
  website,
  onWebsite,
  onSubmit,
  error,
  exits,
}: {
  /** The dashboard's bar (where the walk was opened from), above the hero. */
  top: React.ReactNode;
  /** Dashboard only: a brand with no website starts from its name and what it sells. */
  onWithoutWebsite: ((name: string, text: string) => void) | null;
  website: string;
  onWebsite: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  exits: RefusalExits | null;
}) {
  const [noSite, setNoSite] = useState(false);
  const [name, setName] = useState("");
  const [sells, setSells] = useState("");
  const inOrg = !!onWithoutWebsite;
  return (
    <div className="k-canvas relative flex min-h-[100dvh] items-center justify-center px-6">
      {top && <div className="absolute inset-x-0 top-0">{top}</div>}
      <div className="w-full max-w-[560px]">
        <p className="k-label gs-in">distribute.you</p>
        <p className="gs-in k-fg2 mt-1 text-[13px] font-medium">{BRAND_WHY}</p>
        <h1 className="gs-in k-fg mt-3 text-[28px] font-medium leading-9 tracking-[-0.01em]" style={{ animationDelay: "60ms" }}>
          We find your next clients.
        </h1>
        <p className="gs-in k-fg2 mt-2 text-[14px] leading-6" style={{ animationDelay: "120ms" }}>
          {inOrg ? "Type its website. See 100 of them in a minute." : "Type your website. See 100 of them in a minute. No account needed."}
        </p>
        {noSite && onWithoutWebsite ? (
          <form
            className="gs-in k-card mt-6 space-y-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              onWithoutWebsite(name, sells);
            }}
          >
            <input className="k-input w-full px-3 text-[14px]" placeholder="Brand name" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label="Brand name" />
            <textarea
              className="k-input min-h-[96px] w-full resize-y px-3 py-2 text-[14px] leading-5"
              placeholder="What a customer buys from you, in a few sentences."
              value={sells}
              onChange={(e) => setSells(e.target.value)}
              aria-label="What you sell"
            />
            <div className="flex justify-end">
              <button type="submit" className="k-btn-accent h-9 px-4">
                Start
              </button>
            </div>
          </form>
        ) : (
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
        )}
        {onWithoutWebsite && (
          <button type="button" className="k-btn-ghost -ml-2 mt-2 h-7 text-[12px]" onClick={() => setNoSite((v) => !v)}>
            {noSite ? "This brand has a website" : "This brand has no website"}
          </button>
        )}
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

/**
 * The dashboard's frame around the walk: the way back to the org, and "Start a new
 * brand" (drops this org's saved walk; the unfinished brand stays on the org).
 */
function OrgBar({ orgId, snapshotKey, started }: { orgId: string; snapshotKey: string; started: boolean }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] bg-[var(--bg-raised)] px-4">
      <span className="k-label">Add a brand</span>
      {started && (
        <button
          type="button"
          className="k-btn-ghost ml-auto h-7 text-[12px]"
          onClick={() => {
            try {
              localStorage.removeItem(snapshotKey);
            } catch (e) {
              console.error("[get-started] snapshot clear failed:", e);
            }
            window.location.assign(v2NewBrandHref(orgId));
          }}
        >
          Start a new brand
        </button>
      )}
      <a href={`/v2/orgs/${encodeURIComponent(orgId)}`} aria-label="Close" className={`k-btn-ghost ${started ? "" : "ml-auto "}h-7 w-7 justify-center p-0`}>
        ×
      </a>
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
      <span key="choose" className="gs-pop inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--accent)] text-[10px] tabular-nums text-[var(--accent)]" aria-label="Waiting for you">
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
  channels: () => "Saving your sales steps",
  paths: () => "Ranking every way your sales can run",
  campaigns: () => "Reading the campaigns your sales paths use",
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

/** Back to the step before the one on the stage, or null on the first. Read by every step card. */
const BackContext = createContext<(() => void) | null>(null);

function StepCard({
  index,
  title,
  state,
  meta,
  footer,
  children,
}: {
  index: number;
  title: string;
  state: StepState;
  meta?: React.ReactNode;
  /** The step's own action (Continue), drawn bottom right, on Back's line. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const onBack = useContext(BackContext);
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
      {(onBack || footer) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {onBack && <BackLink onBack={onBack} />}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">{footer}</div>
        </div>
      )}
    </section>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="k-fg3 h-9 text-[13px] hover:text-[var(--fg-2)]" onClick={onBack}>
      ← Back
    </button>
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
  if (state === "choose") return null;
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
      ) : state === "failed" ? null : (
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
        <p className="k-fg3 text-[13px]">No competitor found.</p>
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
  picked: { name: string } | null;
  busy: number | null;
  error: string | null;
  onPick: (i: number) => void;
  onRetry: () => void;
}) {
  return (
    <StepCard index={3} title="What you sell" state={state} meta={<StateWord state={state} />}>
      {state === "running" || state === "waiting" ? (
        <OptionSkeleton />
      ) : proposals.length === 0 && !picked ? (
        <RetryNote text="We could not tell what you sell from your site." onRetry={onRetry} />
      ) : (
        <>
          <p className="k-fg2 text-[13px]">
            {proposals.length > 1 ? "Which one do we sell first?" : "This is what we sell for you."}
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
                  className={`gs-in k-card flex items-start gap-3 p-3 text-left transition-[box-shadow,background-color,opacity] duration-150 active:scale-[0.99] ${on ? "k-card-on" : locked ? "opacity-40" : "k-hover"}`}
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                    <OfferIcon token={o.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="k-fg text-[14px] font-medium leading-5">{o.name}</span>
                      {i === main && proposals.length > 1 && !picked && <span className="k-chip">Main</span>}
                      {on && <span aria-hidden className="ml-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] text-white">✓</span>}
                    </span>
                    <span className="k-fg2 mt-1 block text-[12.5px] leading-5">{o.description}</span>
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
      footer={
        !done && state === "choose" && catalogue.legs.size > 0 ? (
          <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue} disabled={busy || empty}>
            {busy ? "Saving..." : "Continue"}
          </button>
        ) : null
      }
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
              ? "Which steps do your sales go through today?"
              : "How do leads move from one step to the next?"}
          </p>
          <OfferSalesPath
            catalogue={catalogue}
            channelNames={channelNames}
            selection={selection}
            onChange={onChange}
            part={part}
            bare
          />
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

/** The channels the offer accepts: only the ones we run (owner 2026-10-06), as on the Sales path page. */
export function ChannelsStage({
  state,
  channels,
  accepted,
  onToggle,
  error,
  onContinue,
}: {
  state: StepState;
  channels: readonly SalesPathChannel[];
  accepted: ReadonlySet<string> | null;
  onToggle: (slug: string, on: boolean) => void;
  error: string | null;
  onContinue: () => void;
}) {
  const done = state === "done";
  const ticked = channels.filter((c) => accepted?.has(c.slug));
  return (
    <StepCard
      index={stepIndex("channels") + 1}
      title="Your channels"
      state={state}
      meta={<StateWord state={state} doneLabel={ticked.length === 1 ? "1 channel" : `${ticked.length} channels`} />}
      footer={
        !done && state === "choose" ? (
          <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue} disabled={ticked.length === 0}>
            Continue
          </button>
        ) : null
      }
    >
      {state === "waiting" || state === "running" || channels.length === 0 || !accepted ? (
        <OptionSkeleton />
      ) : done ? (
        <ul className="flex flex-wrap gap-1.5">
          {ticked.map((c) => (
            <li key={c.slug} className="k-chip">
              {c.name}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="k-fg2 mb-3 text-[13px]">Which channels may we use?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {channels.map((c) => {
              const on = accepted.has(c.slug);
              return (
                <SelectCard
                  key={c.slug}
                  on={on}
                  onClick={() => onToggle(c.slug, !on)}
                  mark={<AcquisitionChannelMark def={{ mark: channelMarkForSlug(c.slug) }} size="xs" dimmed={!on} />}
                  title={c.name}
                />
              );
            })}
          </div>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

/** Every path the ticked legs and channels make, best return first, ticked as on the Sales path page. */
export function PathsStage({
  state,
  data,
  loading,
  failed,
  selected,
  onToggle,
  error,
  onRetry,
  onStateRate,
  onStateLifetimeRevenue,
  onContinue,
}: {
  state: StepState;
  data: OfferSalesPathsData | null;
  loading: boolean;
  failed: boolean;
  selected: ReadonlySet<string> | null;
  onToggle: (combinationKey: string, on: boolean) => void;
  error: string | null;
  onRetry: () => void;
  onStateRate: (leg: SalesPathLeg, ratePct: number | null) => Promise<void>;
  onStateLifetimeRevenue: (usd: number) => Promise<void>;
  onContinue: () => void;
}) {
  const done = state === "done";
  const count = selected?.size ?? 0;
  return (
    <StepCard
      index={stepIndex("paths") + 1}
      title="Your sales paths"
      state={state}
      meta={<StateWord state={state} doneLabel={count === 1 ? "1 path" : `${count} paths`} />}
      footer={
        !done && state === "choose" ? (
          <>
            {data && count === 0 && <span className="k-fg3 text-[12px]">Tick at least one path.</span>}
            <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue} disabled={count === 0}>
              Continue
            </button>
          </>
        ) : null
      }
    >
      {state === "waiting" ? (
        <OptionSkeleton />
      ) : (
        <>
          <p className="k-fg2 mb-3 text-[13px] leading-5">Which ways to a paying client should we run? Best return first.</p>
          <OfferSalesPaths
            data={data ?? undefined}
            pending={(loading || state === "running") && !data}
            failed={failed}
            gainHeadline
            intro=""
            bare
            selected={selected ?? undefined}
            onToggleSelected={done ? undefined : onToggle}
            onStateRate={done ? undefined : onStateRate}
            onStateLifetimeRevenue={done ? undefined : onStateLifetimeRevenue}
          />
          <p className="k-fg3 mt-3 text-[12px] leading-5">Ranked from your conversion rates. It moves as your results come in.</p>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
          {failed && (
            <button type="button" className="k-btn mt-2 h-8 px-3" onClick={onRetry}>
              Try again
            </button>
          )}
        </>
      )}
    </StepCard>
  );
}

/**
 * The campaigns the ticked paths use, as on the Campaigns table (owner 2026-10-06): each
 * with its name and face, its leg, its type and its return, on or off, and its daily
 * budget (a max for a reactive one). One proactive campaign at a time. Nothing starts
 * here: the ones on start once the credit is added.
 */
export function CampaignsStage({
  state,
  rows,
  served,
  failed,
  floorFor,
  onChange,
  error,
  onRetry,
  onContinue,
}: {
  state: StepState;
  rows: readonly PlannedCampaign[];
  served: ReadonlyMap<string, OfferCampaign>;
  failed: boolean;
  floorFor: (featureSlug: string) => number;
  onChange: (next: PlannedCampaign[]) => void;
  error: string | null;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const done = state === "done";
  const shown = rows.filter((c) => served.has(plannedKey(c)));
  const on = shown.filter((c) => c.on);
  return (
    <StepCard
      index={stepIndex("campaigns") + 1}
      title="Your campaigns"
      state={state}
      meta={<StateWord state={state} doneLabel={on.length === 1 ? "1 campaign on" : `${on.length} campaigns on`} />}
      footer={
        !done && state === "choose" ? (
          <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue}>
            Continue
          </button>
        ) : null
      }
    >
      {state === "waiting" || state === "running" ? (
        <OptionSkeleton />
      ) : failed && shown.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="k-fg2 text-[13px]">We could not load your campaigns just now.</p>
          <button type="button" className="k-btn h-8 px-3" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className="k-fg2 text-[13px]">None of the ticked paths has a campaign we run. Go back and tick another path.</p>
      ) : (
        <>
          {!done && <p className="k-fg2 mb-3 text-[13px] leading-5">One campaign finds new leads. The others answer the leads it brings.</p>}
          <ul className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
            {shown.map((c) => {
              const key = plannedKey(c);
              const def = served.get(key) as OfferCampaign;
              return (
                <li
                  key={key}
                  className={`grid gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${c.on ? "bg-[color-mix(in_oklab,var(--run)_9%,transparent)]" : ""}`}
                >
                  <div className="min-w-0">
                    <span className="flex items-center gap-2.5">
                      {def.name && <PathAvatar name={def.name} size={28} />}
                      <span className="font-semibold">{def.name ?? def.channelName}</span>
                      <span className="k-chip">{campaignTag(def)}</span>
                    </span>
                    <CampaignLeg campaign={def} className="mt-1.5 text-[12.5px]" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span
                      className={`text-[13px] font-semibold tabular-nums ${roiIsGood(def.roi) ? "text-[var(--run)]" : ""}`}
                      title={def.roiUnavailable ?? undefined}
                    >
                      {def.roi == null ? formatRoi(def.roi) : `${formatRoi(def.roi)} return`}
                    </span>
                    {done ? (
                      <span className="k-fg2 text-[12.5px] tabular-nums">
                        {c.on ? `${c.reactive ? "Up to " : ""}$${c.budgetUsd}/day` : "Off"}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-pressed={c.on}
                          className="k-btn gap-1.5"
                          onClick={() => onChange(setPlannedOn(rows, key, !c.on))}
                          title={c.on ? "Turn off" : "Turn on"}
                        >
                          <StateDot running={c.on} label={c.on ? "On" : "Off"} />
                        </button>
                        <CampaignBudgetField
                          key={`${key}:${c.budgetUsd}`}
                          reactive={c.reactive}
                          usd={c.budgetUsd}
                          floorUsd={floorFor(c.featureSlug)}
                          disabled={!c.on}
                          onBudget={(usd) => onChange(rows.map((r) => (plannedKey(r) === key ? { ...r, budgetUsd: usd } : r)))}
                        />
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

/** A campaign's daily budget, typed in place; a value under the channel's floor says so and is not kept. */
function CampaignBudgetField({
  reactive,
  usd,
  floorUsd,
  disabled,
  onBudget,
}: {
  reactive: boolean;
  usd: number;
  floorUsd: number;
  disabled: boolean;
  onBudget: (usd: number) => void;
}) {
  const [text, setText] = useState(String(usd));
  const parsed = parseCampaignBudget(text, floorUsd);
  const problem = "problem" in parsed ? parsed.problem : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[12.5px]">
      <span className="k-fg2">{reactive ? "Up to $" : "$"}</span>
      <input
        className={`k-input w-16 px-2 text-right tabular-nums ${problem ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
        inputMode="numeric"
        value={text}
        disabled={disabled}
        aria-label={reactive ? "Daily max in dollars" : "Daily budget in dollars"}
        aria-invalid={problem !== null}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if ("usd" in parsed && parsed.usd !== usd) onBudget(parsed.usd);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && "usd" in parsed && parsed.usd !== usd) onBudget(parsed.usd);
        }}
      />
      <span className="k-fg3">/day</span>
      {problem && <span className="w-full text-right text-[11.5px] text-[var(--data-rose)]">{problem}</span>}
    </span>
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
  // The lifetime revenue is mandatory: no valid amount, no way forward.
  const hasValue = !("problem" in parseLifetimeRevenue(value));
  return (
    <StepCard
      index={stepIndex("value") + 1}
      title="What a client is worth"
      state={state}
      meta={<StateWord state={state} />}
      footer={
        !done && state === "choose" ? (
          <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue} disabled={busy || !hasValue}>
            {busy ? "Saving..." : "Continue"}
          </button>
        ) : null
      }
    >
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
                if (e.key === "Enter" && !done && hasValue) onContinue();
              }}
              disabled={done || busy}
              aria-label="Lifetime revenue of one client, in dollars"
            />
            {drafted && !done && <span className="k-chip">Our estimate from your site</span>}
          </div>
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
      footer={
        !done && state === "choose" ? (
          <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue} disabled={busy}>
            {busy ? "Saving..." : "Continue"}
          </button>
        ) : null
      }
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
          <p className="k-fg2 text-[13px]">Is this your offer?</p>
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
    <StepCard
      index={stepIndex("gives") + 1}
      title="What you give away"
      state={state}
      meta={<StateWord state={state} />}
      footer={
        !done && state === "choose" ? (
          <>
            <span className="k-fg3 text-[12px]">Next, a preview of your first emails. Nothing is sent.</span>
            <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue} disabled={busy}>
              {busy ? "Saving..." : "Preview my emails"}
            </button>
          </>
        ) : null
      }
    >
      {state === "waiting" || state === "running" ? (
        <OptionSkeleton />
      ) : (
        <>
          <p className="k-fg2 text-[13px]">What can we offer for free? What must we never promise?</p>
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
  counts,
  counting,
  waitingForOffer,
  onPick,
  onRetry,
}: {
  state: StepState;
  proposals: AudienceSegmentProposal[];
  picked: { name: string } | null;
  busy: number | null;
  error: string | null;
  /** Market size per audience name (human-service's people count), when counted. */
  counts: Record<string, number>;
  /** The audiences are being counted: a missing figure shows a loading bar, not nothing. */
  counting: boolean;
  waitingForOffer: boolean;
  onPick: (i: number) => void;
  onRetry: () => void;
}) {
  return (
    <StepCard index={4} title="Who to write to" state={state} meta={<StateWord state={state} />}>
      {state === "running" || state === "waiting" ? (
        <OptionSkeleton />
      ) : proposals.length === 0 ? (
        <RetryNote text="We could not work out who to write to." onRetry={onRetry} />
      ) : (
        <>
          <p className="k-fg2 text-[13px]">
            {waitingForOffer ? "Pick your offer first." : "Who do we write to first?"}
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
                  className={`gs-in k-card flex flex-col p-3 text-left transition-[box-shadow,background-color,opacity] duration-150 active:scale-[0.99] ${on ? "k-card-on" : picked ? "opacity-40" : "k-hover"}`}
                >
                  <span className="flex items-start gap-2">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--data-violet)_14%,transparent)] text-[var(--data-violet)]">
                      <OfferIcon token={a.icon} />
                    </span>
                    <span className="k-fg min-w-0 flex-1 text-[14px] font-medium leading-5">{a.name}</span>
                    <AudienceSize count={a.estimatedLeadCount ?? counts[a.name]} counting={counting && a.estimatedLeadCount == null} />
                  </span>
                  <span className="k-fg2 mt-2 block text-[12.5px] leading-5">{a.description}</span>
                  {on && <span className="mt-2 flex"><span aria-hidden className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] text-white">✓</span></span>}
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

/** An audience's market size, big, top right: "14K leads". A loading bar while counted. */
function AudienceSize({ count, counting }: { count: number | undefined; counting: boolean }) {
  const label = leadCountLabel(count);
  if (label)
    return (
      <span className="gs-pop shrink-0 text-right">
        <span className="k-fg block text-[20px] font-semibold leading-6 tabular-nums">{label.replace(" leads", "")}</span>
        <span className="k-fg3 block text-[11px]">leads</span>
      </span>
    );
  return counting ? <Shimmer className="mt-1 h-5 w-12 shrink-0 rounded-md" /> : null;
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
  const onBack = useContext(BackContext);
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
            <table className="w-full min-w-[660px] text-[13px]">
              <thead>
                <tr className="border-b border-[var(--line-subtle)]">
                  <th className="k-label px-3 py-2.5 text-left font-normal first:pl-4">Company</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">Description</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal">We write to</th>
                  <th className="k-label px-3 py-2.5 text-left font-normal last:pr-4">Email</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const name = r.person.firstName ?? "";
                  const country = countryFlag(r.company.country);
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
                            {country && (
                              <span className="k-fg2 flex max-w-[220px] items-center gap-1.5 text-[12px]">
                                {country.flag && (
                                  <span className="text-[14px] leading-none" aria-hidden="true">
                                    {country.flag}
                                  </span>
                                )}
                                <span className="truncate">{country.name}</span>
                              </span>
                            )}
                            {r.company.domain && <span className="k-fg3 k-mono block max-w-[220px] truncate text-[12px]">{r.company.domain}</span>}
                          </span>
                        </span>
                      </td>
                      <td className="k-fg2 px-3 py-2">
                        {r.company.description ? <span className="line-clamp-2 max-w-[280px] text-[12.5px] leading-5">{r.company.description}</span> : <span className="k-fg4">{"—"}</span>}
                        {r.company.industry && <span className="k-fg3 mt-0.5 block max-w-[280px] truncate text-[11.5px] capitalize">{r.company.industry}</span>}
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
                      <td colSpan={4} className="px-4 py-2.5">
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
      {onBack && (
        <div>
          <BackLink onBack={onBack} />
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

/** One row's person, found and verified live, in plain words. */
function RowCheck({ check }: { check: CompanyRowEmailCheck | undefined }) {
  if (!check) return null;
  if (check.status === "checking" || check.status === "pending")
    return (
      <span className="k-fg3 inline-flex items-center gap-1.5 text-[11.5px]">
        <span aria-hidden className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
        Finding and verifying the email
      </span>
    );
  // No address, no vendor names: the visitor only needs to know we reach this person.
  if (check.status === "found")
    return (
      <span className="gs-pop block text-[11.5px]" style={{ color: check.deliverable ? "var(--run)" : undefined }}>
        {check.deliverable ? "Email found and verified" : "Email found"}
      </span>
    );
  return <span className="gs-in k-fg3 block text-[11.5px]">No email found</span>;
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
  const onBack = useContext(BackContext);
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
              const name = r.person.firstName || r.company.name;
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
                    {row.person.firstName || "—"}
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
      {onBack && (
        <div>
          <BackLink onBack={onBack} />
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
