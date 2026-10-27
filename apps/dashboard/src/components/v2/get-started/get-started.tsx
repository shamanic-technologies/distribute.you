"use client";

/**
 * `/get-started`: onboarding v2, signed out, in the dashboard v2 (Keel) language.
 *
 * Explee's order: a website, then real output one step at a time: the company read
 * and its competitors (steps 1 and 2), the ONE offer to sell (3) and the ONE audience
 * to write to (4), picked from proposals, then the first companies of that audience
 * with the right person at each (5) and the first emails (6). Then the END (owner sketch
 * 2026-10-10): "Your campaign", ONE sales funnel with its caps (and, ticked, the one that
 * books meetings on replies). Its Launch opens the account and the card on ONE screen (the wall).
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
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { HandWavingIcon } from "@phosphor-icons/react/dist/csr/HandWaving";
import { pingOwner } from "@/lib/owner-ping-client";
import { BRAND_WHY } from "@/lib/brand-why";
import {
  ApiError,
  confirmAudienceSegments,
  estimateAudienceSegments,
  confirmBrandOffers,
  createBrandWithoutWebsite,
  extractBrandFields,
  getBrand,
  getAudienceCompanies,
  getPublicCatalogueSignedOut,
  getQualificationPreview,
  getSignupFunnelPages,
  listAudiences,
  listOfferQualificationCriteria,
  listBrandOffers,
  previewColdEmail,
  prepareColdEmailPreviews,
  proposeAudienceSegments,
  proposeBrandOffers,
  proposeBrandOffersFromSite,
  saveOfferLifetimeRevenue,
  saveOfferUserFields,
  setApiActiveOrgOverride,
  startQualificationPreview,
  suggestBrandIcp,
  suggestOfferQualificationCriteria,
  updateOfferQualificationCriterion,
  upsertBrand,
  type AudienceCompanyRow,
  type AudienceSegmentProposal,
  type OfferProposal,
  type PreviewEmail,
  type QualificationCriterion,
  type QualificationPreviewCompany,
} from "@/lib/api";
import { startAnonSession } from "@/lib/anon-session-client";
import { refusalExits, type RefusalExits } from "@/lib/claimed-signup";
import { websiteInputProblem } from "@/lib/website-input";
import { phoneSyntaxProblem, toE164 } from "@/lib/phone-syntax";
import { readGetStartedPrefill } from "@/lib/get-started-prefill";
import type { PhoneValue } from "@/components/onboarding/phone-input";
import { PhoneField, defaultPhoneCountry } from "./phone-field";
import {
  DEFAULT_SIGNUP_DRAFT,
  SIGNUP_PERIODS,
  SIGNUP_PROACTIVE_CHANNEL,
  SIGNUP_REACTIVE_CHANNEL,
  signupFunnelsFrom,
  signupLaunchPlan,
  type SignupCampaignDraft,
  type SignupFunnel,
  type SignupPeriod,
} from "@/lib/v2/signup-campaign";
import { FunnelFace } from "@/components/v2/funnel-campaigns";
import {
  COMPANY_FIELDS,
  COMPETITOR_FIELDS,
  PREVIEW_SIGNATURE,
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
  REOPENABLE_STEPS,
  VALUE_FIELDS,
  leadCountLabel,
  previousStep,
  signalWrites,
  type SignalRole,
  chosenFunnelOutlook,
  answerLines,
  leversLLMPrompt,
  givesLLMPrompt,
  parseLifetimeRevenue,
  parseUsdEstimate,
  stepIndex,
  MAX_CHECKED_COMPANIES,
  checkDomain,
  companiesWanted,
  unmetSignals,
  countryFlag,
  emailPieces,
  highlightKindLabel,
  hostOf,
  parseCompetitors,
  parseGetStartedSnapshot,
  resumeOfferPlan,
  settledPhase,
  stageDwellMs,
  stageMove,
  stepRunningBefore,
  valueLines,
  valueText,
  websiteUrl,
  type Competitor,
  type GetStartedAudience,
  type GetStartedEmail,
  type GetStartedOffer,
  type GetStartedSnapshot,
  type GetStartedPhone,
  type GetStartedName,
  GET_STARTED_YOU_KEY,
  parseRememberedYou,
  aiSetupPrompt,
  givenName as nameOf,
  type GiveDraftKey,
  type LeverDraftKey,
  type GetStartedStepKey,
  type StepPhase,
  TOPUP_CHOICES_USD,
  wallCopy,
} from "@/lib/v2/get-started";
import { DEFAULT_MONTHLY_LIMIT_USD, monthlyLimitToSave, type LimitArm } from "@/lib/v2/monthly-limit";
import { Initials, Shimmer } from "@/components/v2/ui";
import { EditableAnswer } from "@/components/v2/editable-answer";
import { OfferIcon } from "@/components/v2/new-org-icons";
import { CountUp, Typewriter, formatElapsed, stagger, useElapsed } from "./motion";
import { BrandLogo } from "@/components/brand-logo";
import { isSubscriptionArm, offerArm, pickedPlanCents } from "@/lib/subscription-plan";
import { AccountCardWall } from "./account-card-wall";
import { GS_ARM_COOKIE, GS_ARM_COPY, showsEmails, walkStepNumber, walkSteps, type GsArm } from "@/lib/v2/get-started-arm";
import { EMAIL_ANGLES, ANGLE_CHANNEL, angleStrategy, funnelFitsAngles, toggleAngle, type EmailAngle } from "@/lib/v2/email-angles";
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
 * Each company not already cached costs the anonymous org an Apollo credit (~12 cents),
 * and visitors do not scroll past the first rows (owner 2026-10-06). So the preview is
 * ONE page of five, never more, before payment.
 */
const PREVIEW_COMPANIES = 5;

const rowKey = (audienceId: string, index: number) => `${audienceId}:${index}`;

/**
 * The walk run from the dashboard, on a real org the person is a member of. `brandId`
 * is set by "Finish setup" (an unfinished brand of that org, resumed).
 */
export interface OrgWalk {
  orgId: string;
  brandId: string | null;
}

type GetStartedProps = { org?: OrgWalk; ipCountry?: string | null; gsArm?: GsArm; gsArmFresh?: boolean };

/** The arm this walk was drawn into, for the stages that word or number themselves by it. */
const GsArmContext = createContext<GsArm>("emails");

export function GetStarted(props: GetStartedProps = {}) {
  return (
    <GsArmContext.Provider value={props.gsArm ?? "emails"}>
      <GetStartedWalk {...props} />
    </GsArmContext.Provider>
  );
}

function GetStartedWalk({ org, ipCountry = null, gsArm = "emails", gsArmFresh = false }: GetStartedProps) {
  const params = useSearchParams();
  // The get-started A/B arm (owner 2026-10-17, lib/v2/get-started-arm.ts), drawn on the
  // server: kept in a cookie and carried on every PostHog event as `gs_arm`.
  const emailsShown = showsEmails(gsArm);
  const armCopy = GS_ARM_COPY[gsArm];
  useEffect(() => {
    if (gsArmFresh) document.cookie = `${GS_ARM_COOKIE}=${gsArm}; path=/; max-age=31536000; samesite=lax`;
    posthog.register({ gs_arm: gsArm });
  }, [gsArm, gsArmFresh]);
  const { isSignedIn } = useAuth();
  // From the dashboard, every call names the org it acts on: never an anonymous
  // session, never whichever org the session happens to be on. Set before any read.
  useEffect(() => {
    if (!org) return;
    setApiActiveOrgOverride(org.orgId);
    return () => setApiActiveOrgOverride(null);
  }, [org?.orgId]);
  const snapshotKey = org ? getStartedOrgSnapshotKey(org.orgId) : GET_STARTED_SNAPSHOT_KEY;
  // The homepage A/B arm (owner 2026-10-10), read after mount: the cookie is not on the
  // server render, and reading it there would mismatch the first frame.
  const [planMonthlyUsd, setPlanMonthlyUsd] = useState<number | null>(null);
  // The post-paid arm (owner 2026-10-13) is a signup offer: the dashboard walk pays as before.
  const [postpaidArm, setPostpaidArm] = useState(false);
  useEffect(() => {
    if (isSubscriptionArm(document.cookie)) setPlanMonthlyUsd(Math.round(pickedPlanCents(document.cookie) / 100));
    if (!org && offerArm(document.cookie) === "postpaid") setPostpaidArm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const wall = wallCopy(planMonthlyUsd, postpaidArm);
  // The monthly limit's first charge to let through (owner 2026-10-12): the plan, post-paid's first step, or the smallest top-up.
  const limitArm: LimitArm =
    planMonthlyUsd !== null
      ? { kind: "plan", monthlyUsd: planMonthlyUsd }
      : postpaidArm
        ? { kind: "postpaid" }
        : { kind: "prepaid", topupUsd: TOPUP_CHOICES_USD[0] };

  const [website, setWebsite] = useState(params.get("url") ?? "");
  // A prepared link (`?firstName=&lastName=&phone=+…`, owner 2026-10-21): what we already know
  // about the prospect opens filled in; they still walk every step.
  const [prefill] = useState(() => readGetStartedPrefill(params, ipCountry));
  // The WhatsApp number typed under the website (optional, owner 2026-10-15). The
  // country is the connection's (read on the server); the browser language only
  // refines it after mount, so the first frame matches the server render.
  const [phone, setPhone] = useState<PhoneValue>(() => {
    if (prefill.phone) return prefill.phone;
    const c = defaultPhoneCountry(ipCountry, undefined);
    return { countryCode: c.code, dialCode: c.dial, national: "" };
  });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // The number as given at Start: the wall saves it on the account once it exists.
  const [givenPhone, setGivenPhone] = useState<GetStartedPhone | null>(null);
  const givenPhoneRef = useRef<GetStartedPhone | null>(null);
  // Their first and last name, optional too (owner 2026-10-15): the WhatsApp greeting says it.
  const [firstName, setFirstName] = useState(prefill.firstName);
  const [lastName, setLastName] = useState(prefill.lastName);
  const [givenPerson, setGivenPerson] = useState<GetStartedName | null>(null);
  const givenPersonRef = useRef<GetStartedName | null>(null);
  useEffect(() => {
    // What they told us on an earlier walk in this browser comes back filled in (owner
    // 2026-10-15: never ask twice). Read after mount: localStorage is not on the server.
    if (!org) {
      let you = null;
      try {
        you = parseRememberedYou(localStorage.getItem(GET_STARTED_YOU_KEY));
      } catch (e) {
        console.error("[get-started] remembered name and number not read:", e);
      }
      if (you?.person) {
        const p = you.person;
        setFirstName((cur) => cur || p.firstName);
        setLastName((cur) => cur || p.lastName);
      }
      if (you?.phone) {
        const ph = you.phone;
        setPhone((cur) => (cur.national.trim() ? cur : ph));
        return;
      }
    }
    if (ipCountry) return;
    const c = defaultPhoneCountry(null, navigator.language);
    setPhone((cur) => (cur.national.trim() ? cur : { ...cur, countryCode: c.code, dialCode: c.dial }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [inputError, setInputError] = useState<string | null>(null);
  const [exits, setExits] = useState<RefusalExits | null>(null);
  // After the first page (owner 2026-10-15): set up with their own AI, or here step by step.
  // Nothing is spent before they pick "Myself".
  const [setup, setSetup] = useState<{ raw: string; view: "choose" | "ai" } | null>(null);
  const [started, setStarted] = useState(false);

  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [overview, setOverview] = useState("");
  const [facts, setFacts] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [steps, setSteps] = useState<Record<GetStartedStepKey, StepState>>(() => initialSteps());
  // Each channel's own one-line description (public catalogue): the line under the campaign's name.
  const [channelLines, setChannelLines] = useState<Map<string, string>>(new Map());
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
  // A brand with no website: its offers are read from what the visitor typed about it.
  const ownWordsRef = useRef<string | null>(null);
  const [audienceProposals, setAudienceProposals] = useState<AudienceSegmentProposal[]>([]);
  const [audience, setAudience] = useState<GetStartedAudience | null>(null);
  const [audienceBusy, setAudienceBusy] = useState<number | null>(null);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const createdAudiences = useRef(new Map<string, GetStartedAudience>());
  const [pendingAudience, setPendingAudience] = useState<{ name: string; description: string } | null>(null);
  // Each proposed audience's approximate market size, estimated WITHOUT creating it
  // (owner 2026-10-06: creating every proposal cost ~$2.25 a visitor; only the picked
  // one is created, by `pickAudience`).
  const [audienceCounts, setAudienceCounts] = useState<Record<string, number>>({});
  const [estimating, setEstimating] = useState(false);
  const estimated = useRef(false);
  const [building, setBuilding] = useState<Record<string, boolean>>({});
  // Step 5: the first companies of the picked audience (PREVIEW_COMPANIES).
  const [rows, setRows] = useState<Record<string, AudienceCompanyRow[]>>({});
  const [rowsDone, setRowsDone] = useState<Record<string, boolean>>({});
  const [rowsNote, setRowsNote] = useState<Record<string, string>>({});
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Audiences with no company left to list (refills stop there).
  const exhausted = useRef(new Set<string>());
  const loading = useRef(new Set<string>());
  const [loadingMore, setLoadingMore] = useState<Record<string, boolean>>({});
  // How many rows the visitor has asked to see, per audience (grows as they scroll).
  const wanted = useRef(new Map<string, number>());
  const rowCount = useRef(new Map<string, number>());
  // The email style step (`emails` arm, owner 2026-10-17): the styles ticked (at least one), and
  // one example per style, written on click for the first lead, never ahead.
  const [angles, setAngles] = useState<Set<EmailAngle>>(() => new Set(EMAIL_ANGLES.map((a) => a.key)));
  const [examples, setExamples] = useState<Partial<Record<EmailAngle, PreviewEmail>>>({});
  const [exampleBusy, setExampleBusy] = useState<Partial<Record<EmailAngle, boolean>>>({});
  const [exampleErrors, setExampleErrors] = useState<Partial<Record<EmailAngle, string>>>({});
  const [exampleShown, setExampleShown] = useState<EmailAngle | null>(null);
  // The first email waits on a full read of the site (up to ~2 minutes on a big one).
  // Start that read the moment the brand exists, so step 6 only waits for the model.
  const warmed = useRef(new Set<string>());
  useEffect(() => {
    if (!brandId || warmed.current.has(brandId)) return;
    warmed.current.add(brandId);
    prepareColdEmailPreviews(brandId).catch((e) => {
      // The first email then makes the read itself, as it did before the warm-up.
      console.error("[get-started] email warm-up failed:", e);
    });
  }, [brandId]);

  // Steps 5 to 8: questions about the offer, each prefilled from ONE site read made as
  // soon as the offer is picked. The first emails wait for the answers: they are
  // written from them.
  const [valueInput, setValueInput] = useState("");
  // The END (owner sketch 2026-10-10): the funnels features-service proposes (the best proactive
  // one on cold email, the meeting-booking one), and the caps as typed.
  const [funnels, setFunnels] = useState<{ proactive: SignupFunnel | null; reactive: SignupFunnel | null } | null>(null);
  const [funnelsState, setFunnelsState] = useState<"idle" | "loading" | "failed">("idle");
  // "Set up my campaign" pressed while a step before it is still running (the 100
  // companies): the stage would walk straight back to that step, so the press is held
  // here, the button says so, and the campaign opens the moment the step settles.
  const [campaignAsked, setCampaignAsked] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState<SignupCampaignDraft>(DEFAULT_SIGNUP_DRAFT);
  const [levers, setLevers] = useState<Record<LeverDraftKey, string>>(() => emptyRecord(LEVER_DRAFT_FIELDS));
  const [gives, setGives] = useState<Record<GiveDraftKey, string>>(() => emptyRecord(GIVE_DRAFT_FIELDS));
  const [drafted, setDrafted] = useState<"no" | "running" | "done" | "failed">("no");
  const [answered, setAnswered] = useState(false);
  const answeredRef = useRef(false);
  answeredRef.current = answered;
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  // The signals step: the offer's checks (lead-service), all ticked until the visitor unticks one.
  const [signals, setSignals] = useState<QualificationCriterion[]>([]);
  const [signalTicks, setSignalTicks] = useState<Set<string>>(new Set());
  // Each check's Must have / Nice to have, prefilled with the role the AI recommends.
  const [signalRoles, setSignalRoles] = useState<Record<string, SignalRole>>({});
  const [signalsRead, setSignalsRead] = useState<"no" | "running" | "done" | "failed">("no");
  // The signals run on the preview companies (lead-service), keyed by company domain: a company
  // failing a Must have gets no person and no email. `signalsSaved` resolves once the visitor's
  // ticks are on the offer (checks run on what they chose); `checksGen` drops answers of older ticks.
  const [companyChecks, setCompanyChecks] = useState<Record<string, QualificationPreviewCompany>>({});
  const checkWaits = useRef(new Map<string, Promise<QualificationPreviewCompany | null>>());
  const signalsSaved = useRef<Promise<void> | null>(null);
  const checksGen = useRef(0);
  const failingRows = useRef(new Map<string, Set<number>>());
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
      // A signup walk stopped at the wall (paid, never launched: CeXO AI 2026-10-17) left its
      // snapshot under the signup key: "Finish setup" on that brand resumes it, never screen 1.
      const resume = fits ? snap : org.brandId ? signupSnapshotFor(org.brandId) : null;
      if (resume) {
        applySnapshot(resume);
        resumed.current = true;
        resumePreparing(resume);
        // The campaign was already set: straight to Launch.
        if (resume.campaignDone) setWallOpen(true);
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

  // Each channel's one-line description, off the public catalogue: no session needed. A failed
  // read leaves the campaign without its line (logged), never a line of our own.
  useEffect(() => {
    getPublicCatalogueSignedOut()
      .then((cat) => setChannelLines(new Map(cat.channels.flatMap((c) => (c.shortDescription ? [[c.slug, c.shortDescription] as const] : [])))))
      .catch((e) => console.error("[get-started] catalogue read failed:", e));
  }, []);

  // The funnels the campaign step proposes (features-service, runnable only), PRICED FOR THIS OFFER
  // (owner 2026-10-10: its own client value, never the fleet's). Read once the preview is answered
  // and again when the step opens (the value may have changed); kept in the snapshot so the wall
  // reopens on them after the Google round trip. Asked again on a failure, then stated with a retry.
  // The email style picked names the cold email play (all styles = the pipe's default play).
  const styleStrategy = emailsShown ? angleStrategy(angles) : null;
  async function loadFunnels(id: string, offerId: string, attempts = 3) {
    setFunnelsState("loading");
    const strategy = styleStrategy;
    for (let i = 0; i < attempts; i += 1) {
      try {
        const next = signupFunnelsFrom(
          await getSignupFunnelPages(id, offerId, strategy ? `${ANGLE_CHANNEL}~${strategy}` : null),
          (funnelId) => funnelFitsAngles(funnelId, strategy),
        );
        setFunnels(next);
        saveSnapshot({ funnels: next });
        setFunnelsState("idle");
        return;
      } catch (e) {
        console.error(`[get-started] funnels read failed (attempt ${i + 1}):`, e);
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      }
    }
    setFunnelsState("failed");
  }
  // Signed out the read rides the anonymous session; signed in (back from Google, before the claim)
  // the offer is not the session's yet: the snapshot's picks stand in.
  const canReadFunnels = !!org || isSignedIn === false;
  useEffect(() => {
    if (!brandId || !offer || !answered || !canReadFunnels) return;
    void loadFunnels(brandId, offer.offerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, offer?.offerId, answered, canReadFunnels, styleStrategy]);

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
    if (s.phone) {
      givenPhoneRef.current = s.phone;
      setGivenPhone(s.phone);
      setPhone(s.phone);
    }
    if (s.person) {
      givenPersonRef.current = s.person;
      setGivenPerson(s.person);
      setFirstName(s.person.firstName);
      setLastName(s.person.lastName);
    }
    setBrandId(s.brandId);
    setBrandName(s.brandName);
    setDomain(s.domain);
    setOverview(s.overview);
    setFacts(s.facts);
    setCompetitors(s.competitors);
    setOffer(s.offer);
    setAudience(s.audience);
    if (s.email) setRestoredEmail(s.email);
    if (s.campaign) setCampaignDraft(s.campaign);
    if (s.funnels) setFunnels(s.funnels);
    if (s.lifetimeRevenueUsd != null) setValueInput(String(s.lifetimeRevenueUsd));
    setAnswered(!!s.answered);
    if (s.signalsDone) signalsSaved.current = Promise.resolve();
    if (s.icp) icpRef.current = s.icp;
    setStarted(true);
    ran.current = true;
    const restored: Record<GetStartedStepKey, StepState> = {
      company: "done",
      competitors: s.competitors.length ? "done" : "failed",
      offer: s.offer ? "done" : "failed",
      // No audience yet: it waits for the offer (or its list comes back below), never "Nothing found".
      audience: s.audience ? "done" : "waiting",
      // A snapshot from before this step that went past it counts it as passed.
      signals: s.signalsDone || s.lifetimeRevenueUsd != null ? "done" : "failed",
      value: s.lifetimeRevenueUsd != null ? "done" : "failed",
      levers: s.answered ? "done" : "failed",
      gives: s.answered ? "done" : "failed",
      companies: s.audience ? "running" : "failed",
      email: !emailsShown ? "waiting" : s.campaignDone ? "done" : s.answered && s.audience ? "choose" : "waiting",
      // Opened again from the email step (or straight away when it was confirmed).
      campaign: s.campaignDone ? "done" : s.answered && s.audience ? "choose" : "waiting",
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
    if (s.offer && !s.signalsDone && s.lifetimeRevenueUsd == null) void prepareSignals(s.brandId, s.offer.offerId);
    if (!s.offer) {
      // A reload never asks the model again for a list it already showed (owner 2026-10-24).
      const plan = resumeOfferPlan(s);
      if (plan.kind === "show") showOffers(plan.proposals.items, plan.proposals.main);
      else void prepareOffers(s.brandId);
    }
    if (!s.audience && s.offer && s.audienceProposals) {
      setAudienceProposals(s.audienceProposals);
      setStep("audience", "choose");
    } else if (!s.audience) {
      // The ideal customer is the picked offer's: without a pick, `pickOffer` drafts it.
      if (s.icp && s.offer) {
        setStep("audience", "running");
        proposeAudienceSegments(s.brandId, s.icp)
          .then(({ segments }) => {
            showAudiences(segments);
          })
          .catch((e) => {
            console.error("[get-started] audience proposals failed on resume:", e);
            setStep("audience", "failed");
          });
      } else if (s.offer) void prepareAudiences(s.brandId, s.offer.offerId);
    }
  }

  // The question steps' drafts, read again once the catalogue is in (a resumed walk
  // whose offer was picked but whose answers were not all given).
  useEffect(() => {
    if (!resumed.current || !brandId || !offer || answered || drafted !== "no") return;
    void draftAnswers(brandId, offer.offerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, offer?.offerId, answered, drafted]);

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

  // The `leads` arm never walks the email step: it stays waiting, so the stage never lands on it.
  const setStep = (k: GetStartedStepKey, v: StepState) => {
    if (k === "email" && !emailsShown) return;
    setSteps((cur) => ({ ...cur, [k]: v }));
  };

  /**
   * One step done, with what the visitor entered (owner 2026-10-15: every step stored
   * and on their Unibox thread, through the PostHog connector). The dashboard walk
   * ("Add a brand") is not a visitor's walk: nothing sent from there.
   */
  const periodWord = (p: SignupPeriod) => SIGNUP_PERIODS.find((x) => x.key === p)?.label ?? p;

  function stepDone(step: string, values: Record<string, string | number | boolean | null>) {
    if (org) return;
    const clipped = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 2000) : v]));
    posthog.capture("get_started_step_done", { step, ...clipped });
  }

  // ── Steps 3 and 4, prepared in the background ─────────────────────────────

  /** The proposed offers on screen, and kept in the snapshot so a reload shows the same list. */
  function showOffers(offers: OfferProposal[], mainOfferIndex: number) {
    const main = mainOfferIndex >= 0 && mainOfferIndex < offers.length ? mainOfferIndex : 0;
    setOfferProposals(offers);
    setOfferMain(main);
    if (offers.length) saveSnapshot({ offerProposals: { items: offers, main } });
    setStep("offer", offers.length ? "choose" : "failed");
  }

  /**
   * "Something else" (owner 2026-10-24): the visitor says in their words what they sell.
   * One offer read out of it is picked at once; several are shown to pick from.
   */
  async function proposeOwnOffer(text: string) {
    if (!brandId || offer || pendingOffer) return;
    setOfferError(null);
    setStep("offer", "running");
    try {
      const { offers, mainOfferIndex } = await proposeBrandOffers(brandId, text);
      existingOffers.current = null;
      showOffers(offers, mainOfferIndex);
      posthog.capture("get_started_offer_own", { offers: offers.length });
      if (offers.length === 1) pickOffer(0, offers);
    } catch (e) {
      console.error("[get-started] own offer read failed:", e);
      setStep("offer", "choose");
      setOfferError("We could not read that. Try again in other words.");
    }
  }

  /**
   * The offers the brand sells: brand-service reads the brand's own site in ONE step (owner
   * 2026-10-24), after steps 1-2 saved its pages; a brand with no website, from what was typed.
   */
  async function prepareOffers(id: string) {
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
    const ownWords = ownWordsRef.current;
    try {
      const { offers, mainOfferIndex } = ownWords ? await proposeBrandOffers(id, ownWords) : await proposeBrandOffersFromSite(id);
      showOffers(offers, mainOfferIndex);
    } catch (e) {
      console.error("[get-started] offer proposals failed:", e);
      setStep("offer", "failed");
    }
  }

  /** The proposed audiences on screen, and kept in the snapshot so a reload shows the same list. */
  function showAudiences(segments: AudienceSegmentProposal[]) {
    const shown = segments.slice(0, 6);
    setAudienceProposals(shown);
    if (shown.length) saveSnapshot({ audienceProposals: shown });
    setStep("audience", shown.length ? "choose" : "failed");
  }

  /**
   * "Something else" (owner 2026-10-27): the visitor says in their words who they want to reach.
   * Their words become the ideal customer, split into audiences counted again; one is picked at once.
   */
  async function proposeOwnAudience(text: string) {
    if (!brandId || audience || pendingAudience || audienceBusy != null) return;
    setAudienceError(null);
    setStep("audience", "running");
    try {
      const { segments } = await proposeAudienceSegments(brandId, text);
      icpRef.current = text;
      saveSnapshot({ icp: text });
      estimated.current = false;
      setAudienceCounts({});
      showAudiences(segments);
      posthog.capture("get_started_audience_own", { audiences: segments.length });
      if (segments.length === 1) pickAudience(0, segments);
    } catch (e) {
      console.error("[get-started] own audience read failed:", e);
      setStep("audience", "choose");
      setAudienceError("We could not read that. Try again in other words.");
    }
  }

  /**
   * Who to write to for the offer PICKED at step 3 (owner 2026-10-06: the audiences
   * described the brand's other offer): its ideal customer, split into at most 6 audiences.
   */
  async function prepareAudiences(id: string, offerId: string) {
    setStep("audience", "running");
    try {
      const { icp } = await suggestBrandIcp(id, undefined, undefined, offerId);
      icpRef.current = icp;
      saveSnapshot({ icp });
      const { segments } = await proposeAudienceSegments(id, icp);
      showAudiences(segments);
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
  function pickOffer(i: number, list: OfferProposal[] = offerProposals) {
    if (!brandId || offer || pendingOffer) return;
    const picked = list[i];
    if (!picked) return;
    setOfferError(null);
    setPendingOffer({ name: picked.name, description: picked.description });
    // The audiences are drafted for THIS offer, once it is saved: the step says so meanwhile.
    setStep("audience", "running");
    advance("offer");
    posthog.capture("get_started_offer_picked", { offers: list.length });
    stepDone("offer", { offer: picked.name, description: picked.description });
    const id = brandId;
    const held = existingOffers.current?.find((o) => o.name === picked.name) ?? null;
    const p = (async () => {
      const { chosenOfferId } = held ? { chosenOfferId: held.offerId } : await confirmBrandOffers(id, [picked], 0);
      const next = { offerId: chosenOfferId, name: picked.name, description: picked.description };
      setOffer(next);
      saveSnapshot({ offer: next });
      void draftAnswers(id, chosenOfferId);
      void prepareSignals(id, chosenOfferId);
      void prepareAudiences(id, chosenOfferId);
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
  /**
   * The signals step's checks, prepared while the audience is picked: the offer's own checks when
   * it has some (a reload, a brand that had them), else lead-service suggests them (written off).
   * A failed read leaves the step empty: no signal is required to go on.
   */
  async function prepareSignals(id: string, offerId: string) {
    setSignalsRead("running");
    try {
      const held = await listOfferQualificationCriteria(id, offerId);
      const checks = held.length > 0 ? held : await suggestOfferQualificationCriteria(id, offerId);
      setSignals(checks);
      setSignalTicks(new Set(checks.map((c) => c.id)));
      setSignalRoles(Object.fromEntries(checks.map((c) => [c.id, recommendedRole(c)])));
      setSignalsRead("done");
    } catch (e) {
      console.error("[get-started] signals read failed:", { brandId: id, offerId, e });
      setSignalsRead("failed");
    }
  }

  async function draftAnswers(id: string, offerId: string) {
    setDrafted("running");
    try {
      const fields = [...VALUE_FIELDS, ...LEVER_DRAFT_FIELDS, ...GIVE_DRAFT_FIELDS, SERVICES_DRAFT_FIELD].map((f) => ({ key: f.key, description: f.description }));
      const r = await extractBrandFields([id], fields, { mode: "suggest", urlStrategy: "landing", offerId });
      const usd = parseUsdEstimate(r.fields.clientLifetimeRevenueUsd?.value);
      setValueInput((cur) => cur || (usd != null ? String(usd) : ""));
      setLevers((cur) => fillBlank(cur, LEVER_DRAFT_FIELDS, (k) => valueLines(r.fields[k]?.value).join("\n")));
      setGives((cur) => fillBlank(cur, GIVE_DRAFT_FIELDS, (k) => valueLines(r.fields[k]?.value).join("\n")));
      setDrafted("done");
      // No screen asks for it: saved as drafted so the offer page shows what is sold.
      // One service per offer (owner 2026-10-10): another service is another offer.
      const services = valueLines(r.fields.services?.value).slice(0, 1);
      if (services.length > 0) {
        saveOfferUserFields(id, offerId, { services }).catch((e) =>
          console.error("[get-started] offer services save failed:", { brandId: id, offerId, e }),
        );
      }
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
      if (next.signals !== "done" && cur.audience === "done") {
        next.signals = signalsRead === "done" || signalsRead === "failed" ? "choose" : "running";
      }
      open("value", cur.signals === "done", true);
      open("levers", cur.value === "done", true);
      open("gives", cur.levers === "done", true);
      return JSON.stringify(next) === JSON.stringify(cur) ? cur : next;
    });
  }, [drafted, signalsRead, steps.audience, steps.signals, steps.value, steps.levers]);

  /**
   * The END: the campaign step on the stage (from the email step's button, or the banner). It
   * waits on nothing the visitor did: the funnels are read on load.
   */
  function openCampaign() {
    if (stepRunningBefore(GET_STARTED_STEPS.map((st) => steps[st.key]), stepIndex("campaign"))) {
      setCampaignAsked(true);
      return;
    }
    setCampaignAsked(false);
    if (brandId && offer && canReadFunnels && funnelsState !== "loading") void loadFunnels(brandId, offer.offerId);
    if (emailsShown) {
      setStep("email", "done");
      posthog.capture("get_started_email_style_set", { styles: [...angles], strategy: styleStrategy });
    }
    withStageTransition(() => {
      setSteps((cur) => (cur.campaign === "done" ? cur : { ...cur, campaign: "choose" }));
      setFocus(null);
      setStageIdx(stepIndex("campaign"));
    });
  }

  function changeCampaign(next: SignupCampaignDraft) {
    setCampaignDraft(next);
    setAnswerError(null);
    saveSnapshot({ campaign: next });
  }

  /** Launch: the caps are checked here, written at the launch (after the card), then the wall. */
  function confirmCampaign() {
    const r = signupLaunchPlan(campaignDraft, funnels ?? { proactive: null, reactive: null });
    if ("problem" in r) {
      setAnswerError(r.problem);
      return;
    }
    // The monthly limit (signup only): a typed one under the first charge is refused here.
    if (!org) {
      const limit = monthlyLimitToSave(campaignDraft.monthlyLimit, limitArm);
      if ("problem" in limit) {
        setAnswerError(limit.problem);
        return;
      }
    }
    setAnswerError(null);
    setStep("campaign", "done");
    saveSnapshot({ campaign: campaignDraft, campaignDone: true });
    posthog.capture("get_started_campaign_set", { funnel: r.plan.proactive?.name ?? null, meetings: !!r.plan.reactive });
    stepDone("campaign", {
      campaign: r.plan.proactive?.name ?? "off",
      budget: r.plan.proactive ? `$${campaignDraft.budget} per ${periodWord(campaignDraft.budgetPeriod)}` : "off",
      meeting_booking: r.plan.reactive ? `up to $${campaignDraft.reactiveBudget} per ${periodWord(campaignDraft.reactivePeriod)}` : "off",
      monthly_limit: campaignDraft.monthlyLimit,
    });
    setWallNote(null);
    setWallOpen(true);
  }

  /** The signals step: the ticked checks turned on as mentions, the unticked ones left off. */
  async function confirmSignals() {
    if (!brandId) return;
    setAnswerError(null);
    const ticked = signals.filter((c) => signalTicks.has(c.id));
    stepDone("signals", {
      signals: ticked.map((c) => `${signalRoles[c.id] === "must_pass" ? "Must have" : "Nice to have"}: ${c.question}`).join("\n"),
      signal_count: ticked.length,
      must_have: ticked.filter((c) => signalRoles[c.id] === "must_pass").length,
      offered: signals.length,
    });
    advance("signals");
    saveSnapshot({ signalsDone: true });
    try {
      const save = (async () => {
        const o = await ensureOffer();
        for (const w of signalWrites(signals, signalTicks, signalRoles)) await updateOfferQualificationCriterion(brandId, o.offerId, w.id, w.patch);
      })();
      // Checks asked from now on wait for these ticks; answers to older ticks are dropped.
      checksGen.current += 1;
      checkWaits.current.clear();
      failingRows.current.clear();
      setCompanyChecks({});
      signalsSaved.current = save;
      await save;
      setSignals((cur) => cur.map((c) => (signalTicks.has(c.id) ? { ...c, enabled: true, mode: signalRoles[c.id] ?? c.mode } : { ...c, enabled: false })));
      const aud = audienceRef.current;
      if (aud) void checkCompanies(rowsRef.current[aud.audienceId] ?? []);
      // Signals changed after the examples were written: written again on the next click.
      setExamples({});
    } catch (e) {
      console.error("[get-started] signals save failed:", e);
      saveSnapshot({ signalsDone: false });
      reopen("signals", "We could not save your signals. Try again.");
    }
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
    stepDone("client_value", { client_value_usd: parsed.usd });
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
    stepDone("offer_points", Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, Array.isArray(v) ? v.join("\n") : v ?? ""])));
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
    // Edited after the emails were asked: those are asked again (only a changed list costs a write).
    const edit = answeredRef.current;
    stepDone("gives", { give_for_free: answerLines(gives.giveForFree).join("\n"), never_give: answerLines(gives.neverGive).join("\n") });
    advance("gives");
    try {
      const o = await ensureOffer();
      await saveOfferUserFields(brandId, o.offerId, {
        giveForFree: answerLines(gives.giveForFree),
        neverGive: answerLines(gives.neverGive),
      });
      if (edit) {
        // The examples were written from the old lists: written again on the next click.
        setExamples({});
        return;
      }
      // The emails are written from these: the last input they need, so all of them start now.
      setAnswered(true);
      answeredRef.current = true;
      saveSnapshot({ answered: true });
      posthog.capture("get_started_answers_done");
      const held = pendingPrewrite.current;
      if (held && audienceRef.current?.audienceId === held.aud.audienceId) {
        pendingPrewrite.current = null;
        openEmailStyle();
      }
    } catch (e) {
      console.error("[get-started] give lists save failed:", e);
      reopen("gives", "We could not save these lists. Try again.");
    }
  }

  useEffect(() => {
    if (!brandId || !offer || audienceProposals.length === 0 || estimated.current) return;
    estimated.current = true;
    setEstimating(true);
    estimateAudienceSegments(brandId, offer.offerId, audienceProposals)
      .then(({ estimates }) => {
        const counts: Record<string, number> = {};
        for (const e of estimates) {
          if (e.estimatedPeople != null) counts[e.name] = e.estimatedPeople;
          else console.error("[get-started] audience estimate unavailable:", e.name, e.unavailableReason);
        }
        setAudienceCounts(counts);
      })
      .catch((e) => console.error("[get-started] audience estimate failed:", e))
      .finally(() => setEstimating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, offer?.offerId, audienceProposals]);

  /** Step 4: the ONE audience picked moves the walk on at once; it is created (or found) behind it. */
  function pickAudience(i: number, list: AudienceSegmentProposal[] = audienceProposals) {
    if (!brandId || audienceBusy != null) return;
    if (!offer && !offerPromise.current) return;
    const seg = list[i];
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
        posthog.capture("get_started_audience_picked", { audiences: list.length });
        stepDone("audience", { audience: seg.name, description: seg.description ?? "", who_they_sell_to: icpRef.current });
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
      setExamples({});
      setExampleErrors({});
      setSteps((cur) => ({
        ...cur,
        audience: "done",
        companies: loaded ? "done" : "running",
        email: loaded ? cur.email : "waiting",
      }));
    });
    saveSnapshot({ audience: next });
  }

  // ── Step 5: the companies ──────────────────────────────────

  useEffect(() => {
    if (audience) wantRows(audience, PREVIEW_COMPANIES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience?.audienceId]);

  /** Asks for at least `n` rows of an audience; the loader builds up to that and stops. */
  function wantRows(aud: GetStartedAudience, n: number) {
    const id = aud.audienceId;
    wanted.current.set(id, Math.max(n, wanted.current.get(id) ?? 0));
    if (exhausted.current.has(id) || loading.current.has(id)) return;
    if ((rowCount.current.get(id) ?? 0) >= (wanted.current.get(id) ?? 0)) return;
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
      while (offset < (wanted.current.get(id) ?? PREVIEW_COMPANIES)) {
        const limit = (wanted.current.get(id) ?? PREVIEW_COMPANIES) - offset;
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
          exhausted.current.add(id);
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
        // The signals run on every company as soon as it is listed (answers ready by the emails).
        void checkCompanies(got);
        if (first && got.length) {
          first = false;
          if (audienceRef.current?.audienceId === id) {
            setStep("companies", "done");
            // The email style step opens once the answers exist (its examples are written from them).
            if (answeredRef.current) openEmailStyle();
            else pendingPrewrite.current = { aud, rows: got };
          }
        }
        if (page.done || page.nextOffset == null || got.length === 0) exhausted.current.add(id);
        if (page.nextOffset == null || exhausted.current.has(id) || offset + got.length >= (wanted.current.get(id) ?? PREVIEW_COMPANIES)) {
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
      exhausted.current.add(id);
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

  /**
   * Runs the offer's signals on listed companies not asked yet (lead-service, billed to this
   * org), in one call per batch, after the visitor's ticks are saved. Each company's answer is
   * awaited by its email (`checkOf`). A failed run is logged and the emails are written without
   * it: the preview never stops on a check.
   */
  function checkCompanies(list: AudienceCompanyRow[]): void {
    const saved = signalsSaved.current;
    if (!saved || !brandId) return;
    const gen = checksGen.current;
    const fresh = new Map<string, string>();
    for (const r of list) {
      if (!r.company.domain) continue;
      const d = checkDomain(r.company.domain);
      if (d && !checkWaits.current.has(d) && !fresh.has(d)) fresh.set(d, r.company.name);
    }
    if (fresh.size === 0) return;
    const run = (async () => {
      await saved;
      const o = await ensureOffer();
      const companies = [...fresh].map(([domain, name]) => ({ domain, name }));
      let preview = await startQualificationPreview(brandId, o.offerId, companies);
      for (let i = 0; preview.status === "running" && i < 100; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        preview = await getQualificationPreview(brandId, o.offerId, preview.id);
      }
      if (preview.status !== "completed") console.error("[get-started] signals preview did not complete:", { status: preview.status, error: preview.error });
      const byDomain: Record<string, QualificationPreviewCompany> = {};
      for (const c of preview.companies) byDomain[checkDomain(c.domain)] = c;
      if (gen === checksGen.current) {
        setCompanyChecks((cur) => ({ ...cur, ...byDomain }));
        // A listed company failing a Must have: one more company is listed in its place (capped).
        const aud = audienceRef.current;
        const listed = aud ? rowsRef.current[aud.audienceId] ?? [] : [];
        if (aud) {
          const failing = failingRows.current.get(aud.audienceId) ?? new Set<number>();
          for (const r of list) {
            const mine = listed.some((x) => x.index === r.index && x.company.domain === r.company.domain);
            if (mine && r.company.domain && byDomain[checkDomain(r.company.domain)]?.mustPass.state === "fails") failing.add(r.index);
          }
          failingRows.current.set(aud.audienceId, failing);
          if (failing.size) wantRows(aud, companiesWanted(PREVIEW_COMPANIES, failing.size));
        }
      }
      return byDomain;
    })();
    for (const d of fresh.keys())
      checkWaits.current.set(
        d,
        run.then(
          (m) => m[d] ?? null,
          (e) => {
            console.error("[get-started] signals check failed:", { domain: d, e });
            return null;
          },
        ),
      );
  }

  /** A row's signal answers, once ready (null: no signals, no domain, or the run failed). */
  async function checkOf(row: AudienceCompanyRow): Promise<QualificationPreviewCompany | null> {
    if (!row.company.domain || !signalsSaved.current) return null;
    const d = checkDomain(row.company.domain);
    if (!checkWaits.current.has(d)) checkCompanies([row]);
    return (await checkWaits.current.get(d)) ?? null;
  }

  /** A company failing a Must have, as the page shows it (no person, no email). */
  function failsMustHave(row: AudienceCompanyRow): boolean {
    return !!row.company.domain && companyChecks[checkDomain(row.company.domain)]?.mustPass.state === "fails";
  }

  // Every company listed fails a Must have and no other can be asked: no email will come, so the
  // step stops writing and says why (QA 2026-10-17: it said "Writing" for minutes).
  const listed = audience ? rows[audience.audienceId] ?? [] : [];
  const noneFits =
    !!audience &&
    listed.length > 0 &&
    listed.every((r) => failsMustHave(r)) &&
    !loadingMore[audience.audienceId] &&
    (listed.length >= MAX_CHECKED_COMPANIES || exhausted.current.has(audience.audienceId));
  useEffect(() => {
    if (noneFits) setStep("email", "failed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noneFits]);

  // ── Step 6: the emails ───────────────────────────────────────────────────

  /** The email style step opens (`emails` arm only): companies found and the answers in. */
  function openEmailStyle() {
    if (!emailsShown) return;
    setStep("email", "choose");
  }

  /** The lead every example is written for: the first listed person who meets the Must haves. */
  function exampleRow(): AudienceCompanyRow | null {
    const aud = audienceRef.current;
    if (!aud) return null;
    return (rows[aud.audienceId] ?? []).find((r) => rowWritable(r) && !failsMustHave(r)) ?? null;
  }

  /** One example of a style, for the first lead (content-generation, billed to this anonymous org). */
  async function writeExample(angle: EmailAngle): Promise<void> {
    const aud = audienceRef.current;
    setExampleShown(angle);
    if (!aud || !exampleRow() || !brandId || !answeredRef.current || examples[angle] || exampleBusy[angle]) return;
    setExampleBusy((cur) => ({ ...cur, [angle]: true }));
    setExampleErrors((cur) => ({ ...cur, [angle]: undefined }));
    try {
      // The first listed person whose company meets every Must have (its check may still be running).
      let row: AudienceCompanyRow | null = null;
      let check: QualificationPreviewCompany | null = null;
      for (const r of (rows[aud.audienceId] ?? []).filter(rowWritable)) {
        check = await checkOf(r);
        if (check?.mustPass.state !== "fails") {
          row = r;
          break;
        }
      }
      if (!row) throw new Error("[get-started] no listed company meets every Must have");
      const lead = row;
      const mail = await writeWithRetry(() =>
        previewColdEmail({
          brandId,
          recipient: {
            firstName: lead.person.firstName!,
            lastName: lead.person.lastNameObfuscated || lead.person.firstName!.slice(0, 1),
            title: lead.person.title!,
            companyName: lead.company.name,
            ...(lead.company.domain ? { companyDomain: lead.company.domain } : {}),
          },
          audience: aud.name,
          offerId: offer?.offerId ?? snapRef.current?.offer?.offerId ?? null,
          ...(check ? { qualification: check.qualification } : {}),
          strategyId: EMAIL_ANGLES.find((a) => a.key === angle)!.only,
        }),
      );
      setExamples((cur) => ({ ...cur, [angle]: mail }));
      if (!snapRef.current?.email) saveSnapshot({ email: { subject: mail.subject, bodyText: mail.bodyText, recipient: mail.recipient } });
    } catch (e) {
      console.error("[get-started] email example failed:", { angle, e });
      setExampleErrors((cur) => ({
        ...cur,
        [angle]:
          e instanceof ApiError && e.status === 402
            ? "Your free preview credit is used up. Your emails are written once your account is set up."
            : "We could not write this example just now. Try again.",
      }));
    } finally {
      setExampleBusy((cur) => ({ ...cur, [angle]: false }));
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

  // The held "Set up my campaign" press: done once nothing before the campaign runs.
  useEffect(() => {
    if (campaignAsked && !stepRunningBefore(phases, stepIndex("campaign"))) openCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignAsked, phaseKey]);

  // One short Telegram line to the owner at each step of the walk (lib/owner-ping.ts):
  // the site entered, each step the stage reaches, the payment wall. Once per step per
  // page load; a reload resumes and says so again, which is news too.
  const pinged = useRef(new Set<string>());
  const pingHost = domain ?? (website ? hostOf(websiteUrl(website)) : null);
  useEffect(() => {
    if (!started) return;
    const once = (key: string, send: () => void) => {
      if (pinged.current.has(key)) return;
      pinged.current.add(key);
      send();
    };
    once("started", () => pingOwner({ event: "started", domain: pingHost }));
    const st = GET_STARTED_STEPS[stageIdx];
    once(`step:${st.key}`, () =>
      pingOwner({ event: "step", domain: pingHost, step: { label: st.label, index: stageIdx + 1, total: GET_STARTED_STEPS.length } }),
    );
    if (wallOpen) once("wall", () => pingOwner({ event: "wall", domain: pingHost }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, stageIdx, wallOpen]);

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

  /** Next from a step opened to look back: the step after it, or the live step once there. */
  function goForward(from: GetStartedStepKey) {
    const next = stepIndex(from) + 1;
    withStageTransition(() => setFocus(next >= stageIdx ? null : GET_STARTED_STEPS[next].key));
  }

  /** Opens a finished step on the stage; the walk takes over again when it moves on. */
  function openStep(key: GetStartedStepKey) {
    const idx = GET_STARTED_STEPS.findIndex((s) => s.key === key);
    withStageTransition(() => setFocus(idx === stageIdx ? null : key));
  }

  async function start(raw: string, chosen = false) {
    if (ran.current) return;
    const problem = websiteInputProblem(raw);
    if (problem || !raw.trim()) {
      setInputError(problem ?? "Enter your website.");
      return;
    }
    // Optional: an empty number passes, a typed one must be a number.
    const phoneProblem = org ? null : phoneSyntaxProblem(phone);
    if (phoneProblem) {
      setPhoneError(phoneProblem);
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
    setInputError(null);
    setExits(null);
    if (!org && !chosen) {
      recordVisitor(raw);
      setSetup({ raw, view: "choose" });
      return;
    }
    ran.current = true;
    setStarted(true);
    setStep("company", "running");
    const url = websiteUrl(raw);
    // A brand added from the dashboard is not a visit (the visit was recorded at the choice).
    if (org) posthog.capture("brand_walk_website_submitted", { org_id: org.orgId });
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
    await createAndWalk(url);
  }

  /**
   * The visitor becomes a lead the moment they press Start (owner 2026-10-15): what they
   * typed goes on their PostHog person, which crm-service's PostHog connector (the same
   * one any client plugs) turns into a person in the Unibox. Remembered for a later walk.
   */
  function recordVisitor(raw: string) {
    const typed = raw.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
    posthog.setPersonProperties({ website: typed });
    // `website` also feeds the owner's Telegram visit recap (lib/visit-recap.ts).
    posthog.capture("get_started_website_submitted", { website: typed });
    const given = phone.national.trim() ? { ...phone, national: phone.national.trim() } : null;
    givenPhoneRef.current = given;
    setGivenPhone(given);
    if (given) {
      // The number reaches crm-service through the PostHog connector, the same one any
      // client plugs: a WhatsApp campaign greets them before any account exists.
      posthog.setPersonProperties({ phone: toE164(given) });
      posthog.capture("get_started_phone_given", { country: given.countryCode });
    }
    const person = nameOf(firstName, lastName);
    givenPersonRef.current = person;
    setGivenPerson(person);
    if (person) {
      // Same PostHog person as the number, so the greeting can use their first name.
      posthog.setPersonProperties({
        ...(person.firstName ? { first_name: person.firstName } : {}),
        ...(person.lastName ? { last_name: person.lastName } : {}),
        name: [person.firstName, person.lastName].filter(Boolean).join(" "),
      });
      posthog.capture("get_started_name_given");
    }
    if (given || person) {
      try {
        localStorage.setItem(GET_STARTED_YOU_KEY, JSON.stringify({ person, phone: given }));
      } catch (e) {
        console.error("[get-started] name and number not remembered:", e);
      }
    }
  }

  /** The brand behind the website, then the walk's reads. */
  async function createAndWalk(url: string) {
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
      phone: givenPhoneRef.current,
      person: givenPersonRef.current,
    };
    saveSnapshot({});
    setSteps((cur) => ({ ...cur, competitors: "running", offer: "running", audience: "running" }));

    // ONE extraction reads steps 1 and 2; then brand-service reads the offers off the same
    // site (its saved pages). The audiences wait for the offer picked.
    const siteRead = (async () => {
      if (!url) {
        const ov = (ownWords ?? "").trim();
        setOverview(ov);
        setStep("company", ov ? "done" : "failed");
        setStep("competitors", "failed");
        saveSnapshot({ overview: ov });
        ownWordsRef.current = ov || null;
        return;
      }
      try {
        const r = await extractBrandFields([id], [...COMPANY_FIELDS, ...COMPETITOR_FIELDS], {
          mode: "suggest",
          urlStrategy: "landing",
        });
        const ov = valueText(r.fields.companyOverview?.value);
        const fs = valueLines(r.fields.companyFacts?.value).slice(0, 4);
        const list = parseCompetitors(r.fields.competitorsWithDomains?.value, host ?? "");
        setOverview(ov);
        setFacts(fs);
        setCompetitors(list);
        setStep("company", ov || fs.length ? "done" : "failed");
        setStep("competitors", list.length ? "done" : "failed");
        saveSnapshot({ overview: ov, facts: fs, competitors: list });
      } catch (e) {
        console.error("[get-started] company read failed:", e);
        setStep("company", "failed");
        setStep("competitors", "failed");
      }
    })();
    await siteRead;
    // The offers are drafted from what the read stored; the audiences wait for the
    // offer picked out of them (`pickOffer`), so they describe who buys THAT offer.
    await prepareOffers(id);
    posthog.capture("get_started_preview_ready");
  }

  // The campaign step opens once the preview is complete (offer, audience, answers); its Launch
  // opens the wall on the plan it checked.
  const readyForCampaign = started && !!brandId && !!offer && !!audience && answered;
  const launchPlan = useMemo(() => {
    const r = signupLaunchPlan(campaignDraft, funnels ?? { proactive: null, reactive: null });
    return "plan" in r ? r.plan : null;
  }, [campaignDraft, funnels]);
  const canLaunch = readyForCampaign && steps.campaign === "done" && !!launchPlan;
  const current = useMemo(() => GET_STARTED_STEPS.findIndex((s) => steps[s.key] === "running"), [steps]);

  const orgBar = org ? <OrgBar orgId={org.orgId} snapshotKey={snapshotKey} started={started} /> : null;

  if (!started && setup) {
    return (
      <SetupChoice
        view={setup.view}
        prompt={aiSetupPrompt({
          website: setup.raw.trim().replace(/^https?:\/\//i, "").replace(/\/$/, ""),
          person: givenPerson,
          phoneE164: givenPhone ? toE164(givenPhone) : null,
        })}
        onAi={() => {
          posthog.capture("get_started_setup_chosen", { mode: "ai" });
          setSetup({ ...setup, view: "ai" });
        }}
        onCopied={() => posthog.capture("get_started_ai_prompt_copied")}
        onManual={() => {
          posthog.capture("get_started_setup_chosen", { mode: "manual" });
          const raw = setup.raw;
          setSetup(null);
          void start(raw, true);
        }}
        onBack={() => (setup.view === "ai" ? setSetup({ ...setup, view: "choose" }) : setSetup(null))}
      />
    );
  }

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
        phone={org ? null : phone}
        person={org ? null : { firstName, lastName }}
        onPerson={(v) => {
          setFirstName(v.firstName);
          setLastName(v.lastName);
        }}
        onPhone={(v) => {
          setPhone(v);
          setPhoneError(null);
        }}
        onPhoneBlur={() => setPhoneError(phone.national.trim() ? phoneSyntaxProblem(phone) : null)}
        phoneError={phoneError}
        error={inputError}
        exits={exits}
      />
    );
  }

  const stagedKey: GetStartedStepKey = focus ?? GET_STARTED_STEPS[stageIdx].key;
  const audRows = audience ? rows[audience.audienceId] ?? [] : [];
  const writtenCount = Object.keys(examples).length;
  const PICK_LINES: Partial<Record<GetStartedStepKey, string>> = {
    offer: "Pick the offer to sell first.",
    audience: "Pick who to write to first.",
    signals: "Keep the signals you want, then continue.",
    value: "Tell us what one client is worth.",
    levers: "Check your offer, then continue.",
    gives: armCopy.givesPick,
    email: "Pick your email style, then set up your campaign.",
    campaign: "Set your budget, then launch.",
  };
  const pick = steps[stagedKey] === "choose" ? PICK_LINES[stagedKey] ?? null : null;
  const journal: JournalData = {
    steps,
    walk: walkSteps(gsArm),
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
    campaignLine:
      steps.campaign === "done" && launchPlan
        ? [launchPlan.proactive, launchPlan.reactive]
            .filter((f) => f != null)
            .map((f) => `${f.name}, $${f.caps.maxBudget.amountCents / 100} a ${SIGNUP_PERIODS.find((p) => p.key === f.caps.maxBudget.period)?.label ?? "day"}`)
            .join(" + ")
        : null,
    lifetimeRevenue: valueInput,
    signalCount: steps.signals === "done" ? signals.filter((c) => signalTicks.has(c.id)).length : null,
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
          onOwn={(text) => void proposeOwnOffer(text)}
          onRetry={() => brandId && void prepareOffers(brandId)}
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
          counting={estimating || (!estimated.current && !!offerPromise.current)}
          waitingForOffer={!offer && !pendingOffer}
          onPick={(i) => void pickAudience(i)}
          onOwn={(text) => void proposeOwnAudience(text)}
          onRetry={() => brandId && offer && void prepareAudiences(brandId, offer.offerId)}
        />
      );
    if (key === "campaign")
      return (
        <CampaignStage
          state={steps.campaign}
          funnels={funnels}
          failed={funnelsState === "failed"}
          loading={funnelsState === "loading"}
          lineOf={(slug) => channelLines.get(slug) ?? null}
          draft={campaignDraft}
          onChange={changeCampaign}
          limitPrefillUsd={org ? null : DEFAULT_MONTHLY_LIMIT_USD}
          error={steps.campaign === "choose" ? answerError : null}
          onRetry={() => brandId && offer && void loadFunnels(brandId, offer.offerId)}
          onLaunch={confirmCampaign}
        />
      );
    if (key === "signals")
      return (
        <SignalsStage
          state={steps.signals}
          checks={signals}
          ticked={signalTicks}
          roles={signalRoles}
          onRole={(id, role) => setSignalRoles((cur) => ({ ...cur, [id]: role }))}
          onToggle={(id) =>
            setSignalTicks((cur) => {
              const next = new Set(cur);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          error={steps.signals === "choose" ? answerError : null}
          onContinue={() => void confirmSignals()}
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
          offerName={offer?.name ?? ""}
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
          note={audience ? rowsNote[audience.audienceId] ?? null : null}
          unmet={unmetOf}
        />
      );
    return (
      <EmailStyleStage
        state={steps.email}
        lead={exampleRow()}
        noneFits={noneFits}
        ticked={angles}
        onToggle={(a) => setAngles((cur) => toggleAngle(cur, a))}
        shown={exampleShown}
        examples={examples}
        busy={exampleBusy}
        errors={exampleErrors}
        onExample={(a) => void writeExample(a)}
      />
    );
  }

  /** The Must haves a row's company does not meet, or null (passes, unchecked, or still checking). */
  function unmetOf(row: AudienceCompanyRow): string | null {
    if (!failsMustHave(row) || !row.company.domain) return null;
    return unmetSignals(companyChecks[checkDomain(row.company.domain)]?.mustPass.failed ?? []);
  }

  return (
    <div className="k-canvas min-h-[100dvh] lg:flex lg:h-[100dvh] lg:flex-col">
      {orgBar}
      {readyForCampaign && (
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
              disabled={campaignAsked}
              onClick={() => {
                if (!canLaunch) return openCampaign();
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
            <Stepper steps={steps} staged={stagedKey} nextLit={emailsShown ? steps.email === "done" : steps.companies === "done"} />
            <LiveStatus current={current} domain={domain} pick={pick} readFailed={steps.company === "failed"} />
            <div className="mt-4">
              <JournalStrip {...journal} />
            </div>

            <div key={stagedKey} className="gs-in mt-4" style={{ viewTransitionName: stepViewName(stagedKey) }}>
              <BackContext.Provider value={previousStep(stagedKey) ? () => goBack(stagedKey) : null}>
                <NextContext.Provider value={focus ? () => goForward(focus) : null}>{stageFor(stagedKey)}</NextContext.Provider>
              </BackContext.Provider>
            </div>

            {readyForCampaign && stagedKey === (emailsShown ? "email" : "companies") && (
              <div className="gs-in mt-6 flex justify-end" style={{ animationDelay: "200ms" }}>
                <button type="button" className="k-btn-accent h-9 px-4" onClick={openCampaign} disabled={campaignAsked}>
                  {campaignAsked ? "Finding your companies..." : "Set up my campaign"}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {wallOpen && brandId && offer && audience && launchPlan && org && (
        <OrgLaunch
          orgId={org.orgId}
          brandId={brandId}
          website={website.trim() ? websiteUrl(website) : ""}
          offer={offer}
          targetAudience={icpRef.current}
          note={wallNote}
          plan={launchPlan}
          answered={answered}
          snapshotKey={snapshotKey}
          onClose={() => setWallOpen(false)}
        />
      )}
      {/* Back from Google (`resume=1`): the wall waits on the funnels read to name the
          campaign. Until then a plain veil, never the email preview behind it (owner
          2026-10-06: "it sends me back to the email check"). A failed read drops the
          veil: the page states it with its retry. */}
      {wallOpen && !org && brandId && offer && audience && !launchPlan && funnelsState !== "failed" && (
        <div
          role="status"
          className="v2-root gs-scrim fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_oklab,var(--bg-canvas)_35%,transparent)] backdrop-blur-[6px]"
        >
          <div className="k-popover grid w-[280px] gap-2 p-5">
            <p className="k-fg2 text-[13px]">Setting up your account...</p>
            <span className="block h-1 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden="true">
              <span className="k-indeterminate block h-full w-1/3 rounded-full bg-[var(--accent)]" />
            </span>
          </div>
        </div>
      )}
      {wallOpen && brandId && offer && audience && launchPlan && !org && (
        <AccountCardWall
          ipCountry={ipCountry}
          earlyPhone={givenPhone}
          earlyName={givenPerson}
          brandId={brandId}
          website={websiteUrl(website)}
          brandName={brandName ?? domain ?? website}
          offer={offer}
          audience={audience}
          targetAudience={icpRef.current}
          note={wallNote}
          email={(exampleShown ? examples[exampleShown] : undefined) ?? Object.values(examples)[0] ?? restoredEmail}
          plan={launchPlan}
          monthlyLimit={campaignDraft.monthlyLimit}
          outlook={chosenFunnelOutlook(launchPlan?.proactive ? (funnels?.proactive ?? null) : null)}
          answered={answered}
          onClose={() => setWallOpen(false)}
        />
      )}
    </div>
  );
}

/** The signup walk's snapshot when it names this brand (kept like an org walk's, 30 days). */
function signupSnapshotFor(brandId: string): GetStartedSnapshot | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(GET_STARTED_SNAPSHOT_KEY);
  } catch (e) {
    console.error("[get-started] signup snapshot read failed:", e);
  }
  const snap = parseGetStartedSnapshot(raw);
  if (!snap || snap.brandId !== brandId) return null;
  return snapshotResumable(snap, Date.now(), GET_STARTED_ORG_RESUME_MAX_AGE_MS) ? snap : null;
}

function initialSteps(): Record<GetStartedStepKey, StepState> {
  return {
    company: "waiting",
    competitors: "waiting",
    offer: "waiting",
    audience: "waiting",
    signals: "waiting",
    value: "waiting",
    levers: "waiting",
    gives: "waiting",
    companies: "waiting",
    email: "waiting",
    campaign: "waiting",
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

function companiesNote(reason: string | null): string {
  if (reason === "no_match") return "We found no company matching this audience. Pick another one.";
  if (reason === "not_built_yet") return "This audience is still being prepared. Come back in a minute, or pick another one.";
  return "The companies of this audience cannot be listed for free. Pick another one.";
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Hero({
  top,
  onWithoutWebsite,
  website,
  onWebsite,
  onSubmit,
  phone,
  onPhone,
  onPhoneBlur,
  phoneError,
  person,
  onPerson,
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
  /** The public walk's optional WhatsApp number; null from the dashboard (no phone there). */
  phone: PhoneValue | null;
  onPhone: (v: PhoneValue) => void;
  onPhoneBlur: () => void;
  phoneError: string | null;
  /** The public walk's optional first and last name; null from the dashboard. */
  person: GetStartedName | null;
  onPerson: (v: GetStartedName) => void;
  error: string | null;
  exits: RefusalExits | null;
}) {
  const arm = useContext(GsArmContext);
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
          {inOrg ? "Type its website. See 5 of them in a minute." : "Type your website. See 5 of them in a minute. No account needed."}
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
        {phone && (
          <form
            className="gs-in mt-4"
            style={{ animationDelay: "210ms" }}
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {person && (
              <>
                <p className="k-fg mb-1.5 text-[13px] font-medium">
                  Your name <span className="k-fg3 font-normal">(optional)</span>
                </p>
                <div className="k-card mb-4 grid grid-cols-2 gap-2 p-2">
                  <input
                    className="k-input min-w-0"
                    style={{ paddingLeft: 12, paddingRight: 12 }}
                    placeholder="First name"
                    aria-label="First name"
                    autoComplete="given-name"
                    value={person.firstName}
                    onChange={(e) => onPerson({ ...person, firstName: e.target.value })}
                  />
                  <input
                    className="k-input min-w-0"
                    style={{ paddingLeft: 12, paddingRight: 12 }}
                    placeholder="Last name"
                    aria-label="Last name"
                    autoComplete="family-name"
                    value={person.lastName}
                    onChange={(e) => onPerson({ ...person, lastName: e.target.value })}
                  />
                </div>
              </>
            )}
            <p className="k-fg mb-1.5 text-[13px] font-medium">
              Your WhatsApp <span className="k-fg3 font-normal">(optional)</span>
            </p>
            <div className="k-card p-2">
              <PhoneField value={phone} onChange={onPhone} onBlur={onPhoneBlur} problem={phoneError} disabled={false} autoFocus={false} compact />
            </div>
            <p className="k-fg3 mt-1.5 text-[12px]">We message you there if you need a hand.</p>
          </form>
        )}
        {onWithoutWebsite && (
          <button type="button" className="k-btn-ghost -ml-2 mt-2 h-7 text-[12px]" onClick={() => setNoSite((v) => !v)}>
            {noSite ? "This brand has a website" : "This brand has no website"}
          </button>
        )}
        <ol className={`gs-in mt-5 grid gap-2 ${GS_ARM_COPY[arm].promise.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} style={{ animationDelay: "240ms" }} aria-label="What you will see">
          {GS_ARM_COPY[arm].promise.map((label, i) => (
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
 * After the first page (owner 2026-10-15): two big choices. "With my AI" hands over one
 * message to paste into their own AI (it connects our MCP and opens the account);
 * "Myself" runs the walk here.
 */
function SetupChoice({
  view,
  prompt,
  onAi,
  onCopied,
  onManual,
  onBack,
}: {
  view: "choose" | "ai";
  prompt: string;
  onAi: () => void;
  onCopied: () => void;
  onManual: () => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      onCopied();
    } catch (e) {
      console.error("[get-started] AI instructions not copied:", e);
    }
  }
  return (
    <div className="k-canvas relative flex min-h-[100dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-[560px]">
        <p className="k-label gs-in">distribute.you</p>
        <h1 className="gs-in k-fg mt-3 text-[28px] font-medium leading-9 tracking-[-0.01em]">
          {view === "ai" ? "Paste this into your AI." : "How do you want to set up?"}
        </h1>
        {view === "choose" ? (
          <div className="gs-in mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" style={{ animationDelay: "60ms" }}>
            <button type="button" onClick={onAi} className="k-card flex min-h-[148px] flex-col items-start gap-3 p-5 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ background: "color-mix(in oklch, var(--data-teal) 16%, transparent)", color: "var(--data-teal)" }}>
                <RobotIcon weight="duotone" className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="k-fg text-[16px] font-medium">With my AI</span>
              <span className="k-fg2 text-[13px] leading-5">Paste one message into Claude Code, Codex or ChatGPT.</span>
            </button>
            <button type="button" onClick={onManual} className="k-card flex min-h-[148px] flex-col items-start gap-3 p-5 text-left">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ background: "color-mix(in oklch, var(--accent) 16%, transparent)", color: "var(--accent)" }}>
                <HandWavingIcon weight="duotone" className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="k-fg text-[16px] font-medium">Myself</span>
              <span className="k-fg2 text-[13px] leading-5">Step by step, right here.</span>
            </button>
          </div>
        ) : (
          <div className="gs-in mt-6" style={{ animationDelay: "60ms" }}>
            <pre className="k-inset k-fg2 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[12px] p-4 text-[13px] leading-5">{prompt}</pre>
            <button type="button" onClick={() => void copy()} className="k-btn-accent k-cta mt-4 flex w-full items-center justify-center">
              {copied ? "Copied. Paste it into your AI." : "Copy instructions"}
            </button>
            <button type="button" onClick={onManual} className="k-btn-ghost -ml-2 mt-3 h-7 text-[12px]">
              Set up myself instead
            </button>
          </div>
        )}
        <div className="mt-4">
          <BackLink onBack={onBack} />
        </div>
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
 * The marks only SHOW where the walk is: moving is Back and Continue on each step
 * (owner 2026-10-24, reversing the clickable marks of 2026-10-12: a visitor opened
 * step 4 before picking an offer and read "Nothing found").
 */
function Stepper({
  steps,
  staged,
  nextLit,
}: {
  steps: Record<GetStartedStepKey, StepState>;
  staged: GetStartedStepKey;
  nextLit: boolean;
}) {
  const arm = useContext(GsArmContext);
  const walk = walkSteps(arm);
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:gap-5">
      <ol className="flex min-w-0 flex-1 items-center" aria-label="Progress">
        {walk.map((s, i) => {
          const st = steps[s.key];
          const active = s.key === staged;
          const prevSettled = i > 0 && settled(steps[walk[i - 1].key]);
          const mark = (
            <>
              <StepMark index={i + 1} state={st} />
              {active ? <span key={s.key} className="gs-in hidden whitespace-nowrap sm:inline">{s.label}</span> : <span className="sr-only">{s.label}</span>}
            </>
          );
          const cls = `inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full text-[12px] ${
            active ? "k-card gs-glow k-fg px-1.5 font-medium sm:px-2.5" : settled(st) ? "k-fg2" : "k-fg3"
          }`;
          return (
            <li key={s.key} className={`flex items-center ${i > 0 ? "flex-1" : ""}`} aria-current={active ? "step" : undefined}>
              {i > 0 && (
                <span className="relative mx-1 h-px min-w-1 flex-1 overflow-hidden bg-[var(--line)] sm:mx-2 sm:min-w-2" aria-hidden="true">
                  <span className="gs-fill absolute inset-y-0 left-0 bg-[var(--bg-strong)]" style={{ width: prevSettled ? "100%" : "0%" }} />
                </span>
              )}
              <span className={cls}>{mark}</span>
            </li>
          );
        })}
      </ol>
      {/* A phone has no room for the name inside the pill: ten marks already fill 320px. */}
      <p key={staged} className="gs-in k-fg -mt-1 text-[12px] font-medium sm:hidden" aria-hidden="true">
        {GET_STARTED_STEPS.find((s) => s.key === staged)?.label}
      </p>
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
                {walk.length + i + 1}
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
  signals: () => "Finding the signals that lift your replies",
  value: () => "Estimating what a client is worth to you",
  levers: () => "Drafting your offer from your site",
  gives: () => "Drafting what you could give away",
  companies: () => "Finding companies that match, with the right person at each",
  email: () => "Writing your example email. The first one takes about a minute and a half.",
  campaign: () => "Picking the campaign with the best return",
};

/**
 * What is being worked on right now, and for how long, or the pick the stage is
 * waiting on. Every line names a real step.
 */
function LiveStatus({
  current,
  domain,
  pick,
  readFailed,
}: {
  current: number;
  domain: string | null;
  pick: string | null;
  /** The site read failed: nothing below was drafted from it, so nothing is "ready" (owner 2026-10-06). */
  readFailed: boolean;
}) {
  const key = pick ? null : current >= 0 ? GET_STARTED_STEPS[current].key : null;
  const secs = useElapsed(key);
  return (
    <p key={pick ? `pick:${pick}` : key ?? "ready"} className="gs-in mt-4 flex min-h-5 items-center gap-2 text-[13px]">
      {pick ? (
        <span className="gs-pop h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
      ) : !key && readFailed ? (
        <span className="gs-pop h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-rose)]" />
      ) : key ? (
        <span className="k-dot-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--run)] text-[var(--run)]" />
      ) : (
        <span className="gs-pop h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-teal)]" />
      )}
      <span className="k-fg2 min-w-0" aria-live="polite">
        {pick ??
          (key
            ? STATUS[key](domain)
            : readFailed
              ? `We could not read ${domain ?? "your site"}. Check the address and try again.`
              : "Your preview is ready.")}
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
/**
 * Forward from a finished step opened from the stepper or the rail, or null on the live
 * step. A finished step draws no Continue of its own, so without it a person who went
 * back had no way forward (owner 2026-10-12).
 */
const NextContext = createContext<(() => void) | null>(null);

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
  const onNext = useContext(NextContext);
  return (
    <section className={`gs-fade k-card relative overflow-hidden p-4 ${state === "waiting" ? "translate-y-0.5 opacity-50" : "opacity-100"}`}>
      {state === "running" && (
        <span className="absolute inset-x-0 top-0 h-0.5 overflow-hidden" aria-hidden="true">
          <span className="k-indeterminate block h-full w-1/3 rounded-full bg-[var(--accent)]" />
        </span>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="k-label shrink-0">{`Step ${index}`}</span>
        <h2 className="k-fg min-w-0 text-[14px] font-medium">{title}</h2>
        {meta && <span className="ml-auto shrink-0 whitespace-nowrap">{meta}</span>}
      </div>
      {/* Keyed on the state so the content rises in the moment it lands. */}
      <div key={state} className="gs-in mt-3">
        {children}
      </div>
      {(onBack || footer || onNext) && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {onBack && <BackLink onBack={onBack} />}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">{footer ?? (onNext && <NextButton onNext={onNext} />)}</div>
        </div>
      )}
    </section>
  );
}

function NextButton({ onNext }: { onNext: () => void }) {
  return (
    <button type="button" className="k-btn-accent h-9 px-4" onClick={onNext}>
      Continue
    </button>
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
              <span className="k-fg2 truncate text-[13px]" title={c.domain ?? undefined}>{c.name}</span>
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
  onOwn,
  onRetry,
}: {
  state: StepState;
  proposals: OfferProposal[];
  main: number;
  picked: { name: string } | null;
  busy: number | null;
  error: string | null;
  onPick: (i: number) => void;
  /** "Something else": what they sell, in their words. */
  onOwn: (text: string) => void;
  onRetry: () => void;
}) {
  const [own, setOwn] = useState<string | null>(null);
  const ownBox =
    own === null ? (
      <button
        type="button"
        onClick={() => setOwn("")}
        disabled={!!picked || busy != null}
        style={stagger(proposals.length, 80)}
        className="gs-in k-hover flex items-start gap-3 rounded-[12px] border border-dashed border-[var(--line-strong)] p-3 text-left transition-[background-color,opacity] duration-150 active:scale-[0.99] disabled:opacity-40"
      >
        <span className="k-fg3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-[var(--line-strong)] text-[16px]" aria-hidden="true">
          +
        </span>
        <span className="min-w-0 flex-1">
          <span className="k-fg block text-[14px] font-medium leading-5">Something else</span>
          <span className="k-fg2 mt-1 block text-[12.5px] leading-5">Tell us what you sell.</span>
        </span>
      </button>
    ) : (
      <form
        className="gs-in rounded-[12px] border border-dashed border-[var(--line-strong)] p-3 sm:col-span-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (own.trim()) onOwn(own.trim());
        }}
      >
        <label className="k-fg block text-[14px] font-medium leading-5" htmlFor="gs-own-offer">
          What do you sell?
        </label>
        <textarea
          id="gs-own-offer"
          autoFocus
          className="k-input mt-2 min-h-[80px] w-full resize-y px-3 py-2 text-[14px] leading-5"
          placeholder="What a customer buys from you, in a sentence or two."
          value={own}
          onChange={(e) => setOwn(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <button type="button" className="k-fg3 h-9 text-[13px] hover:text-[var(--fg-2)]" onClick={() => setOwn(null)}>
            Cancel
          </button>
          <button type="submit" className="k-btn-accent ml-auto h-9 px-4" disabled={!own.trim()}>
            Continue
          </button>
        </div>
      </form>
    );
  return (
    <StepCard index={3} title="What you sell" state={state} meta={<StateWord state={state} />}>
      {state === "running" || state === "waiting" ? (
        <OptionSkeleton />
      ) : proposals.length === 0 && !picked ? (
        <>
          <RetryNote text="We could not tell what you sell from your site." onRetry={onRetry} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{ownBox}</div>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
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
            {!picked && ownBox}
          </div>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
      )}
    </StepCard>
  );
}

/**
 * One campaign the visitor ticks (owner 2026-10-16: "ces cases avec logo, nom et description et un
 * budget prérempli"): face, served name, served one line, and its own budget in big figures. Ticked
 * = the k-card-on fill + check; unticked, the budget hides and the campaign is not created.
 */
function CampaignChoice({
  on,
  onToggle,
  name,
  line,
  prefix,
  value,
  period,
  onValue,
  onPeriod,
  label,
  disabled,
  delay,
}: {
  on: boolean;
  onToggle: () => void;
  name: string;
  line: string | null;
  prefix: string;
  value: string;
  period: SignupPeriod;
  onValue: (v: string) => void;
  onPeriod: (p: SignupPeriod) => void;
  label: string;
  disabled: boolean;
  delay: number;
}) {
  return (
    <div className={`gs-in k-card flex flex-col gap-4 p-5 transition-[box-shadow,background-color] duration-150 ${on ? "k-card-on" : ""}`} style={stagger(delay, 80)}>
      <button type="button" aria-pressed={on} disabled={disabled} onClick={onToggle} className="flex items-start gap-3 text-left">
        <FunnelFace name={name} size={48} />
        <span className="min-w-0 flex-1">
          <span className={`block text-[20px] font-semibold leading-7 ${on ? "k-fg" : "k-fg3"}`}>{name}</span>
          {line && <span className="k-fg2 mt-0.5 block text-[13px] leading-5">{line}</span>}
        </span>
        {on ? (
          <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] text-white">✓</span>
        ) : (
          <span aria-hidden className="h-6 w-6 shrink-0 rounded-full border border-[var(--line-strong)]" />
        )}
      </button>
      {on && (
        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="k-fg2 text-[16px]">{prefix}</span>
          <input
            className="k-input tabular-nums"
            style={{ font: "inherit", fontSize: 28, fontWeight: 600, height: 48, width: 80, padding: "0 10px", textAlign: "right", borderRadius: 10 }}
            inputMode="numeric"
            value={value}
            disabled={disabled}
            aria-label={label}
            onChange={(e) => onValue(e.target.value)}
          />
          <span className="k-fg2 text-[16px]">/</span>
          <select
            className="k-input w-auto pr-6"
            style={{ font: "inherit", fontSize: 16, height: 36, paddingLeft: 8 }}
            value={period}
            disabled={disabled}
            aria-label={`${label}: period`}
            onChange={(e) => onPeriod(e.target.value as SignupPeriod)}
          >
            {SIGNUP_PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </span>
      )}
    </div>
  );
}

/**
 * The END of signup (owner 2026-10-16): two equal cards, both ticked, the best proactive campaign
 * features-service runs for cold email and the reactive one that answers replies, each with its own
 * prefilled budget (no volume: owner 2026-10-13). Nothing else to read. Launch opens the wall.
 */
export function CampaignStage({
  state,
  funnels,
  failed,
  loading,
  lineOf,
  draft,
  onChange,
  limitPrefillUsd = null,
  error,
  onRetry,
  onLaunch,
}: {
  state: StepState;
  funnels: { proactive: SignupFunnel | null; reactive: SignupFunnel | null } | null;
  failed: boolean;
  loading: boolean;
  /** A channel's own one-line description (public catalogue), or null. */
  lineOf: (channelSlug: string) => string | null;
  draft: SignupCampaignDraft;
  onChange: (next: SignupCampaignDraft) => void;
  /** The "Never spend more than" line's prefill; null = no line (the signed-in walk). */
  limitPrefillUsd?: number | null;
  error: string | null;
  onRetry: () => void;
  onLaunch: () => void;
}) {
  const arm = useContext(GsArmContext);
  const done = state === "done";
  const main = funnels?.proactive ?? null;
  const meet = funnels?.reactive ?? null;
  const set = (patch: Partial<SignupCampaignDraft>) => onChange({ ...draft, ...patch });
  const nothingTicked = !draft.proactiveOn && !(meet && draft.reactiveOn);
  return (
    <StepCard
      index={walkStepNumber("campaign", arm) ?? stepIndex("campaign") + 1}
      title="Your campaigns"
      state={state}
      meta={<StateWord state={state} />}
      footer={
        main && !done ? (
          <button type="button" className="k-btn-accent k-cta gs-glow justify-center px-8" onClick={onLaunch} disabled={nothingTicked}>
            Launch
          </button>
        ) : null
      }
    >
      {state === "waiting" || (loading && !main) ? (
        <OptionSkeleton />
      ) : !main ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="k-fg2 text-[13px]">{failed ? "We could not load your campaign just now." : "No campaign can run right now."}</p>
          <button type="button" className="k-btn h-8 px-3" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-5">
          <div className={`grid grid-cols-[minmax(0,1fr)] gap-3 ${meet ? "sm:grid-cols-2" : ""}`}>
            <CampaignChoice
              on={draft.proactiveOn}
              onToggle={() => set({ proactiveOn: !draft.proactiveOn })}
              name={main.name}
              line={lineOf(SIGNUP_PROACTIVE_CHANNEL)}
              prefix="$"
              value={draft.budget}
              period={draft.budgetPeriod}
              onValue={(v) => set({ budget: v })}
              onPeriod={(p) => set({ budgetPeriod: p })}
              label="Max budget in dollars"
              disabled={done}
              delay={0}
            />
            {meet && (
              <CampaignChoice
                on={draft.reactiveOn}
                onToggle={() => set({ reactiveOn: !draft.reactiveOn })}
                name={meet.name}
                line={lineOf(SIGNUP_REACTIVE_CHANNEL)}
                prefix="Up to $"
                value={draft.reactiveBudget}
                period={draft.reactivePeriod}
                onValue={(v) => set({ reactiveBudget: v })}
                onPeriod={(p) => set({ reactivePeriod: p })}
                label="AI reply budget in dollars"
                disabled={done}
                delay={1}
              />
            )}
          </div>
          {limitPrefillUsd != null && (
            <label className="flex flex-wrap items-center gap-1.5 text-[13px]">
              <span className="k-fg">Never spend more than</span>
              <span className="k-fg2">$</span>
              <input
                className="k-input w-24 text-right tabular-nums"
                style={{ font: "inherit", paddingRight: 8 }}
                inputMode="numeric"
                value={draft.monthlyLimit ?? limitPrefillUsd.toLocaleString("en-US")}
                disabled={done}
                aria-label="Monthly spend limit in dollars"
                onChange={(e) => set({ monthlyLimit: e.target.value })}
              />
              <span className="k-fg">per month</span>
            </label>
          )}
          {error && <p className="text-[12px] text-[var(--data-rose)]">{error}</p>}
        </div>
      )}
    </StepCard>
  );
}

/**
 * The signals step (owner 2026-10-16): the offer's checks in one column, all ticked, none required.
 * Each card: a short title, why it matters, and a Must have / Nice to have toggle prefilled with the
 * role the AI recommends. Nice to have adds the fact to the email; Must have keeps only the
 * companies that pass.
 */
/** The toggle's first value: the role the AI recommended (lead-service), else the check's own role (a hand-made one). */
function recommendedRole(c: QualificationCriterion): SignalRole {
  return c.recommendation?.mode ?? c.mode;
}

export function SignalsStage({
  state,
  checks,
  ticked,
  roles,
  onToggle,
  onRole,
  error,
  onContinue,
}: {
  state: StepState;
  checks: QualificationCriterion[];
  ticked: ReadonlySet<string>;
  roles: Readonly<Record<string, SignalRole>>;
  onToggle: (id: string) => void;
  onRole: (id: string, role: SignalRole) => void;
  error: string | null;
  onContinue: () => void;
}) {
  const done = state === "done";
  const on = checks.filter((c) => ticked.has(c.id)).length;
  return (
    <StepCard
      index={stepIndex("signals") + 1}
      title="Your signals"
      state={state}
      meta={<StateWord state={state} />}
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
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <div>
            <p className="flex items-baseline gap-2">
              <span className="k-fg text-[40px] font-semibold leading-none tabular-nums">{on}</span>
              <span className="k-fg2 text-[16px]">{on === 1 ? "signal" : "signals"}</span>
            </p>
            <p className="k-fg2 mt-2 text-[14px]">Nice to have adds the fact to your emails. Must have keeps only the companies that pass.</p>
          </div>
          {checks.length === 0 ? (
            <p className="k-fg3 text-[13px]">No signal for this offer yet.</p>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              {checks.map((c, i) => {
                const picked = ticked.has(c.id);
                const role = roles[c.id] ?? c.mode;
                const title = signalTitle(c);
                return (
                  <div
                    key={c.id}
                    className={`gs-in k-card flex flex-wrap items-start gap-x-4 gap-y-3 p-5 transition-[box-shadow,background-color] duration-150 ${picked ? "k-card-on" : ""}`}
                    style={stagger(i, 80)}
                  >
                    <button
                      type="button"
                      aria-pressed={picked}
                      disabled={done}
                      onClick={() => onToggle(c.id)}
                      className="flex min-w-[220px] flex-1 items-start gap-3 text-left active:scale-[0.99]"
                    >
                      {picked ? (
                        <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] text-white">
                          ✓
                        </span>
                      ) : (
                        <span aria-hidden className="mt-0.5 h-6 w-6 shrink-0 rounded-full border border-[var(--line-strong)]" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[16px] font-semibold leading-6 ${picked ? "k-fg" : "k-fg3"}`}>{title}</span>
                        {signalWhy(c) && <span className="k-fg2 mt-0.5 block text-[13px] leading-5">{signalWhy(c)}</span>}
                      </span>
                    </button>
                    {picked && (
                      <div role="radiogroup" aria-label={`${title}: must have or nice to have`} className="ml-auto inline-flex shrink-0 rounded-[8px] bg-[var(--bg-inset)] p-0.5">
                        {SIGNAL_ROLES.map((r) => (
                          <button
                            key={r.key}
                            type="button"
                            role="radio"
                            aria-checked={role === r.key}
                            disabled={done}
                            onClick={() => onRole(c.id, r.key)}
                            className={`h-7 rounded-[6px] px-3 text-[13px] transition-colors ${role === r.key ? "font-medium" : "k-fg2 hover:text-[var(--fg-1)]"}`}
                            style={role === r.key ? { background: "var(--bg-raised)", boxShadow: "0 0 0 1px var(--line), 0 1px 2px rgb(0 0 0 / 0.06)" } : undefined}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {error && <p className="text-[12px] text-[var(--data-rose)]">{error}</p>}
        </div>
      )}
    </StepCard>
  );
}

const SIGNAL_ROLES: { key: SignalRole; label: string }[] = [
  { key: "must_pass", label: "Must have" },
  { key: "mention", label: "Nice to have" },
];

/** The card's title: lead-service's short title; a hand-made check has none and shows its question. */
function signalTitle(c: QualificationCriterion): string {
  return c.title?.trim() || c.question;
}

/** Why the check shows a company needs the offer (lead-service `why`), or null. */
function signalWhy(c: QualificationCriterion): string | null {
  return c.why?.trim() || null;
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
  offerName,
  values,
  onValue,
  busy,
  error,
  onContinue,
}: {
  state: StepState;
  offerName: string;
  values: Record<GiveDraftKey, string>;
  onValue: (k: GiveDraftKey, v: string) => void;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const arm = useContext(GsArmContext);
  const [copied, setCopied] = useState(false);
  const done = state === "done";
  async function copyAll() {
    try {
      await navigator.clipboard.writeText(givesLLMPrompt(offerName, values));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("[get-started] copy failed:", e);
    }
  }
  return (
    <StepCard
      index={stepIndex("gives") + 1}
      title="What you give away"
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
      footer={
        !done && state === "choose" ? (
          <>
            <span className="k-fg3 text-[12px]">{GS_ARM_COPY[arm].givesNext}</span>
            <button type="button" className="k-btn-accent h-9 px-4" onClick={onContinue} disabled={busy}>
              {busy ? "Saving..." : GS_ARM_COPY[arm].givesButton}
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
  onOwn,
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
  /** "Something else": who they want to reach, in their words. */
  onOwn: (text: string) => void;
  onRetry: () => void;
}) {
  const [own, setOwn] = useState<string | null>(null);
  const ownBox =
    own === null ? (
      <button
        type="button"
        onClick={() => setOwn("")}
        disabled={waitingForOffer || !!picked || busy != null}
        style={stagger(proposals.length, 70)}
        className="gs-in k-hover flex items-start gap-2 rounded-[12px] border border-dashed border-[var(--line-strong)] p-3 text-left transition-[background-color,opacity] duration-150 active:scale-[0.99] disabled:opacity-40"
      >
        <span className="k-fg3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-dashed border-[var(--line-strong)] text-[15px]" aria-hidden="true">
          +
        </span>
        <span className="min-w-0 flex-1">
          <span className="k-fg block text-[14px] font-medium leading-5">Something else</span>
          <span className="k-fg2 mt-2 block text-[12.5px] leading-5">Tell us who you want to reach.</span>
        </span>
      </button>
    ) : (
      <form
        className="gs-in rounded-[12px] border border-dashed border-[var(--line-strong)] p-3 sm:col-span-2 lg:col-span-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (own.trim()) onOwn(own.trim());
        }}
      >
        <label className="k-fg block text-[14px] font-medium leading-5" htmlFor="gs-own-audience">
          Who do you want to reach?
        </label>
        <textarea
          id="gs-own-audience"
          autoFocus
          className="k-input mt-2 min-h-[80px] w-full resize-y px-3 py-2 text-[14px] leading-5"
          placeholder="The people you sell to: their role, their company, where they are."
          value={own}
          onChange={(e) => setOwn(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <button type="button" className="k-fg3 h-9 text-[13px] hover:text-[var(--fg-2)]" onClick={() => setOwn(null)}>
            Cancel
          </button>
          <button type="submit" className="k-btn-accent ml-auto h-9 px-4" disabled={!own.trim()}>
            Continue
          </button>
        </div>
      </form>
    );
  return (
    <StepCard index={4} title="Who to write to" state={state} meta={<StateWord state={state} />}>
      {state === "running" || state === "waiting" ? (
        <OptionSkeleton />
      ) : proposals.length === 0 ? (
        <>
          <RetryNote text="We could not work out who to write to." onRetry={onRetry} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{ownBox}</div>
          {error && <p className="mt-2 text-[12px] text-[var(--data-rose)]">{error}</p>}
        </>
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
            {!picked && ownBox}
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

/** A company failing a Must have: the condition it does not meet, in the held colour. */
function UnmetNote({ text }: { text: string }) {
  return (
    <span className="flex min-w-0 items-start gap-2 text-[12px] text-[var(--data-amber)]">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-amber)]" aria-hidden="true" />
      <span className="line-clamp-2 max-w-[220px]">{`Does not meet: ${text}`}</span>
    </span>
  );
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
  note,
  unmet,
}: {
  state: StepState;
  audienceName: string | null;
  rows: AudienceCompanyRow[];
  done: boolean;
  loadingMore: boolean;
  building: boolean;
  note: string | null;
  unmet: (row: AudienceCompanyRow) => string | null;
}) {
  const arm = useContext(GsArmContext);
  const onBack = useContext(BackContext);
  const onNext = useContext(NextContext);
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <span className="k-label">{`Step ${walkStepNumber("companies", arm)}`}</span>
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
                  <th className="k-label px-3 py-2.5 text-left font-normal last:pr-4">We write to</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const miss = unmet(r);
                  const name = miss ? "" : r.person.firstName ?? "";
                  const country = countryFlag(r.company.country);
                  return (
                    <tr
                      key={r.index}
                      className="gs-in k-row border-b border-[var(--line-subtle)] last:border-0"
                      style={stagger(i, 30)}
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
                        {miss ? (
                          <UnmetNote text={miss} />
                        ) : name ? (
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
                    </tr>
                  );
                })}
                {loadingMore &&
                  [0, 1, 2].map((i) => (
                    <tr key={`more-${i}`}>
                      <td colSpan={3} className="px-4 py-2.5">
                        <Shimmer className="h-5" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line-subtle)] px-4 py-2.5">
            <p className="k-fg3 min-w-0 flex-1 text-[12px] tabular-nums">
              {done ? `${rows.length} companies, one person each.` : `${rows.length} companies so far.`} Last names stay masked until your account is set up.
              {note && done ? ` ${note}` : ""}
            </p>
          </div>
        </div>
      )}
      {(onBack || onNext) && (
        <div className="flex flex-wrap items-center gap-3">
          {onBack && <BackLink onBack={onBack} />}
          {onNext && (
            <div className="ml-auto">
              <NextButton onNext={onNext} />
            </div>
          )}
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
 * The email style step (`emails` arm, owner 2026-10-17): Offer, Direct named, Direct unnamed,
 * one or more ticked; each one can show an example written for the first lead, on click only.
 */
function EmailStyleStage({
  state,
  lead,
  noneFits,
  ticked,
  onToggle,
  shown,
  examples,
  busy,
  errors,
  onExample,
}: {
  state: StepState;
  lead: AudienceCompanyRow | null;
  noneFits: boolean;
  ticked: ReadonlySet<EmailAngle>;
  onToggle: (angle: EmailAngle) => void;
  shown: EmailAngle | null;
  examples: Partial<Record<EmailAngle, PreviewEmail>>;
  busy: Partial<Record<EmailAngle, boolean>>;
  errors: Partial<Record<EmailAngle, string>>;
  onExample: (angle: EmailAngle) => void;
}) {
  const arm = useContext(GsArmContext);
  const onBack = useContext(BackContext);
  const onNext = useContext(NextContext);
  const mail = shown ? examples[shown] : undefined;
  const shownLabel = EMAIL_ANGLES.find((a) => a.key === shown)?.label ?? "";
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <span className="k-label">{`Step ${walkStepNumber("email", arm)}`}</span>
        <h2 className="k-fg min-w-0 truncate text-[14px] font-medium">Pick your email style</h2>
        <span className="ml-auto shrink-0">
          <StateWord state={state} />
        </span>
      </div>
      <p className="k-fg2 text-[13px]">Pick one or more. We keep the one that gets the most replies.</p>
      {noneFits && (
        <p className="k-card k-fg2 px-4 py-3 text-[13px]">
          None of these companies meets every Must have. Make one of them a Nice to have at step {walkStepNumber("signals", arm)} to see an example.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {EMAIL_ANGLES.map((a, i) => {
          const on = ticked.has(a.key);
          return (
            <div
              key={a.key}
              className={`gs-in k-card flex flex-col gap-2 p-3 transition-[box-shadow,background-color] duration-150 ${on ? "k-card-on" : ""}`}
              style={stagger(i, 80)}
            >
              <button type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(a.key)} className="flex items-start gap-2 text-left active:scale-[0.99]">
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14px] font-medium leading-5 ${on ? "k-fg" : "k-fg2"}`}>{a.label}</span>
                  <span className={`mt-1 block text-[12.5px] leading-5 ${on ? "k-fg2" : "k-fg3"}`}>{a.line}</span>
                </span>
                <span
                  aria-hidden
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${on ? "bg-[var(--accent)] text-white" : "border border-[var(--line-strong)]"}`}
                >
                  {on ? "✓" : ""}
                </span>
              </button>
              <button type="button" className="k-btn-ghost -ml-2 self-start" onClick={() => onExample(a.key)} disabled={!lead} aria-pressed={shown === a.key}>
                {busy[a.key] ? "Writing..." : "See an example"}
              </button>
            </div>
          );
        })}
      </div>
      {shown && (
        <div className="k-card h-fit overflow-hidden">
          {lead && (
            <div className="flex items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-3">
              <BrandLogo domain={lead.company.domain} size={28} className="rounded-md" />
              <div className="min-w-0">
                <p className="k-fg truncate text-[14px] font-medium">{`${shownLabel} email to ${lead.person.firstName ?? lead.company.name}`}</p>
                <p className="k-fg3 truncate text-[12px]">{[lead.person.title, lead.company.name].filter(Boolean).join(" at ")}</p>
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
          ) : busy[shown] ? (
            <div className="px-4 py-4">
              <p className="k-fg3 mb-3 flex items-center gap-2 text-[12px]">
                <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
                Writing this example. The first one takes about a minute and a half.
              </p>
              <Rows n={6} />
            </div>
          ) : (
            <p className="k-fg3 px-4 py-4 text-[13px]">{errors[shown] ?? "We need one person who meets your Must haves to write an example."}</p>
          )}
        </div>
      )}
      {(onBack || onNext) && (
        <div className="flex flex-wrap items-center gap-3">
          {onBack && <BackLink onBack={onBack} />}
          {onNext && (
            <div className="ml-auto">
              <NextButton onNext={onNext} />
            </div>
          )}
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
      <p className="k-fg2 whitespace-pre-line px-3 pt-3 text-[13px] leading-6">
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
      <PreviewSignature />
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
  return (
    <div>
      <Typewriter text={mail.bodyText} className="k-fg2 whitespace-pre-line px-3 pt-3 text-[13px] leading-6" onDone={explained ? () => setTyped(true) : undefined} />
      <PreviewSignature />
    </div>
  );
}

/**
 * The signature the recipient sees under the email (PREVIEW_SIGNATURE), set apart from the body:
 * a blank line, a quieter colour, never typed, underlined or explained.
 */
function PreviewSignature() {
  return (
    <p aria-label="Email signature" className="k-fg3 whitespace-pre-line px-3 pb-3 pt-5 text-[13px] leading-6">
      {PREVIEW_SIGNATURE}
    </p>
  );
}
