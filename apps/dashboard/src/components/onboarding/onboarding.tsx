"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useOrganization,
  useOrganizationList,
  useSession,
  useUser,
} from "@clerk/nextjs";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  CreditCardIcon,
  GiftIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrophyIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import posthog from "posthog-js";
import {
  upsertBrand,
  createBrandWithoutWebsite,
  getBrand,
  extractBrandFields,
  SALES_PROFILE_FIELDS,
  USER_PROFILE_FIELDS,
  getBrandUserFields,
  saveBrandUserFields,
  USER_FIELD_KEYS,
  type FieldProvenance,
  type UserFieldKey,
  type UserFieldValue,
  getSalesEconomicsEffective,
  saveBrandClickDestination,
  getBrandSalesFunnels,
  stateBrandSalesFunnels,
  declareBrandSalesFunnel,
  type DeclaredSalesFunnel,
  savePhoneNumber,
  suggestAudiences,
  setAudienceStatus,
  listAudiences,
  suggestBrandIcp,
  type AudienceCandidate,
  getWorkflowProjection,
  getWorkflowProjectionLadder,
  type WorkflowProjectionLadderResponse,
  getFeature,
  prefillFeatureInputs,
  prefillToStringMap,
  configureAutoTopup,
  createCheckoutSession,
  getBillingAccount,
  createCampaignWithoutBrandEnrichment,
  saveBrandDailyBudget,
  stateBrandFunnelBudgets,
  salesObjectiveForOptimizationGoal,
  sendAuthNotification,
  type BrandOptimizationGoal,
  type EffectiveSalesEconomics,
  type WorkflowProjectionResponse,
  type FeatureInput,
  isInsufficientCredit,
} from "@/lib/api";
import {
  selectWorkflowForOptimizationGoal,
  workflowOutcomeUnitCost,
} from "@/lib/workflow-projection-choice";
import {
  outcomeNounPlural,
  objectiveForOptimizationGoal,
  pickBestBrandRow,
  isRowFloored,
  modelAvatar,
  coerceListField,
  coerceTextField,
} from "@/lib/strategy-model";
import { BestModelStats, cpprFromRow } from "@/components/strategy/best-model-card";
import { Skeleton } from "@/components/skeleton";
import { PhoneInput, EMPTY_PHONE, type PhoneValue } from "./phone-input";
import {
  POST_PAYMENT_OFFER_LEVERS,
  buildLeverLLMPrompt,
  formatListLeverValue,
  isListLever,
  isListLeverKey,
  parseListLeverInput,
} from "./offer-levers";
import { businessDomainFromEmail, extractDomain, subpageDestinationFromUrl } from "@/lib/extract-domain";
import {
  clearLandingUrlCookieString,
  normalizeLandingUrl,
  readLandingUrlCookie,
} from "@/lib/landing-url-cookie";
import { displaySetupError } from "@/lib/onboarding-setup-error";
import { BrandLogo } from "@/components/brand-logo";
import {
  FUNNEL_MIN_DAILY_BUDGET_USD,
  SALES_FUNNELS,
  funnelBudgetBelowMinimum,
  funnelRateFields,
  funnelDraftFromBrand,
  salesFunnelByKey,
  buildFunnelPatch,
  isEmptyFunnelPatch,
  validateFunnelDraft,
  funnelWriteErrorMessage,
  NOTHING_DECLARED,
  type SalesFunnelDef,
  type SalesFunnelKey,
  type SalesFunnelKeyWire,
  type FunnelDraft,
  type DeclaredFunnelValues,
} from "@/lib/sales-funnels";
import { fundedLaunchFunnelKey } from "@/lib/launch-funnel";
import {
  orderedForDetail,
  resolvePrimaryKey,
  selectableFunnels,
  toFunnelViews,
  type FunnelCatalogueEntry,
  type FunnelView,
} from "@/lib/onboarding-funnel-view";
import { audienceFilterGroups } from "@/lib/audience-filter-groups";
import { validateInvite } from "@/lib/api";
import { inviteCodeFromCookie } from "@/lib/invite-link";
import { onboardingBrandCookieAssignment } from "@/lib/onboarding-brand-cookie";
import { welcomeHeadline, welcomeDetail, referredByLine } from "@/lib/welcome-offer-copy";
import {
  formatLocaleInteger,
  formatLocaleNumberInputValue,
  parseLocaleNumberInput,
} from "@/lib/format-number";

/**
 * Onboarding — the guided signup flow ported from the app.distribute.you mockup:
 * welcome → URL → an ANIMATED build sequence that
 * runs WHILE the brand is created AND its profile / services / economics /
 * pricing projection are fetched for real → services to promote → sales goal →
 * conversion rates → describe audiences in plain language (human-service suggest)
 * → agency-channel consent → outcome-count budget → launches a real campaign.
 * Everything is wired to live endpoints.
 */

const SALES_FEATURE_SLUG = "sales-cold-email-outreach";
const PROJECTION_REF_BUDGET = 100; // counts come back at this budget; unit costs are budget-invariant
const CHECKOUT_PENDING_KEY = "distribute:onboarding-checkout-launch";
// Per-tab snapshot of the in-progress onboarding so a refresh / back-navigation
// resumes on the SAME step with everything the user typed/selected intact, instead
// of resetting to the welcome screen. sessionStorage (not localStorage): scoped to
// the tab, auto-cleared on close → no stale cross-session bleed. Bump VERSION to bust
// an incompatible shape after a flow change. Cleared on genuine completion (launch()).
const ONBOARDING_STATE_KEY = "distribute:onboarding-beta-state";
// v7: the profile bag keys the offer levers by the confirmed user-field keys
// (`valueProposition` → `dreamOutcome`); bump busts pre-migration snapshots.
// v8: adds the no-website path (`noWebsiteMode` + `brandName` + `brandContext`) —
// a brand with no site the user describes in a free-form block instead of a URL.
const ONBOARDING_STATE_VERSION = 8;
const AUTO_TOPUP_THRESHOLD_CENTS = 500;
// Shown on the pricing step when a user returns from Stripe checkout without paying.
// Reassuring, not an error: the brand/budget setup is intact and they finish from here.
const CHECKOUT_CANCELLED_NOTICE = "Your setup is saved. Finish checkout below to launch your campaign.";
/**
 * What the user typed on one funnel's post-payment detail screen. Keyed by rate
 * key and by destination kind, because a funnel can send people to both a page
 * on the brand's site and a scheduling link.
 */
type FunnelDraftState = {
  rates: Record<string, string>;
  ltr: string;
  destinations: Record<string, string>;
};

type Step =
  | "welcome"
  | "url"
  | "loading"
  | "services"
  // LEGACY — a snapshot written by the brand-level flow this one replaced may
  // still carry these, so they stay in the union and in ALL_STEPS (removing a
  // name NARROWS what parses, which would strand a session mid-checkout). No
  // transition routes into them any more; `legacyStepFor` maps each onto the
  // step that asks the same question now, and the fail-safe below catches a
  // snapshot that slipped past it.
  | "destination"
  | "objective"
  | "rates"
  | "audiences"
  // The brand states every funnel it sells through, then which one we optimize
  // for first.
  | "funnels"
  | "primary"
  | "consent"
  | "pricing"
  | "bonus"
  // Post-payment steps (checkout SUCCESS return only) — run BEFORE the launching
  // loader: collect an optional phone, confirm lifetime revenue / paid client,
  // then walk the offer levers (one screen each). Never persisted to the resume
  // snapshot (the persist effect skips on ?launch_checkout=success), so they are
  // intentionally NOT in ALL_STEPS and need no ONBOARDING_STATE_VERSION bump.
  | "celebrate"
  | "phone"
  // LEGACY, same reason as above — the single lifetime-revenue screen the
  // per-funnel screens replaced.
  | "ltr"
  // One screen per selected funnel, primary first, collecting that funnel's own
  // rates, its own lifetime revenue and its own destinations, and writing them.
  | "funnelStats"
  | "model"
  | "offer"
  | "launching";

// The sales goal drives the projection count so the budget cards show the chosen
// unit, never "closes". Outcome IS the BrandOptimizationGoal — every downstream
// helper (salesObjectiveForOptimizationGoal, workflowOutcomeUnitCost, goalSteps)
// already handles every goal; the funnel just wires the chosen one through.
// Labels use Google Ads' conversion-goal category names ("version Google Ads").
// `beta` goals show only to beta users for now (Kevin): Sales (combined) and Book
// appointments (sales meetings) are gated; Sign-ups / Page views / Contacts /
// Submit lead forms / Purchases are ungated in the funnel.
type Outcome = BrandOptimizationGoal;
const OUTCOMES: { key: Outcome; label: string; unit: string; desc: string; beta?: boolean }[] = [
  { key: "signups", label: "Sign-ups", unit: "sign-ups", desc: "Maximize free signups / trial starts." },
  // NOT "appointments" / "page views" (the Google Ads category names): the budget
  // picker must name what the money BUYS in the product's own words. Byte-equal with
  // the retired brand status bar's OUTCOME_UNIT, kept as the canonical noun set.
  { key: "sales_meetings", label: "Sales meeting interest", unit: "sales meeting interest", desc: "Maximize prospects interested in a sales meeting.", beta: true },
  { key: "website_visits", label: "Website visits", unit: "website visits", desc: "Maximize qualified website visits." },
  // The unit is what the budget BUYS, not who we email. "contacts" named the people
  // reached, so the budget modal read "50 contacts / mo" for a goal that buys 50
  // interested replies - and contradicted this row's own label. Byte-equal with
  // the retired brand status bar's OUTCOME_UNIT, kept as the canonical noun set.
  { key: "positive_replies", label: "Positive replies for sales meetings", unit: "positive replies", desc: "Maximize positive replies for a sales meeting from prospects." },
  { key: "form_submissions", label: "Form submissions", unit: "lead forms", desc: "Maximize form submissions." },
  { key: "website_purchase", label: "Website purchases", unit: "website purchases", desc: "Maximize direct website purchases." },
  { key: "sales", label: "Sales", unit: "sales", desc: "Maximize paying clients won via website visits or positive replies." },
];

// Outcome === BrandOptimizationGoal, so this is identity — kept as a named seam so
// the many call sites read intent (goal for the chosen outcome).
function optimizationGoalForOutcome(outcome: Outcome): BrandOptimizationGoal {
  return outcome;
}

// Conversion-rate fields, mirroring brand-sales-economics-card's PctKey set.
type RateKey = "ltv" | "v2s" | "s2c" | "v2m" | "r2m" | "m2c" | "v2p" | "r2p" | "v2f" | "f2p";
const RATE_META: Record<RateKey, { label: string; suffix: "$" | "%"; hint: string }> = {
  ltv: { label: "Lifetime revenue / paid client", suffix: "$", hint: "Average revenue a customer brings over their lifetime." },
  v2s: { label: "Website visits to signup rate", suffix: "%", hint: "Of visitors who land on your site, how many sign up." },
  s2c: { label: "Signup → paid client", suffix: "%", hint: "Of signups, how many become paying customers." },
  v2m: { label: "Website visit → sales meeting", suffix: "%", hint: "Only set this above 0 if prospects can book a meeting directly from your website. If every meeting needs a reply first, use 0%." },
  r2m: { label: "Positive reply → sales meeting", suffix: "%", hint: "Of prospects who reply with real buying interest, the share that become a booked meeting after your follow-up or calendar link." },
  m2c: { label: "Meeting booked → close won", suffix: "%", hint: "Of booked meetings, how many close." },
  v2p: { label: "Website visit → paid client", suffix: "%", hint: "Of leads who click through to your website, the share that become paying customers." },
  r2p: { label: "Positive reply → paid client", suffix: "%", hint: "Of leads who reply positively, the share that become paying customers." },
  v2f: { label: "Website visit → form submission", suffix: "%", hint: "Of leads who visit your website, the share that submit a form." },
  f2p: { label: "Form submission → paid client", suffix: "%", hint: "Of leads who submit a form, the share that become paying customers." },
};
// ── Rate-input formatting ────────────────────────────────────────────
// Number fields render as TEXT (not <input type="number">) so we can show
// viewer-locale separators ("2,500" / "2 500") and decimals ("0.5" / "0,5"). User input is
// intentionally not reformatted on each keystroke; normalizing while typing
// breaks ordinary edits like turning "3" into "0.3".
function parseRateTextInput(raw: string, key: RateKey): number {
  const label = RATE_META[key].label;
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  const value = parseLocaleNumberInput(raw);
  if (value === null) {
    throw new Error(
      RATE_META[key].suffix === "%"
        ? `${label} must be a decimal number.`
        : `${label} must be a decimal dollar amount.`,
    );
  }

  if (RATE_META[key].suffix === "%") {
    if (value < 0 || value > 100) throw new Error(`${label} must be between 0 and 100%.`);
    return value;
  }

  if (value < 0) throw new Error(`${label} must be 0 or more.`);
  return value;
}

function rateToText(n: number): string {
  return formatLocaleNumberInputValue(n);
}

/** The custom "Other" $/day, parsed. null when the field is empty or not a positive amount. */
/** A funnel-key → whole-dollars map, as the pending blob may carry it. */
function isFunnelBudgetMap(v: unknown): v is Record<string, number> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every(
    (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
  );
}

function parseCustomBudget(raw: string): number | null {
  const parsed = parseLocaleNumberInput(raw);
  return parsed !== null && parsed > 0 ? Math.round(parsed) : null;
}

// The five agency-model benefits (landing how-it-works "Sent on your behalf").
const AGENCY_BENEFITS = [
  "Zero reputation risk — your domain never touches cold outreach.",
  "Zero setup — no DNS, SPF/DKIM, warming or mailboxes on your side.",
  "Zero inbox to babysit — we screen replies and forward the positive ones.",
  "Full CRM visibility — you keep the whole view, nothing hidden.",
  "Test demand before revealing your brand on niche markets.",
];

const SERVICES_PROFILE_FIELDS = SALES_PROFILE_FIELDS.filter((f) => f.key === "services");
const LOADING_STEPS = [
  { id: "workspace", label: "Setting up your account" },
  { id: "brand", label: "Looking up your company" },
  { id: "services", label: "Finding what you offer" },
];
const LAUNCH_STEPS = [
  { id: "payment", label: "Confirming payment" },
  { id: "topup", label: "Setting auto-topup" },
  { id: "audiences", label: "Creating audience profiles" },
  { id: "campaign", label: "Launching campaign" },
  { id: "access", label: "Opening dashboard access" },
  { id: "dashboard", label: "Opening your dashboard" },
];

// Rotating soft-tag palette for the services chips (visual variety, like personas).
const TAG_TONES = [
  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-sky-50 text-sky-700 border-sky-200",
  "bg-violet-50 text-violet-700 border-violet-200",
];

// Outcome-count tiers (per month) — each maps to a $/day via the projection unit
// cost, shown as the tier's primary $/day. "Other" is a custom $/day.
// What the old tier grid marked "Recommended", now the number the primary funnel
// is seeded with. Kept as the outcomes/month it buys rather than a dollar amount,
// because the dollars depend on the brand's own cost per outcome.
const RECOMMENDED_OUTCOME_COUNT = 50;

// Default conversion rates + their display text. Shared by the useState seeds and
// the minimal checkout-state reconstruction (a version bump that lands mid-checkout).
// Shown on the (i) beside each tier's outcomes/mo — the count is a projection, not a guarantee.
const ESTIMATE_TOOLTIP = "Estimated conversion based on your provided information and the outcomes of our current client database.";
// `ltv` carries NO default: a lifetime revenue we invented would be divided into the
// fleet cost-per-outcome and printed as a projected ROI, so a placeholder there reads
// as a promise. It stays blank until the brand's stored value is read or the user
// types one (the step refuses to advance on an empty field).
const DEFAULT_RATES: Record<RateKey, number> = { ltv: 0, v2s: 5, s2c: 10, v2m: 3, r2m: 30, m2c: 25, v2p: 1, r2p: 5, v2f: 5, f2p: 10 };
const DEFAULT_RATE_TEXT: Record<RateKey, string> = { ltv: "", v2s: "5", s2c: "10", v2m: "3", r2m: "30", m2c: "25", v2p: "1", r2p: "5", v2f: "5", f2p: "10" };


const fmtUsd0 = (n: number) => "$" + formatLocaleInteger(n);
const fmtCount = (n: number) => formatLocaleInteger(n);

// A background pre-warm of the audience step, started during the loading screen.
// Resolves the drafted ICP prompt and the suggested candidates (candidates null
// when the ICP was empty or the suggest call failed — the step then falls back to
// manual). One promise so the step can show a single "generating" state until ready.
//
// `icpFailed` is the reason, not just the absence: with an empty prompt the step
// assembles its own sentence from the picked services, and that sentence is
// indistinguishable on screen from an ICP brand-service actually drafted. A reader
// who assumes it was drafted edits it as if we had read their site. So the step is
// told WHY it is holding a locally-built sentence and says so.
type AudiencePrefetch = {
  promise: Promise<{ prompt: string; candidates: AudienceCandidate[] | null; icpFailed: boolean }>;
};

type PendingCheckoutLaunch = {
  version: 1;
  brandId: string;
  orgId: string;
  // null for a no-website brand (created from a name + pasted context, no URL).
  brandUrl: string | null;
  hostname: string;
  outcome: Outcome;
  budgetUsd: number;
  workflowSlug: string;
  checkoutAmountCents: number;
  topupAmountCents: number;
  topupThresholdCents: number;
  featureInputs?: Record<string, string>;
  profile?: Record<string, string | string[]>;
  services?: string[];
  // Lifted to the top level (version-independent) so a checkout return survives a
  // stale/incompatible nested onboardingState — the launch + audience gate keep working.
  selectedAudienceIds: string[];
  // v2 — the funnels the brand picked, and the one it optimizes for first. Lifted for
  // the SAME reason as selectedAudienceIds, and it is what makes the post-payment
  // per-funnel screens reachable at all: those steps run on a FRESH page load (the
  // Stripe return), so the React state that held the selection is gone by then. Without
  // this the `funnelStats` step found no funnel and silently skipped itself to `model`,
  // which also lost its primary-funnel card. Living at the TOP level (not in
  // PersistedOnboardingState) keeps ONBOARDING_STATE_VERSION at 8 — a bump strands an
  // in-flight checkout. A blob written before this shipped carries neither: they read
  // [] / null and the screens skip exactly as they did then.
  selectedFunnelKeys: string[];
  primaryFunnelKey: string | null;
  /**
   * What each picked funnel is funded with, in whole dollars per day. The brand is
   * charged their SUM, and billing stores them per funnel once the launch runs —
   * so this has to survive the Stripe round-trip, which is a FRESH page load.
   * Top level for the same reason as the selection above: version-independent, so
   * ONBOARDING_STATE_VERSION stays at 8.
   */
  funnelBudgets: Record<string, number>;
  onboardingState: PersistedOnboardingState;
  createdAt: string;
};

// What we snapshot to resume the wizard after a refresh / back. Only user-entered or
// user-selected state + the ids needed to re-hydrate the backing data — never transient
// UI (busy/error) or runtime-recomputable values (audiencePrefetch). `flowKey` keeps a
// fresh-signup snapshot from bleeding into a "New brand" (?from=add) / "New org" (?new=1)
// session in the same tab, and vice-versa.
type OnboardingFlowKey = "signup" | "add" | "new";
type PersistedOnboardingState = {
  version: typeof ONBOARDING_STATE_VERSION;
  flowKey: OnboardingFlowKey;
  step: Step;
  url: string;
  // No-website path: the user has no site → they give a brand name + a free-form
  // block describing the business instead of a URL. `url` stays "" in this mode.
  noWebsiteMode: boolean;
  brandName: string;
  brandContext: string;
  outcome: Outcome;
  rates: Record<RateKey, number>;
  rateText: Record<RateKey, string>;
  services: string[];
  // User-chosen page outreach clicks land on. "" = the brand domain default.
  clickDestinationUrl: string;
  profile: Record<string, string | string[]>;
  // Canonical selection = the $/day budget (primary value). customBudget is the
  // "Other" custom $ text; the equivalent outcomes/mo is derived for display only.
  selectedBudget: number | null;
  customBudget: string;
  checkoutBudgetUsd: number | null;
  audiencePrompt: string;
  audienceCandidates: AudienceCandidate[] | null;
  selectedAudienceIds: string[];
  workflowProjection: WorkflowProjectionResponse | null;
  salesInputs: FeatureInput[];
  launchFeatureInputs: Record<string, string> | null;
  brandId: string | null;
  orgId: string | null;
  servicesEdited: boolean;
  ratesEdited: boolean;
};

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string")
  );
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isProfileRecord(value: unknown): value is Record<string, string | string[]> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "string" || isStringList(v))
  );
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAudienceCandidate(value: unknown): value is AudienceCandidate {
  if (!isUnknownRecord(value)) return false;
  return (
    typeof value.audienceId === "string" &&
    typeof value.name === "string" &&
    typeof value.rationale === "string" &&
    (value.provider === "apollo" || value.provider === "apify") &&
    isUnknownRecord(value.filters) &&
    typeof value.count === "number" &&
    (value.status === "suggested" || value.status === "active" || value.status === "paused" || value.status === "archived") &&
    (value.validationError === null || typeof value.validationError === "string") &&
    typeof value.truncated === "boolean"
  );
}

function isAudienceCandidateList(value: unknown): value is AudienceCandidate[] {
  return Array.isArray(value) && value.every(isAudienceCandidate);
}

function isFeatureInputList(value: unknown): value is FeatureInput[] {
  return (
    Array.isArray(value) &&
    value.every((input) => {
      if (!isUnknownRecord(input)) return false;
      return (
        typeof input.key === "string" &&
        typeof input.label === "string" &&
        (input.type === "text" || input.type === "textarea" || input.type === "number" || input.type === "select") &&
        typeof input.placeholder === "string" &&
        typeof input.description === "string" &&
        typeof input.extractKey === "string" &&
        (input.options === undefined || isStringList(input.options))
      );
    })
  );
}

function isWorkflowProjectionResponse(value: unknown): value is WorkflowProjectionResponse {
  if (!isUnknownRecord(value)) return false;
  return (
    typeof value.featureSlug === "string" &&
    (value.objective === "meeting-booked" || value.objective === "self-serve") &&
    Array.isArray(value.workflows) &&
    value.workflows.every((workflow) => isUnknownRecord(workflow) && typeof workflow.workflowDynastySlug === "string") &&
    (value.recommendedWorkflowDynastySlug === null || typeof value.recommendedWorkflowDynastySlug === "string") &&
    (value.recommendedBudgetUsd === null || typeof value.recommendedBudgetUsd === "number")
  );
}

// Rebuild a minimal, CURRENT-version onboarding snapshot from the pending blob's
// version-INDEPENDENT top-level fields. Used when the nested onboardingState fails to
// parse (an ONBOARDING_STATE_VERSION bump landed while the user was at checkout) — the
// brand/budget/outcome/audiences all live at the top level, so a cancel return still
// lands on pricing with the brand intact instead of nuking the whole flow.
function reconstructCheckoutOnboardingState(
  p: Partial<PendingCheckoutLaunch>,
  selectedAudienceIds: string[],
): PersistedOnboardingState {
  const budget = typeof p.budgetUsd === "number" ? p.budgetUsd : null;
  return {
    version: ONBOARDING_STATE_VERSION,
    flowKey: "signup",
    step: "pricing",
    url: (p.brandUrl ?? "").replace(/^https?:\/\//i, ""),
    noWebsiteMode: p.brandUrl == null,
    brandName: "",
    brandContext: "",
    outcome: p.outcome as Outcome,
    rates: { ...DEFAULT_RATES },
    rateText: { ...DEFAULT_RATE_TEXT },
    services: p.services ?? [],
    clickDestinationUrl: "",
    profile: p.profile ?? {},
    selectedBudget: budget,
    customBudget: "",
    checkoutBudgetUsd: budget,
    audiencePrompt: "",
    audienceCandidates: null,
    selectedAudienceIds,
    workflowProjection: null,
    salesInputs: [],
    launchFeatureInputs: p.featureInputs ?? null,
    brandId: p.brandId ?? null,
    orgId: p.orgId ?? null,
    servicesEdited: false,
    ratesEdited: false,
  };
}

function readPendingCheckoutLaunch(): PendingCheckoutLaunch {
  const raw = window.sessionStorage.getItem(CHECKOUT_PENDING_KEY);
  if (!raw) {
    throw new Error("Checkout returned, but the pending launch state is missing. Campaign was not launched.");
  }
  const parsed = JSON.parse(raw) as Partial<PendingCheckoutLaunch>;
  // Top-level fields are version-independent and are the source of truth for a launch.
  if (
    parsed.version !== 1 ||
    typeof parsed.brandId !== "string" ||
    typeof parsed.orgId !== "string" ||
    !(parsed.brandUrl === null || typeof parsed.brandUrl === "string") ||
    typeof parsed.hostname !== "string" ||
    !OUTCOMES.some((o) => o.key === parsed.outcome) ||
    typeof parsed.budgetUsd !== "number" ||
    typeof parsed.workflowSlug !== "string" ||
    typeof parsed.checkoutAmountCents !== "number" ||
    typeof parsed.topupAmountCents !== "number" ||
    typeof parsed.topupThresholdCents !== "number" ||
    (parsed.featureInputs !== undefined && !isStringRecord(parsed.featureInputs)) ||
    (parsed.profile !== undefined && !isProfileRecord(parsed.profile)) ||
    (parsed.services !== undefined && !isStringList(parsed.services)) ||
    typeof parsed.createdAt !== "string"
  ) {
    throw new Error("Checkout returned with an invalid pending launch state. Campaign was not launched.");
  }
  // selectedAudienceIds is lifted to the top level; older blobs may lack it (default []).
  const selectedAudienceIds = isStringList(parsed.selectedAudienceIds)
    ? parsed.selectedAudienceIds
    : parseOnboardingState(parsed.onboardingState)?.selectedAudienceIds ?? [];
  // The v2 funnel selection is lifted the same way, and is deliberately NOT part of the
  // validity check above: it is a preview surface, so a blob written before it shipped
  // (or by the GA flow, which has no funnels) must still launch. Absent = no funnel
  // screens, which is the pre-existing behaviour, never a blocked launch.
  const selectedFunnelKeys = isStringList(parsed.selectedFunnelKeys) ? parsed.selectedFunnelKeys : [];
  const primaryFunnelKey = typeof parsed.primaryFunnelKey === "string" ? parsed.primaryFunnelKey : null;
  // Read as tolerantly as the selection, and for the same reason: a blob written
  // before per-funnel funding shipped carries none, and it must still LAUNCH. An
  // empty map falls back to the brand-level write below, which is what that blob
  // was always going to do.
  const funnelBudgets = isFunnelBudgetMap(parsed.funnelBudgets) ? parsed.funnelBudgets : {};
  // The nested onboardingState only re-renders the deeper wizard. If it fails to parse
  // (a version bump landed mid-checkout), reconstruct a minimal current-version state
  // from the top-level fields — the brand + budget survive; the user re-picks nothing
  // that the top level already holds. Log loud (keep-resolved, not a silent fallback).
  let onboardingState = parseOnboardingState(parsed.onboardingState);
  if (!onboardingState) {
    console.error(
      "[dashboard] pending checkout onboardingState stale/invalid — reconstructing minimal state from top-level fields",
    );
    onboardingState = reconstructCheckoutOnboardingState(parsed, selectedAudienceIds);
  }
  return {
    ...parsed,
    selectedAudienceIds,
    selectedFunnelKeys,
    primaryFunnelKey,
    funnelBudgets,
    onboardingState,
  } as PendingCheckoutLaunch;
}

// Opportunistic recovery read: callers fall back to current state when this
// returns null, so a stale blob from a prior onboarding attempt on an older
// schema must NOT block a fresh checkout. Log loud + purge the poison key +
// return null. The strict readPendingCheckoutLaunch stays fail-loud for the
// resume/cancel-return paths where the blob is the sole source of truth.
function readPendingCheckoutLaunchOrNull(): PendingCheckoutLaunch | null {
  if (!window.sessionStorage.getItem(CHECKOUT_PENDING_KEY)) return null;
  try {
    return readPendingCheckoutLaunch();
  } catch (err) {
    console.error("[dashboard] discarding stale/invalid pending checkout launch state:", err);
    window.sessionStorage.removeItem(CHECKOUT_PENDING_KEY);
    return null;
  }
}

// Coerce a stored profile field (string | string[]) to a string[] of trimmed items.
function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

const NON_SERVICE_LABELS = new Set([
  "unknown",
  "n/a",
  "na",
  "none",
  "not applicable",
  "not available",
  "unclear",
  "unspecified",
]);

function isUsefulServiceLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[.!]+$/g, "");
  return normalized.length > 1 && !NON_SERVICE_LABELS.has(normalized);
}

function normalizeServices(value: unknown): string[] {
  return toStringList(value).filter(isUsefulServiceLabel);
}

// Build the saveBrandUserFields PUT body from the onboarding profile bag + the
// picked services. Only the 7 confirmed user-fields are sent (each sent key is
// confirmed server-side).
//
// A lever the bag CARRIES is sent even when the user emptied it: the PUT replaces
// the value of each key it receives and leaves an omitted key untouched, and a key
// with no confirmed row falls back to the AI `suggested` prefill on the next read —
// so omitting empties made "clear this lever" impossible, the deleted text came back
// on the next read. A lever ABSENT from the bag is still omitted: the offer step
// never rendered it, so we have no user intent to record.
//
// `services` keeps its non-empty guard: it is the services step's own picked list,
// onboarding requires at least one, and confirming an empty list here would clobber
// the extracted services rather than express a deletion.
function buildUserFieldsPayload(
  profile: Record<string, string | string[]>,
  services: string[],
): Partial<Record<UserFieldKey, UserFieldValue>> {
  const out: Partial<Record<UserFieldKey, UserFieldValue>> = {};
  const cleanServices = services.map((s) => s.trim()).filter(Boolean);
  if (cleanServices.length) out.services = cleanServices;
  for (const key of USER_FIELD_KEYS) {
    if (key === "services") continue;
    if (!(key in profile)) continue;
    const v = profile[key];
    if (Array.isArray(v)) {
      out[key] = v.map((s) => s.trim()).filter(Boolean);
    } else {
      out[key] = typeof v === "string" ? v.trim() : "";
    }
  }
  return out;
}

function isRateRecord(value: unknown): value is Record<RateKey, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys: RateKey[] = ["ltv", "v2s", "s2c", "v2m", "r2m", "m2c", "v2p", "r2p", "v2f", "f2p"];
  return keys.every((k) => typeof (value as Record<string, unknown>)[k] === "number");
}
function isRateTextRecord(value: unknown): value is Record<RateKey, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys: RateKey[] = ["ltv", "v2s", "s2c", "v2m", "r2m", "m2c", "v2p", "r2p", "v2f", "f2p"];
  return keys.every((k) => typeof (value as Record<string, unknown>)[k] === "string");
}
// Widening only: a snapshot written before the v2 steps existed still names a
// step in this list, so old snapshots keep parsing and ONBOARDING_STATE_VERSION
// stays put (a bump strands an in-flight checkout).
const ALL_STEPS: Step[] = [
  "welcome", "url", "loading", "services", "destination", "objective", "rates", "audiences", "funnels", "primary", "consent", "pricing", "bonus", "launching",
];

function parseOnboardingState(value: unknown): PersistedOnboardingState | null {
  if (!isUnknownRecord(value)) return null;
  const p = value as Partial<PersistedOnboardingState>;
  if (
    p.version !== ONBOARDING_STATE_VERSION ||
    (p.flowKey !== "signup" && p.flowKey !== "add" && p.flowKey !== "new") ||
    typeof p.step !== "string" || !ALL_STEPS.includes(p.step as Step) ||
    typeof p.url !== "string" ||
    typeof p.noWebsiteMode !== "boolean" ||
    typeof p.brandName !== "string" || typeof p.brandContext !== "string" ||
    !OUTCOMES.some((o) => o.key === p.outcome) ||
    !isRateRecord(p.rates) || !isRateTextRecord(p.rateText) ||
    !isStringList(p.services) || typeof p.clickDestinationUrl !== "string" || !isProfileRecord(p.profile) ||
    !(p.selectedBudget === null || typeof p.selectedBudget === "number") ||
    typeof p.customBudget !== "string" ||
    !(p.checkoutBudgetUsd === null || typeof p.checkoutBudgetUsd === "number") ||
    typeof p.audiencePrompt !== "string" ||
    !(p.audienceCandidates === null || isAudienceCandidateList(p.audienceCandidates)) ||
    !isStringList(p.selectedAudienceIds) ||
    !(p.workflowProjection === null || isWorkflowProjectionResponse(p.workflowProjection)) ||
    !isFeatureInputList(p.salesInputs) ||
    !(p.launchFeatureInputs === null || isStringRecord(p.launchFeatureInputs)) ||
    !(p.brandId === null || typeof p.brandId === "string") ||
    !(p.orgId === null || typeof p.orgId === "string") ||
    typeof p.servicesEdited !== "boolean" || typeof p.ratesEdited !== "boolean"
  ) {
    return null;
  }
  return p as PersistedOnboardingState;
}

function readOnboardingState(): PersistedOnboardingState | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(ONBOARDING_STATE_KEY);
  if (!raw) return null;
  try {
    return parseOnboardingState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readCheckoutOnboardingSnapshot(): PersistedOnboardingState | null {
  if (typeof window === "undefined") return null;
  try {
    return readPendingCheckoutLaunch().onboardingState;
  } catch {
    return null;
  }
}

function writeOnboardingState(state: PersistedOnboardingState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(state));
  } catch {
    // quota / private-mode — persistence is best-effort, never block the flow.
  }
}

function clearOnboardingState(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ONBOARDING_STATE_KEY);
}

// Map a persisted step to where the resume should LAND. `loading` and `launching`
// are transient action steps (an async create/launch was mid-flight when the page
// died) — never restore INTO them: resolve to the nearest stable step the user can
// act on. A post-URL stable step needs the backing data (brand record, economics,
// projection) the loading screen fetched, so the resume replays that hydration first
// (see resumeOnboarding) and only THEN shows this step.
function resolveResumeStep(step: Step, brandId: string | null): Step {
  if (step === "loading") return brandId ? "services" : "url";
  if (step === "launching") return "pricing";
  return legacyStepFor(step);
}

/**
 * Where a session belongs when it is pointed at a step the brand-level flow had
 * and this one does not. Nothing ROUTES into those steps any more, but a RESUME
 * sets the step directly — from a sessionStorage snapshot written before the
 * funnels flow shipped, or from an in-flight checkout blob — so without this
 * mapping the user lands on a step that no longer renders.
 *
 * Each legacy step maps to the point in the order that asks the same thing: the
 * click destination is asked per funnel after payment, so its slot is the
 * audience step; the single goal and its rates are replaced by the funnel picks.
 */
function legacyStepFor(step: Step): Step {
  switch (step) {
    case "destination":
      return "audiences";
    case "objective":
    case "rates":
      return "funnels";
    // The single lifetime-revenue screen: each funnel now carries its own, so the
    // per-funnel screens ask it. Never reached from a resume (the post-payment
    // steps are not persisted); the render fail-safe is what uses this arm.
    case "ltr":
      return "funnelStats";
    default:
      return step;
  }
}

export function Onboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const { createOrganization, setActive } = useOrganizationList();
  const { session } = useSession();
  const { user } = useUser();
  const signupEmail = user?.primaryEmailAddress?.emailAddress;
  const forceNew = searchParams.get("new") === "1";
  // Entered from an in-app "New brand" / "New org" button (vs a fresh signup) —
  // skip the welcome hero and land straight on the URL step. Same flow otherwise.
  const fromAdd = searchParams.get("from") === "add";
  const flowKey: OnboardingFlowKey = fromAdd ? "add" : forceNew ? "new" : "signup";
  // Cross-session resume of a never-finished brand. The per-brand setup gate
  // (`BrandSetupGate`) redirects a brand that has no campaign (= onboarding
  // abandoned before the terminal launch) back here as `?from=add&brandId=<id>`.
  // Same-tab resume already works via the sessionStorage snapshot; this param is
  // the CROSS-session path (the snapshot is gone), so we re-hydrate the brand from
  // backend and drop the user back on the goal step (everything before it prefilled).
  // Only used when there's no snapshot to restore — a live snapshot wins (it lands
  // straight on the step the user left, e.g. pricing).
  const resumeBrandIdParam = searchParams.get("brandId");

  // Resume snapshot (refresh / back). Read ONCE, synchronously, before first paint —
  // a `useRef` lazy-init seeds every field below so `url`/`outcome`/`rates`/etc. are
  // already correct on render 1 (no setState-async restore flash). Skipped when a
  // Stripe checkout return owns the resume (?launch_checkout=…) or the snapshot is from
  // a different flow intent (signup vs add vs new) in the same tab.
  const restoreRef = useRef<PersistedOnboardingState | null>(null);
  if (restoreRef.current === null) {
    const snap = searchParams.get("launch_checkout") ? readCheckoutOnboardingSnapshot() : readOnboardingState();
    restoreRef.current = snap && snap.flowKey === flowKey ? snap : null;
  }
  const restored = restoreRef.current;

  const [step, setStep] = useState<Step>(() =>
    restored
      ? // A Stripe checkout SUCCESS return is owned by the dedicated checkout effect
        // (resumeCheckoutLaunch → the post-payment steps); land on the first
        // post-payment step ("celebrate") on first paint so the budget step never
        // flashes before that effect runs. The launching loader is deferred until
        // the user finishes the post-payment steps. A cancelled return still
        // resolves to its snapshot step (pricing).
        searchParams.get("launch_checkout") === "success"
        ? "celebrate"
        : resolveResumeStep(restored.step, restored.brandId)
      : resumeBrandIdParam && searchParams.get("launch_checkout") === null
        ? // Cross-session brand resume: show the loading screen immediately (no URL
          // flash) while the param-resume effect re-hydrates the brand, then it lands
          // on the goal step.
          "loading"
        : fromAdd
          ? "url"
          : "welcome",
  );
  const [url, setUrl] = useState(() => restored?.url ?? searchParams.get("url")?.trim() ?? "");
  // No-website path (beta): the user has no site, so instead of a URL they enter a
  // brand name + a large free-form block about their business. `noWebsiteMode` gates
  // the URL-step UI, skips the click-destination step, and locks the goal to
  // positive_replies (no site means no clicks/visits to optimize for).
  const [noWebsiteMode, setNoWebsiteMode] = useState<boolean>(() => restored?.noWebsiteMode ?? false);
  const [brandName, setBrandName] = useState(() => restored?.brandName ?? "");
  // DISTINCT from `brandName` above, which is what the user TYPED on the no-website
  // path. This is the company name brand-service resolved from the domain, returned
  // by the brand-create call. Deliberately NOT part of the persisted snapshot: adding
  // a field there means bumping ONBOARDING_STATE_VERSION, which strands an in-flight
  // checkout, and the cost of not persisting it is only that a resumed session shows
  // the domain again.
  const [resolvedBrandName, setResolvedBrandName] = useState<string | null>(null);
  const [brandContext, setBrandContext] = useState(() => restored?.brandContext ?? "");
  const [error, setError] = useState<string | null>(null);
  // Whether this signup arrived through someone's referral link, and who sent them.
  //
  // A referred signup is owed BOTH offers ($400 welcome + $500 referral, at $400
  // and $900 of payments), so the gift step must not quote the welcome figure
  // alone: that understates what they get by $500 on the screen where they decide
  // to pay, and contradicts the link that brought them here.
  //
  // The claim itself cannot have happened yet (it needs an org, and it runs on the
  // authed dashboard shell), so the promise does not exist in billing at this
  // point. What we have is the code the landing parked in a cookie. It is
  // VALIDATED before anything is promised, so the larger figure is only ever shown
  // for a code that resolves to a real org — a typo'd link keeps the plain copy.
  const [referredSignup, setReferredSignup] = useState(false);
  const [inviterOrgName, setInviterOrgName] = useState<string | null>(null);
  // Reassuring (non-error) note shown on the pricing step after a cancelled checkout
  // return — the setup is saved and the user can finish payment from the same screen.
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [outcome, setOutcome] = useState<Outcome>(() => restored?.outcome ?? "signups");

  // ── The sales funnels the brand sells through ───────────────────────────────
  // Read straight off the shared catalogue through the display adapter, so a new
  // funnel or a renamed leg lands here with no edit. Deliberately EPHEMERAL
  // (absent from the persisted snapshot): adding fields there means bumping
  // ONBOARDING_STATE_VERSION, which strands an in-flight checkout. The selection
  // instead rides the TOP LEVEL of the pending-checkout blob, which is
  // version-independent, so it survives the Stripe round-trip.
  // The rate LABELS come from the catalogue's own resolver, so a rate reads the
  // same word here as it does on the settings card.
  const funnelViews = toFunnelViews(SALES_FUNNELS as unknown as FunnelCatalogueEntry[], (entry) =>
    funnelRateFields(entry as unknown as SalesFunnelDef),
  );
  const offeredFunnels = selectableFunnels(funnelViews, !noWebsiteMode);
  const [selectedFunnelKeys, setSelectedFunnelKeys] = useState<string[]>([]);
  const [primaryFunnelKey, setPrimaryFunnelKey] = useState<string | null>(null);
  // Per-funnel draft answers for the post-payment detail screens, keyed by funnel.
  // Each holds that funnel's rate fields plus its own lifetime revenue and
  // destination — a self-serve signup customer and an enterprise meeting customer
  // are not worth the same and do not land on the same page.
  const [funnelDrafts, setFunnelDrafts] = useState<Record<string, FunnelDraftState>>({});
  const [funnelIndex, setFunnelIndex] = useState(0);
  const selectedFunnels = offeredFunnels.filter((f) => selectedFunnelKeys.includes(f.key));
  const detailFunnels = orderedForDetail(selectedFunnels, primaryFunnelKey);
  const primaryFunnel = selectedFunnels.find((f) => f.key === primaryFunnelKey) ?? null;
  // What the brand's economics actually say, for the funnel screens to prefill from.
  // Deliberately NOT in the persisted snapshot: adding a field there forces an
  // ONBOARDING_STATE_VERSION bump, which strands an in-flight checkout — and this is
  // re-read from the wire on the post-payment page load anyway (prewarmStoredEconomics).
  const [storedEconomics, setStoredEconomics] = useState<EffectiveSalesEconomics | null>(null);
  const [rates, setRates] = useState<Record<RateKey, number>>(() => restored?.rates ?? { ...DEFAULT_RATES });
  const [rateText, setRateText] = useState<Record<RateKey, string>>(() => restored?.rateText ?? { ...DEFAULT_RATE_TEXT });
  const [services, setServices] = useState<string[]>(() => restored?.services ?? []);
  const [serviceDraft, setServiceDraft] = useState("");
  // The brand-level page outreach clicks land on. Each FUNNEL now owns its own
  // landing page, so this is no longer a question the flow asks — it is written
  // from the page destination the user gives on the funnel screens (see
  // saveFunnelStatsAndContinue), because brand-service still serves this field on
  // the brand read and consumers link off it. "" means "not set yet". Seeded from
  // a sub-page in the incoming brand URL (landing pricing prefill or `?url=`), so
  // arriving with "acme.com/pricing" prefills that page on the funnel screen.
  // Kept in the persisted snapshot: removing a field there is what forces an
  // ONBOARDING_STATE_VERSION bump, which strands an in-flight checkout.
  const [clickDestinationUrl, setClickDestinationUrl] = useState<string>(
    () => restored?.clickDestinationUrl ?? subpageDestinationFromUrl(restored?.url ?? searchParams.get("url")?.trim() ?? ""),
  );
  const [profile, setProfile] = useState<Record<string, string | string[]>>(() => restored?.profile ?? {});
  // Per-field provenance for the offer levers ("confirmed" once the user saved a
  // value, else "suggested" = the AI prefill). Seeded from getBrandUserFields at
  // hydrate; NOT persisted in the snapshot (re-derived on resume, defaults to
  // "suggested"). Drives the "Confirmed" badge on the offer step.
  const [fieldProvenance, setFieldProvenance] = useState<Record<string, FieldProvenance>>({});
  // LEGACY, and kept only because they are FIELDS on the persisted snapshot:
  // removing one narrows what a snapshot may carry, which strands a session that
  // was mid-checkout. Nothing in the flow writes them any more — the money is
  // funded per funnel (`funnelBudgets`) and the brand is charged their sum. They
  // are still restored so an older snapshot round-trips unchanged.
  const [selectedBudget, setSelectedBudget] = useState<number | null>(() => restored?.selectedBudget ?? null);
  const [customBudget, setCustomBudget] = useState(() => restored?.customBudget ?? "");
  // The daily ceiling the user funds each PICKED funnel with, in whole dollars as
  // typed, keyed by funnel. This is what the brand is charged the sum of, and what
  // billing stores per funnel at launch.
  //
  // Deliberately EPHEMERAL, like the funnel selection it belongs to: a field on the
  // persisted snapshot means bumping ONBOARDING_STATE_VERSION, which strands an
  // in-flight checkout. It rides the TOP LEVEL of the pending-checkout blob instead,
  // which is version-independent, so it survives the Stripe round-trip.
  const [funnelBudgets, setFunnelBudgets] = useState<Record<string, string>>({});
  const [checkoutBudgetUsd, setCheckoutBudgetUsd] = useState<number | null>(() => restored?.checkoutBudgetUsd ?? null);
  const [audiencePrompt, setAudiencePrompt] = useState(() => restored?.audiencePrompt ?? "");
  const [audienceCandidates, setAudienceCandidates] = useState<AudienceCandidate[] | null>(() => restored?.audienceCandidates ?? null);
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<string[]>(() => restored?.selectedAudienceIds ?? []);
  // Pre-warmed audience step. During the loading screen we draft the ICP prompt
  // AND fire the audience suggest in the background, so the audience step opens
  // with candidates already (or nearly) ready — zero wait, zero click. Stashed in
  // state (not a ref) so a late-resolving prewarm still flows into the step as a prop.
  const [audiencePrefetch, setAudiencePrefetch] = useState<AudiencePrefetch | null>(null);
  // Whether the loading-screen service extraction FAILED, and whether the heavier
  // background hydrate that can still deliver the list is in flight. The services
  // step renders one of three honest states off these — a list, "still reading", or
  // a stated failure with a retry — instead of its "we drafted these" copy over an
  // empty box, which is what a swallowed extract failure used to look like.
  const [servicesExtractFailed, setServicesExtractFailed] = useState(false);
  const [servicesHydrating, setServicesHydrating] = useState(false);
  const [servicesRetrying, setServicesRetrying] = useState(false);
  const [launchStep, setLaunchStep] = useState(0);
  const [launchingBrand, setLaunchingBrand] = useState<{ domain: string | null; hostname: string } | null>(null);
  // Post-payment steps (phone → ltr → offer levers). `phone` is user-level
  // (Clerk metadata), optional. `offerIndex` walks the offer levers one screen at
  // a time. The pending checkout blob is stashed so the terminal offer step can
  // run completeLaunchAfterCheckout AFTER the user finishes these steps (with
  // their edited profile), instead of at the checkout-return effect.
  const [phone, setPhone] = useState<PhoneValue>(EMPTY_PHONE);
  const [offerIndex, setOfferIndex] = useState(0);
  const pendingCheckoutRef = useRef<PendingCheckoutLaunch | null>(null);
  // Best-model step (post-payment, after LTR). The 3-grain workflow-projection
  // LADDER — the SAME endpoint + pick the Strategy page uses, so the numbers match
  // byte-for-byte. Prewarmed at the celebrate step, refetched after the LTR save
  // (the entered lifetime revenue changes the projected CAC / ROI). `null` = still
  // loading; the step shows a skeleton until it lands.
  const [bestModelLadder, setBestModelLadder] = useState<WorkflowProjectionLadderResponse | null>(null);
  const bestModelFetchRef = useRef<Promise<void> | null>(null);
  // The model step lets the user edit the two things the ROI is computed from
  // (lifetime revenue and the goal's conversion rate) and recompute, because a return
  // under 1x is otherwise unexplainable on a screen that shows neither number.
  const [modelEconomicsBusy, setModelEconomicsBusy] = useState(false);
  const [modelEconomicsError, setModelEconomicsError] = useState<string | null>(null);
  // What the primary funnel's draft looked like the last time this step wrote it (or
  // when the step was first shown). The Update button arms on a LIVE compare against
  // it, never a sticky "edited" latch: typing a value and undoing it must disarm the
  // button again.
  const [modelEconomicsBaseline, setModelEconomicsBaseline] = useState<string | null>(null);
  // Aggressive parallel launch. The whole launch (audiences, auto-topup, budget,
  // campaign create, onboarding-complete) is kicked off in the BACKGROUND the moment
  // the checkout returns — while the user fills the optional post-payment steps — so
  // "Opening your dashboard" is near-instant, and the campaign is created even if the
  // user quits before reaching the dashboard. `backgroundLaunchRef` holds the single
  // in-flight promise (fire once); `launchError` surfaces a background failure at the
  // terminal launching screen with a retry.
  const backgroundLaunchRef = useRef<Promise<{ campaignId: string }> | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Loading-sequence + real fetch coordination. The visible checks follow real
  // client milestones: org ready, brand upserted, then service extraction.
  const [loadStep, setLoadStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [brandId, setBrandId] = useState<string | null>(() => restored?.brandId ?? null);
  const brandIdRef = useRef<string | null>(restored?.brandId ?? null);
  const orgIdRef = useRef<string | null>(restored?.orgId ?? null);
  const fetchDoneRef = useRef(false);
  const loadingStartedAtRef = useRef<number | null>(null);
  const checkoutResumeStartedRef = useRef(false);
  // When a step's action 402s (insufficient credit), the API client auto-opens the
  // add-credit modal and we stash the failed action here instead of resetting the
  // step. Once the user adds credit in the modal, billing-guard dispatches
  // `billing:resolved` and we re-run it — no page reload, so no state is lost.
  const creditRetryRef = useRef<null | (() => void | Promise<void>)>(null);

  const [pricingHydrationVersion, setPricingHydrationVersion] = useState(0);
  const projectionRef = useRef<WorkflowProjectionResponse | null>(restored?.workflowProjection ?? null);
  const econRef = useRef<EffectiveSalesEconomics | null>(null);
  const launchFeatureInputsRef = useRef<Record<string, string> | null>(restored?.launchFeatureInputs ?? null);
  const hydrationPromiseRef = useRef<Promise<void> | null>(null);
  // Seed the "user edited this" guards from the snapshot so a resume's re-extraction /
  // re-hydration does NOT clobber values the user already changed (see hydrateOnboarding
  // InBackground / createBrandAndFetchServices, which both respect these refs).
  const servicesEditedRef = useRef(restored?.servicesEdited ?? false);
  const ratesEditedRef = useRef(restored?.ratesEdited ?? false);
  // Separate from `ratesEditedRef`: the lifetime-revenue field lives on a POST-payment
  // step, so it must still be seeded from the wire on a checkout return even when the
  // user edited a conversion rate before checkout (which sets `ratesEditedRef`).
  const ltvEditedRef = useRef(false);
  // Whether a funnel's landing page has already been mirrored onto the brand-level
  // click destination this session. The funnel screens run primary-first, so the
  // first one that lands a click on the site owns that field; a later funnel must
  // not silently repoint it.
  const clickDestinationMirroredRef = useRef(false);
  // The sales feature's declared input definitions — needed to build the
  // `featureInputs` map the /campaigns create endpoint requires at launch.
  const salesInputsRef = useRef<FeatureInput[]>(restored?.salesInputs ?? []);

  const domain = extractDomain(url);
  const hostname = domain ?? url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  // A no-website brand has no domain/hostname — the step headers + loading copy use
  // the typed brand name as the identity instead of an empty "Reading " line.
  const headerDomain = noWebsiteMode ? null : domain;
  const headerHostname = noWebsiteMode ? (brandName.trim() || "your brand") : hostname;
  // The company name brand-service resolved for this domain, so the header can read
  // "Acme Consulting" instead of "acme.com". A no-website brand is identified by the
  // name the user typed, which `headerHostname` already carries — nothing to resolve.
  const headerName = noWebsiteMode ? null : resolvedBrandName;
  // The default click destination = the brand's homepage (domain root). Used as
  // the pre-selected option on the destination step and the fallback when the
  // user leaves the custom field empty.
  const trimmedUrl = url.trim();
  const defaultDestinationUrl = domain
    ? `https://${domain}`
    : trimmedUrl
      ? /^https?:\/\//i.test(trimmedUrl)
        ? trimmedUrl
        : `https://${trimmedUrl}`
      : "";

  useEffect(() => {
    posthog.capture("onboarding_step_viewed", { step, flow: "beta" });
  }, [step]);
  // Resolve, once, whether this signup came through a referral link. Runs on
  // mount rather than at the gift step so the answer is settled before that
  // screen paints and the headline never changes under the reader. A failed or
  // unknown code simply leaves the plain welcome copy in place: promising the
  // larger amount on a code we could not confirm is the one outcome to avoid.
  useEffect(() => {
    const code = inviteCodeFromCookie(document.cookie);
    if (!code) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await validateInvite(code);
        if (cancelled || !res.valid) return;
        setReferredSignup(true);
        setInviterOrgName(res.inviterOrgName);
      } catch (err) {
        console.error("[dashboard] could not validate the invite code, showing the plain offer", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // A no-website brand has no clicks/visits, so the only supported goal is
  // positive_replies — keep the goal pinned there whenever no-website mode is on
  // (covers a restored snapshot whose outcome drifted).
  useEffect(() => {
    if (noWebsiteMode && outcome !== "positive_replies") setOutcome("positive_replies");
  }, [noWebsiteMode, outcome]);
  // Baseline for the model step's Update button: the primary funnel's draft as it
  // stood when the step was shown. Captured here rather than at each of the several
  // places that can ENTER the step (the funnel screens' Continue, the offer step's
  // Back, a fresh page load resuming at `model`), so no entry path can forget it.
  // Cleared on leaving so re-entering re-seeds against whatever was written since.
  useEffect(() => {
    if (step !== "model") {
      if (modelEconomicsBaseline !== null) setModelEconomicsBaseline(null);
      return;
    }
    if (modelEconomicsBaseline !== null) return;
    const draft = modelFunnelDraft();
    if (draft) setModelEconomicsBaseline(serializeFunnelDraft(draft));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, primaryFunnelKey, modelEconomicsBaseline]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setBusy(false);
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Where a post-URL refresh should land once its backing data is re-hydrated. Computed
  // once from the snapshot; null when there's nothing to replay (fresh start, or a
  // welcome/url snapshot that needs no backing data — those restore directly above).
  // A Stripe checkout return (?launch_checkout=success|cancelled) is owned end-to-end
  // by the dedicated checkout effect (resumeCheckoutLaunch / the cancel branch below).
  // The generic resume MUST NOT also fire for it — otherwise both run on mount and
  // race: the generic one re-hydrates the brand and lands on "pricing", flashing the
  // budget modal over the real "launching" flow. Null here = the generic resume effect
  // no-ops on any checkout return.
  const resumeTargetRef = useRef<Step | null>(
    !searchParams.get("launch_checkout") &&
    restored &&
    !["welcome", "url"].includes(resolveResumeStep(restored.step, restored.brandId))
      ? resolveResumeStep(restored.step, restored.brandId)
      : null,
  );
  const resumeStartedRef = useRef(false);

  function buildOnboardingState(opts?: { step?: Step; checkoutBudgetUsd?: number | null }): PersistedOnboardingState {
    return {
      version: ONBOARDING_STATE_VERSION,
      flowKey,
      step: opts?.step ?? step,
      url,
      noWebsiteMode,
      brandName,
      brandContext,
      outcome,
      rates,
      rateText,
      services,
      clickDestinationUrl,
      profile,
      selectedBudget,
      customBudget,
      checkoutBudgetUsd: opts?.checkoutBudgetUsd ?? checkoutBudgetUsd,
      audiencePrompt,
      audienceCandidates,
      selectedAudienceIds,
      workflowProjection: projectionRef.current,
      salesInputs: salesInputsRef.current,
      launchFeatureInputs: launchFeatureInputsRef.current,
      brandId,
      orgId: orgIdRef.current,
      servicesEdited: servicesEditedRef.current,
      ratesEdited: ratesEditedRef.current,
    };
  }

  // Persist the in-progress wizard on every change so a refresh / back resumes here.
  // Skipped only while Stripe success owns the launch path. A cancelled checkout must
  // keep writing the restored full snapshot so further edits persist normally.
  useEffect(() => {
    if (searchParams.get("launch_checkout") === "success") return;
    writeOnboardingState(buildOnboardingState());
  }, [step, url, noWebsiteMode, brandName, brandContext, outcome, rates, rateText, services, clickDestinationUrl, profile, selectedBudget, customBudget, checkoutBudgetUsd, audiencePrompt, audienceCandidates, selectedAudienceIds, brandId, flowKey, searchParams, pricingHydrationVersion]);

  // Replay the loading screen ONCE to re-fetch the brand-backed data (services,
  // economics, projection, feature inputs) the deeper steps depend on, then land the
  // user back on the exact step they were on. The brand already exists → idempotent.
  async function runResume(target: Step, urlOverride?: string): Promise<void> {
    setStep("loading");
    resetLoadingProgress();
    try {
      await createBrandAndFetchServices({ isResume: true, urlOverride });
      setStep(target);
    } catch (err) {
      if (isInsufficientCredit(err)) {
        // Welcome credit ran out during re-hydration — the add-credit modal auto-opened;
        // resume the replay on credit add instead of bouncing to the URL step.
        creditRetryRef.current = () => runResume(target);
        return;
      }
      console.error("[dashboard] onboarding resume failed:", err);
      setStep("url");
    }
  }

  useEffect(() => {
    if (!resumeTargetRef.current || resumeStartedRef.current) return;
    resumeStartedRef.current = true;
    if (!restored?.brandId || !restored.url) {
      // No brand to re-hydrate from — fall back to the URL step (fields stay filled).
      resumeTargetRef.current = null;
      setStep("url");
      return;
    }
    void runResume(resumeTargetRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-session brand resume (?brandId=, no snapshot): the per-brand setup gate
  // redirected a never-finished brand here. Fetch it to seed the URL, then replay the
  // loading-screen hydration (idempotent upsert + services/economics/projection/
  // audience prewarm from backend) and land on the goal step — the user re-confirms
  // goal → rates → audiences → consent → budget with everything before it prefilled.
  // We stop at the goal step (not budget) because the pre-terminal audience picks +
  // budget tier live only in the sessionStorage snapshot, which is gone cross-session
  // — so the user must re-pick those, but nothing typed earlier is lost (it's saved
  // in backend and re-hydrated). A live snapshot (same tab) wins and skips this.
  const paramResumeStartedRef = useRef(false);
  useEffect(() => {
    if (paramResumeStartedRef.current) return;
    if (!resumeBrandIdParam || restored || searchParams.get("launch_checkout")) return;
    paramResumeStartedRef.current = true;
    void (async () => {
      try {
        const res = await getBrand(resumeBrandIdParam);
        const b = res?.brand;
        const seededUrl = b ? b.url ?? (b.domain ? `https://${b.domain}` : "") : "";
        if (!seededUrl) {
          // Brand vanished / has no URL — fall back to the URL step rather than trap
          // the user on a stuck loading screen.
          setStep("url");
          return;
        }
        setUrl(seededUrl);
        setBrandId(resumeBrandIdParam);
        brandIdRef.current = resumeBrandIdParam;
        if (organization?.id) orgIdRef.current = organization.id;
        // v2 has no single-goal step; its equivalent landing point is the funnels.
        await runResume("funnels", seededUrl);
      } catch (err) {
        console.error("[dashboard] onboarding brand-param resume failed:", err);
        setStep("url");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The website the visitor typed on the landing, recovered from the cookie
  // `LandingUrlCapture` parked at sign-up, and rendered back as a full URL.
  //
  // Two jobs, both on the seed only, never on a keystroke:
  //   1. RECOVER. `?url=` rides `redirectUrlComplete` through Clerk and can be
  //      dropped by the OAuth round-trip or by the first-run edge gate bouncing
  //      to a bare `/onboarding`. When that happens the field falls through to
  //      the email guess below, which is a bare host BY CONSTRUCTION — so
  //      "voozaa.app/us/" typed on the landing arrives as "voozaa.app" and the
  //      page the visitor actually named is lost. The cookie survives both hops.
  //   2. RENDER AS A URL. A bare host in a field labelled with a website reads
  //      as a token someone half-remembered; "https://voozaa.app/us/" reads as
  //      the page they gave us. `extractDomain` is untouched, so the brand
  //      domain, the org name and the header still resolve exactly as before —
  //      this is what the field SHOWS, not what the brand IS.
  //
  // Ordered ABOVE the email-guess effect on purpose: effects run in declaration
  // order, so this fills first and the guess then sees a non-empty field and
  // bails. Runs once, and only while the field still holds its seed, so it can
  // never rewrite something the visitor has started typing.
  const landingUrlSeedRef = useRef(false);
  useEffect(() => {
    if (landingUrlSeedRef.current) return;
    landingUrlSeedRef.current = true;
    if (noWebsiteMode) return;
    let consumedCookie = false;
    setUrl((current) => {
      const normalizedCurrent = normalizeLandingUrl(current);
      if (normalizedCurrent) return normalizedCurrent;
      if (current.trim()) return current;
      const fromCookie = readLandingUrlCookie(document.cookie);
      if (!fromCookie) return current;
      consumedCookie = true;
      return fromCookie;
    });
    // Expire it only once it has actually landed in the field — the value now
    // lives in state and in the persisted snapshot, and leaving it would prefill
    // a later "add another brand" flow with the FIRST brand's website.
    if (consumedCookie) document.cookie = clearLandingUrlCookieString();
  }, [noWebsiteMode]);

  // A business signup email names the domain of the product being promoted
  // (kevin@acme.com -> acme.com), so the URL step opens prefilled and one click
  // from "Analyze my product". Google signup is covered by the same path: Clerk
  // exposes the same primary email whichever provider minted the session, so
  // there is nothing provider-specific to branch on.
  //
  // This is the WEAKEST of the three url sources and must stay that way. A
  // restored snapshot and an explicit `?url=` carry are both stated intent and
  // win from the `useState` initializer; the email domain is a guess, so it only
  // ever fills an EMPTY field. The functional `setUrl` keeps that check atomic
  // with the current state, so the effect cannot land on top of a keystroke.
  //
  // Free / personal / disposable providers yield null (see `free-email-domains.ts`):
  // sending someone to analyze Gmail's website is worse than an empty field.
  const emailPrefillDoneRef = useRef(false);
  useEffect(() => {
    if (emailPrefillDoneRef.current) return;
    // The no-website path collects a brand name + a free-form description instead
    // of a URL, so there is no field to prefill.
    if (noWebsiteMode) return;
    const guessed = businessDomainFromEmail(signupEmail);
    // Clerk hydrates async — keep waiting until the email resolves (or turns out
    // to be a free provider, in which case the next run bails here again).
    if (!guessed) return;
    emailPrefillDoneRef.current = true;
    // Rendered as a URL for the same reason the landing carry is: the field asks
    // for a website, so it should show one. Same value either way — the guess is
    // a bare host, and `extractDomain` reduces it right back.
    setUrl((current) => (current.trim() ? current : normalizeLandingUrl(guessed) ?? guessed));
  }, [signupEmail, noWebsiteMode]);

  function maybeAdvancePastLoading() {
    if (fetchDoneRef.current) setStep("services");
  }

  function resetLoadingProgress() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLoadStep(0);
    fetchDoneRef.current = false;
    loadingStartedAtRef.current = performance.now();
  }

  function captureSetupMilestone(milestone: string, startedAt?: number) {
    const now = performance.now();
    const elapsedMs = loadingStartedAtRef.current == null ? null : Math.round(now - loadingStartedAtRef.current);
    const durationMs = startedAt == null ? null : Math.round(now - startedAt);
    const props = { flow: "beta", domain, milestone, elapsed_ms: elapsedMs, duration_ms: durationMs };
    posthog.capture("onboarding_setup_milestone", props);
    console.info("[dashboard] onboarding setup milestone", props);
  }

  async function hydrateOnboardingInBackground(id: string): Promise<void> {
    // Warm ONLY the 7 user-facing fields (services + the 6 offer levers) in suggest
    // mode — the offer step reads these via getBrandUserFields and needs a best-effort
    // value for every lever (never "Unknown"). The backend-only SALES_PROFILE_FIELDS
    // (funding/competitors/leadership/...) are NOT extracted here: onboarding never reads
    // them, and the brand-info alpha page regenerates them on demand.
    await extractBrandFields([id], USER_PROFILE_FIELDS, { mode: "suggest" }).catch((e) => {
      console.error("[dashboard] extractBrandFields (background) failed:", e);
    });

    // Pre-warm the audience step: now that the brand profile is extracted, draft
    // the ICP prompt and fire the audience suggest in the background. By the time
    // the user clicks through services/goal/rates to the audience step, candidates
    // are ready. Fail-soft — a failed ICP/suggest resolves candidates:null and the
    // step falls back to its own draft + manual "Suggest audiences".
    const audiencePrewarm = (async (): Promise<{ prompt: string; candidates: AudienceCandidate[] | null; icpFailed: boolean }> => {
      // Fetch the real ICP first and HOLD it independently of the audience-suggest
      // step. suggestAudiences is flaky (fails often); if it throws AFTER the ICP
      // already resolved, we must still return that ICP — otherwise the real
      // brand-service ICP is discarded and the step shows the generic fallback
      // "Find the ideal customers for <brand>" line. candidates stay null so the
      // step renders the real ICP + a manual "Find my perfect audiences" retry.
      let prompt = "";
      try {
        const { icp } = await suggestBrandIcp(id);
        prompt = icp.trim();
        // An ICP that came back empty is the same situation as one that threw: we
        // have nothing brand-service drafted, so the step must not present its own
        // sentence as one.
        if (!prompt) return { prompt: "", candidates: null, icpFailed: true };
        const { candidates } = await suggestAudiences(id, prompt);
        return { prompt, candidates, icpFailed: false };
      } catch (e) {
        console.error("[dashboard] audience prewarm (ICP + suggest) failed:", e);
        return { prompt, candidates: null, icpFailed: !prompt };
      }
    })();
    setAudiencePrefetch({ promise: audiencePrewarm });

    const [prof, econRes, proj, feat] = await Promise.all([
      getBrandUserFields(id),
      getSalesEconomicsEffective(id),
      getWorkflowProjection({
        featureSlug: SALES_FEATURE_SLUG,
        brandId: id,
        objective: salesObjectiveForOptimizationGoal(optimizationGoalForOutcome(outcome)),
        budgetUsd: PROJECTION_REF_BUDGET,
      }),
      getFeature(SALES_FEATURE_SLUG),
    ]);

    salesInputsRef.current = feat.feature.inputs ?? [];
    // Seed the profile bag + provenance from the confirmed user-fields. Each of
    // the 7 keys carries a value (confirmed, else the model prefill); the offer
    // levers read their prefill from here + badge the confirmed ones.
    {
      const uf = prof.fields;
      const seeded: Record<string, string | string[]> = {};
      for (const key of USER_FIELD_KEYS) {
        const v = uf[key]?.value;
        if (v == null) continue;
        // Normalise to the lever's KIND on the way in. Extraction is generative, so a
        // text-kind lever regularly comes back as string[]; seeding that array raw meant
        // a lever the user never edited was SAVED as an array, and every text-kind editor
        // downstream (Strategy, admin) then rendered it as "not set" and blanked it on the
        // next save. This is where the bad rows were born, so it is where they stop.
        seeded[key] = isListLeverKey(key) ? coerceListField(v) : coerceTextField(v);
      }
      const nextServices = normalizeServices(uf.services?.value);
      setProfile((prev) => ({
        ...prev,
        ...seeded,
        services: servicesEditedRef.current || nextServices.length === 0 ? prev.services ?? nextServices : nextServices,
      }));
      // Two guards, two different situations. `servicesEditedRef` protects a list the
      // user curated. `prev.length` protects one the loading-screen extract already
      // filled: this hydrate resolves tens of seconds later, so a bare `setServices`
      // here swaps the list out from under whoever is reading the step.
      if (!servicesEditedRef.current && nextServices.length > 0) setServices((prev) => (prev.length ? prev : nextServices));
      setFieldProvenance((prev) => {
        const next = { ...prev };
        for (const key of USER_FIELD_KEYS) {
          const p = uf[key]?.provenance;
          if (p) next[key] = p;
        }
        return next;
      });
    }
    if (econRes.economics && !ratesEditedRef.current) {
      const e = econRes.economics;
      econRef.current = e;
      // Cap the prefilled DEFAULT to a single decimal (8.8429 → 8.8). The backend
      // economics carry full precision; we never seed a default with more than one
      // decimal digit. The user can still type finer precision manually.
      const round1 = (n: number) => Math.round(n * 10) / 10;
      const loaded: Record<RateKey, number> = {
        ltv: round1(e.lifetimeRevenueUsd),
        v2s: round1(e.visitToSignupPct),
        s2c: round1(e.signupToPaidClientPct),
        v2m: round1(e.visitToMeetingPct),
        r2m: round1(e.replyToMeetingPct),
        m2c: round1(e.meetingToClosePct),
        // The effective economics carry only the signup/meeting funnel + the derived
        // visit→close. Seed website_visits' visit→paid from visitToClosePct (same grain);
        // the reply/form beta rates have no effective-econ source → keep the seeded
        // defaults (the user tweaks them on the rates step).
        v2p: round1(e.visitToClosePct),
        r2p: rates.r2p,
        v2f: rates.v2f,
        f2p: rates.f2p,
      };
      setRates(loaded);
      setRateText(Object.fromEntries((Object.keys(loaded) as RateKey[]).map((k) => [k, rateToText(loaded[k])])) as Record<RateKey, string>);
    }
    projectionRef.current = proj;
    setPricingHydrationVersion((value) => value + 1);
  }

  async function waitForOnboardingHydration(): Promise<void> {
    if (!hydrationPromiseRef.current) return;
    await hydrationPromiseRef.current;
  }

  // Clerk auto-creates an org at signup (it is active BEFORE onboarding runs), so
  // onboarding always takes the org-REUSE path below and its create-time naming
  // (`createOrganization({ name })`) never applies — the breadcrumb then shows
  // Clerk's auto-name, observed as junk like "404: NOT_FOUND". On a FRESH signup
  // (flowKey "signup" — NOT "add"/"new", so a multi-brand org's name is never
  // clobbered and the "new"-org create path already names its own org) rename the
  // reused active org to the brand identity. Best-effort + fail-loud: a cosmetic
  // breadcrumb rename must never block the paid launch, but a failure is logged.
  function maybeRenameFreshSignupOrg(orgId: string, orgName: string) {
    if (flowKey !== "signup") return;
    if (!organization || organization.id !== orgId || !orgName) return;
    void organization.update({ name: orgName }).catch((e) => {
      console.error("[dashboard] onboarding fresh-signup org rename failed:", e);
    });
  }

  // Create the brand for real, then block only on the services needed by the next step.
  // On a RESUME (refresh after the brand was already created) the org + brand already
  // exist: force org reuse so we never spin up a duplicate org, and the idempotent
  // upsertBrand below returns the same brandId.
  async function createBrandAndFetchServices(opts?: { isResume?: boolean; urlOverride?: string }): Promise<void> {
    const isResume = opts?.isResume ?? false;
    // `urlOverride` — the cross-session param-resume seeds the brand URL and calls
    // runResume in the SAME tick, so `url` state is still stale in this closure;
    // the override carries the freshly-fetched URL to the idempotent upsert below.
    const trimmed = (opts?.urlOverride ?? url).trim();
    const brandUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const workspaceStartedAt = performance.now();
    const reuseOrgId = organization?.id ?? orgIdRef.current ?? null;
    const reuseOrg = (isResume || !forceNew) && !!reuseOrgId;
    let targetOrgId: string;
    if (reuseOrg) {
      targetOrgId = reuseOrgId!;
      maybeRenameFreshSignupOrg(targetOrgId, domain ?? hostname);
    } else {
      if (!createOrganization || !setActive) {
        throw new Error("Organization setup is not ready yet. Please try again.");
      }
      const org = await createOrganization({ name: domain ?? hostname });
      await setActive({ organization: org.id });
      targetOrgId = org.id;
    }
    captureSetupMilestone("organization_ready", workspaceStartedAt);
    setLoadStep(1);
    const brandStartedAt = performance.now();
    const previousBrandId = brandIdRef.current;
    const { brandId: newBrandId, name: createdBrandName } = await upsertBrand(brandUrl);
    captureSetupMilestone("brand_upserted", brandStartedAt);
    // The step header switches from "acme.com" to "Acme Consulting" here. null while
    // brand-service has not resolved a name yet, which the header reads as "keep
    // showing the domain" rather than as an empty label.
    setResolvedBrandName(createdBrandName);
    // Brand SWITCH (user edited the URL → a different brand): every brand-derived
    // prefill in state is now stale (ICP prompt, suggested audiences, rate defaults).
    // Drop them + clear the "user edited" guards so the fresh hydration reseeds the
    // new brand cleanly. Without this the audience step's seed effect sees the OLD
    // prompt/candidates ("already filled") and keeps the previous brand's ICP +
    // audiences; rates stay stale because ratesEditedRef is still set. A same-brand
    // RESUME has equal ids → no reset → user edits preserved.
    if (previousBrandId && previousBrandId !== newBrandId) {
      setAudiencePrompt("");
      setAudienceCandidates(null);
      setSelectedAudienceIds([]);
      servicesEditedRef.current = false;
      ratesEditedRef.current = false;
    }
    setLoadStep(2);
    // NOTE: onboarding is marked complete only at the END of the flow (in
    // launch(), after the campaign is created) — NOT here. Marking it complete
    // at brand creation set the edge-gate signal 6 steps early, so a mid-flow
    // refresh / manual dashboard-URL nav slipped past proxy.ts onto a half-set-up
    // dashboard (no rates/personas/consent/campaign). See launch(). (#1770)
    // Extract only the service list before moving forward. The heavier profile,
    // persona, economics and projection work continues after the services step is usable.
    const servicesStartedAt = performance.now();
    const serviceFields = await extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { urlStrategy: "landing", mode: "suggest" }).catch((e) => {
      console.error("[dashboard] extractBrandFields failed:", e);
      captureSetupMilestone("services_extract_failed", servicesStartedAt);
      return null;
    });
    if (serviceFields) captureSetupMilestone("services_extracted", servicesStartedAt);
    // The `.catch` above must stay — a failed extraction cannot strand someone on
    // the loading screen — but swallowing it into `null` and walking on is what left
    // the next step claiming it had drafted a list it never received. Record the
    // outcome so that step can state which of the three things happened.
    setServicesExtractFailed(!serviceFields);
    brandIdRef.current = newBrandId;
    orgIdRef.current = targetOrgId;
    setBrandId(newBrandId);
    // Remember the brand for the edge gate. Everything from here on is persisted
    // in brand-service, but the wizard's own progress is not: it lives in
    // sessionStorage, so closing the tab loses it, and `onboardingComplete` is
    // only written at the terminal launch — so the gate bounces the user back here
    // and needs to be told which brand to resume. Cleared at launch.
    document.cookie = onboardingBrandCookieAssignment(targetOrgId, newBrandId);
    posthog.capture("onboarding_brand_created", { flow: "beta", org_id: targetOrgId, brand_id: newBrandId });
    const serviceValue = serviceFields?.fields.services?.value;
    if (serviceValue != null) {
      const nextServices = normalizeServices(serviceValue);
      if (nextServices.length > 0) {
        // Never clobber services the user edited on the services step. A same-brand
        // re-analyze (edit-brand → url → analyze) keeps servicesEditedRef true here
        // (the brand-switch reset above only fires when the brandId actually changes),
        // so mirror hydrateOnboardingInBackground's guard and keep the user's edits.
        setProfile((prev) => ({
          ...prev,
          services: servicesEditedRef.current ? prev.services ?? nextServices : nextServices,
        }));
        if (!servicesEditedRef.current) setServices((prev) => (prev.length ? prev : nextServices));
      }
    }
    fetchDoneRef.current = true;
    setLoadStep(LOADING_STEPS.length);
    // The hydrate is the only thing that can still deliver a list once the fast
    // extraction has failed, so the services step needs to know it is running —
    // otherwise its empty state reads as a verdict rather than as a wait.
    setServicesHydrating(true);
    const hydration = hydrateOnboardingInBackground(newBrandId)
      .catch((e) => {
        console.error("[dashboard] onboarding background hydrate failed:", e);
      })
      .finally(() => setServicesHydrating(false));
    hydrationPromiseRef.current = hydration;
  }

  async function startAnalyze() {
    if (!domain) return;
    // Seed the click destination from a sub-page typed in the "What are we promoting?"
    // step (e.g. acme.com/pricing) — same as the landing ?url= prefill, but for a URL
    // entered inside onboarding rather than carried in at mount. Preserve an
    // already-customized value (|| keeps a user-set destination; a bare domain → "").
    setClickDestinationUrl((prev) => prev || subpageDestinationFromUrl(url));
    setError(null);
    setStep("loading");
    resetLoadingProgress();
    posthog.capture("onboarding_workspace_create_started", { flow: "beta", domain });
    captureSetupMilestone("started");
    try {
      await createBrandAndFetchServices();
      maybeAdvancePastLoading();
    } catch (err) {
      if (isInsufficientCredit(err)) {
        // Welcome credit ran out during AI setup. The add-credit modal is already
        // open (auto-fired on the 402); stay on the loading screen and resume on credit add
        // instead of bouncing back to the URL step with a raw error.
        creditRetryRef.current = () => startAnalyze();
        return;
      }
      posthog.capture("onboarding_workspace_create_failed", { flow: "beta", domain });
      timers.current.forEach(clearTimeout);
      console.error("[dashboard] onboarding setup failed:", err);
      setError(displaySetupError(err));
      setStep("url");
    }
  }

  // Switch the URL step into the no-website path: swap the URL input for a brand
  // name + free-form business-context block, and lock the goal to positive_replies
  // (no site → no clicks/visits to optimize for).
  function enterNoWebsiteMode() {
    setError(null);
    setNoWebsiteMode(true);
    setOutcome("positive_replies");
  }

  // Create the no-website brand for real (null URL + pasted context), then block only
  // on the services the next step needs. Mirrors createBrandAndFetchServices but with
  // no URL: the org is named after the brand, the brand is created via the isolated
  // createBrandWithoutWebsite helper (create null-url brand + persist context BEFORE
  // extraction), and extraction reads that stored context instead of scraping a site.
  async function createBrandNoWebsiteAndFetchServices(): Promise<void> {
    const name = brandName.trim();
    const context = brandContext.trim();
    const workspaceStartedAt = performance.now();
    const reuseOrgId = organization?.id ?? orgIdRef.current ?? null;
    const reuseOrg = !forceNew && !!reuseOrgId;
    let targetOrgId: string;
    if (reuseOrg) {
      targetOrgId = reuseOrgId!;
      maybeRenameFreshSignupOrg(targetOrgId, name);
    } else {
      if (!createOrganization || !setActive) {
        throw new Error("Organization setup is not ready yet. Please try again.");
      }
      const org = await createOrganization({ name });
      await setActive({ organization: org.id });
      targetOrgId = org.id;
    }
    captureSetupMilestone("organization_ready", workspaceStartedAt);
    setLoadStep(1);
    const brandStartedAt = performance.now();
    // Isolated best-guess seam: create the null-url brand + persist the pasted
    // context BEFORE extraction. The orchestrator conforms this to the real
    // brand-service contract once deployed.
    const { brandId: newBrandId } = await createBrandWithoutWebsite(name, context);
    captureSetupMilestone("brand_upserted", brandStartedAt);
    setLoadStep(2);
    const servicesStartedAt = performance.now();
    const serviceFields = await extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { mode: "suggest" }).catch((e) => {
      console.error("[dashboard] extractBrandFields (no-website) failed:", e);
      captureSetupMilestone("services_extract_failed", servicesStartedAt);
      return null;
    });
    if (serviceFields) captureSetupMilestone("services_extracted", servicesStartedAt);
    setServicesExtractFailed(!serviceFields);
    brandIdRef.current = newBrandId;
    orgIdRef.current = targetOrgId;
    setBrandId(newBrandId);
    // Same resume cookie as the website path — see the note there.
    document.cookie = onboardingBrandCookieAssignment(targetOrgId, newBrandId);
    posthog.capture("onboarding_brand_created", { flow: "beta", org_id: targetOrgId, brand_id: newBrandId, no_website: true });
    const serviceValue = serviceFields?.fields.services?.value;
    if (serviceValue != null) {
      const nextServices = normalizeServices(serviceValue);
      if (nextServices.length > 0) {
        setProfile((prev) => ({
          ...prev,
          services: servicesEditedRef.current ? prev.services ?? nextServices : nextServices,
        }));
        if (!servicesEditedRef.current) setServices((prev) => (prev.length ? prev : nextServices));
      }
    }
    fetchDoneRef.current = true;
    setLoadStep(LOADING_STEPS.length);
    setServicesHydrating(true);
    const hydration = hydrateOnboardingInBackground(newBrandId)
      .catch((e) => {
        console.error("[dashboard] onboarding background hydrate (no-website) failed:", e);
      })
      .finally(() => setServicesHydrating(false));
    hydrationPromiseRef.current = hydration;
  }

  async function startAnalyzeNoWebsite() {
    if (!brandName.trim() || !brandContext.trim()) return;
    setError(null);
    setStep("loading");
    resetLoadingProgress();
    posthog.capture("onboarding_workspace_create_started", { flow: "beta", no_website: true });
    captureSetupMilestone("started");
    try {
      await createBrandNoWebsiteAndFetchServices();
      maybeAdvancePastLoading();
    } catch (err) {
      if (isInsufficientCredit(err)) {
        creditRetryRef.current = () => startAnalyzeNoWebsite();
        return;
      }
      posthog.capture("onboarding_workspace_create_failed", { flow: "beta", no_website: true });
      timers.current.forEach(clearTimeout);
      console.error("[dashboard] onboarding no-website setup failed:", err);
      setError(displaySetupError(err));
      setStep("url");
    }
  }

  async function resolveStoredEconomics(brandId: string): Promise<EffectiveSalesEconomics> {
    if (econRef.current) return econRef.current;
    const { economics } = await getSalesEconomicsEffective(brandId);
    if (!economics) {
      throw new Error("Your conversion rates could not be loaded. Please try again.");
    }
    econRef.current = economics;
    // ALSO state, not only the ref: the funnel detail screens seed their conversion
    // rates from this, and a ref lands with no re-render — the form would stay blank
    // under copy that says we prefilled it. `funnelDraft` derives the seed at render,
    // so an untouched field picks the values up the moment they arrive.
    setStoredEconomics(economics);
    return economics;
  }

  // The post-payment steps run on a FRESH page load (the Stripe return), where the
  // loading-screen hydration never ran — warm the stored economics so the lifetime
  // revenue field shows the brand's real number instead of a blank, and so its save
  // does not wait on a cold read. Best-effort: the save resolves them again, fail-loud,
  // if this did not land.
  function prewarmStoredEconomics(brandId: string): void {
    void resolveStoredEconomics(brandId)
      .then((economics) => {
        if (ltvEditedRef.current) return;
        const ltv = Math.round(economics.lifetimeRevenueUsd);
        setRates((current) => ({ ...current, ltv }));
        setRateText((current) => ({ ...current, ltv: rateToText(ltv) }));
      })
      .catch((err) => {
        console.error("[dashboard] onboarding: stored economics prewarm failed", err);
      });
  }

  async function buildFeatureInputsForLaunch(id: string): Promise<Record<string, string>> {
    if (launchFeatureInputsRef.current) return launchFeatureInputsRef.current;
    await waitForOnboardingHydration();
    const inputs =
      salesInputsRef.current.length > 0
        ? salesInputsRef.current
        : (await getFeature(SALES_FEATURE_SLUG)).feature.inputs ?? [];
    salesInputsRef.current = inputs;
    const prefilled = prefillToStringMap(
      (await prefillFeatureInputs(SALES_FEATURE_SLUG, [id])).prefilled,
    );
    const featureInputs: Record<string, string> = {};
    for (const input of inputs) {
      const val = prefilled[input.key]?.trim();
      if (val) featureInputs[input.key] = val;
    }
    launchFeatureInputsRef.current = featureInputs;
    return featureInputs;
  }

  // The real launch work — audiences, auto-topup, budget, campaign create,
  // onboarding-complete. Run in the BACKGROUND right after checkout (see
  // startBackgroundLaunch), so it can complete even if the user quits before the
  // dashboard. Does NOT navigate or clear the resume snapshot — the terminal
  // (finalizePostPaymentAndLaunch) owns that, so a mid-flow refresh can still resume
  // the optional post-payment steps. Uses the as-of-checkout profile; the terminal
  // re-saves any offer-lever edits on top. Returns the created campaign id.
  async function runLaunchWork(pending: PendingCheckoutLaunch): Promise<{ campaignId: string }> {
    // Confirm the 7 user-fields (services + the offer levers). Every key sent is
    // marked "confirmed" server-side.
    // NOTE: agency consent is ASKED on the onboarding consent step (kept), but by
    // decision it is NOT persisted — it used to piggyback on the deprecated
    // brand-profile document, has no home in the 7-field model, and nothing reads
    // it, so no backend consent endpoint is built. (Kevin 2026-07-21.)
    if (pending.profile && pending.services) {
      await saveBrandUserFields(pending.brandId, buildUserFieldsPayload(pending.profile, pending.services));
    }
    // Activation happens ONLY here, at the TERMINAL launch commit — never at the
    // audience step (a re-roll / Back-then-re-pick there used to activate each
    // intermediate set additively, leaving stale `active` rows the audiences page
    // then showed → "I picked 2 but see 5"). The picked set is made the brand's
    // EXACT active set: any audience currently `active` for the brand that is NOT in
    // the final picks is sent back to `suggested` (recoverable, hidden from the page),
    // so re-doing onboarding OVERRIDES the prior selection instead of stacking on it.
    // A launched campaign with zero active audiences is a hard dead end (the
    // dashboard's "No active audience yet" blocker — outreach can't run), so we
    // fail loud on an empty pick. Done BEFORE avatar generation so the server-side
    // on-activate avatar gen covers the freshly-active rows.
    const launchAudienceIds = pending.onboardingState.selectedAudienceIds ?? [];
    if (launchAudienceIds.length === 0) {
      throw new Error("No audience was selected — go back and pick at least one audience before launching.");
    }
    const pickedSet = new Set(launchAudienceIds);
    const { audiences: currentlyActive } = await listAudiences(pending.brandId, { status: "active" });
    for (const a of currentlyActive) {
      if (!pickedSet.has(a.id)) await setAudienceStatus(a.id, "suggested");
    }
    for (const audienceId of launchAudienceIds) {
      await setAudienceStatus(audienceId, "active");
    }
    await configureAutoTopup(pending.topupAmountCents, pending.topupThresholdCents);
    setLaunchStep(1);
    // Fund each funnel it its own ceiling. billing then answers the brand's daily
    // budget as their SUM, so every consumer that reads the brand total — the launch
    // gate, the runway, the credit alerts, the Overview tile — is unchanged.
    //
    // A blob written before per-funnel funding shipped carries no map; it falls back
    // to the single brand-level write, which is exactly what it expected to happen.
    const funnelBudgetRows = Object.entries(pending.funnelBudgets ?? {})
      .filter(([, usd]) => usd > 0)
      .map(([funnelKey, usd]) => ({ funnelKey, dailyBudgetCents: Math.round(usd * 100) }));
    if (funnelBudgetRows.length > 0) {
      await stateBrandFunnelBudgets(pending.brandId, funnelBudgetRows);
    } else {
      await saveBrandDailyBudget(pending.brandId, Math.round(pending.budgetUsd * 100));
    }
    setLaunchStep(2);
    // Audience avatars are generated server-side by human-service the moment an
    // audience flips to `active` (org-billed, fire-and-forget, idempotent), so the
    // onboarding no longer generates them here — that would race the server gen and
    // double-bill. See human-service #144.
    setLaunchStep(3);
    // The campaign states which funnel it sells, and it is one the customer just
    // FUNDED a few lines above — the same map billing was written from, so the
    // campaign and its ceiling can never name different funnels. When several are
    // funded, exactly ONE campaign is created here (the primary funded funnel, else
    // the first funded one in catalogue order) and campaign-service provisions the
    // rest, one per funded funnel, on its next tick.
    const launchFunnelKey = fundedLaunchFunnelKey(pending.funnelBudgets ?? {}, pending.primaryFunnelKey);
    if (!launchFunnelKey) {
      throw new Error(
        "No sales funnel was funded for this launch. Go back and fund at least one funnel before launching.",
      );
    }
    const featureInputs = pending.featureInputs ?? await buildFeatureInputsForLaunch(pending.brandId);
    const { campaign } = await createCampaignWithoutBrandEnrichment({
      funnelKey: launchFunnelKey,
      name: `${pending.hostname} — ${OUTCOMES.find((o) => o.key === pending.outcome)?.label ?? "Outreach"}`,
      workflowSlug: pending.workflowSlug,
      // A no-website brand carries no URL; it's already created by name, so the
      // gateway takes its brandId directly (a website brand passes brandUrls, which
      // the gateway upserts to a brandId). Exactly one is sent.
      ...(pending.brandUrl
        ? { brandUrls: [pending.brandUrl] }
        : { brandIds: [pending.brandId] }),
      featureSlug: SALES_FEATURE_SLUG,
      featureInputs,
      maxBudgetDailyUsd: String(pending.budgetUsd),
    });
    setLaunchStep(4);
    posthog.capture("onboarding_completed", {
      flow: "beta",
      outcome: pending.outcome,
      budget: pending.budgetUsd,
      checkout_amount_cents: pending.checkoutAmountCents,
      topup_amount_cents: pending.topupAmountCents,
      topup_threshold_cents: pending.topupThresholdCents,
    });
    // Mark onboarding complete ONLY now — the flow is genuinely finished (a real
    // campaign launched). This is the edge-gate signal proxy.ts reads; setting it
    // earlier (at brand creation) let a mid-flow refresh bypass the rest of the
    // wizard onto the dashboard (DIS-111 / first-run gate). (#1770)
    await fetch("/api/onboarding/complete", { method: "POST" }).catch((e) =>
      console.error("[dashboard] failed to mark onboarding complete:", e),
    );
    // Re-mint the session token so the fresh `orgMeta.onboardingComplete` claim is
    // in the cookie the edge gate reads BEFORE we navigate — otherwise the stale
    // JWT loops the next navigation back to /onboarding (DIS-111).
    await session?.getToken({ skipCache: true }).catch(() => {});
    setLaunchStep(5);
    // Email 2 — the post-payment "your <goal> is on the way" welcome. Fired here (not
    // at signup, where no brand/goal exists yet) so it can name the brand's chosen
    // optimization goal. Routed to the user server-side (not an admin event); repeatable
    // per launch. Fire-and-forget — never block the redirect.
    sendAuthNotification("goal_launched", undefined, {
      outcomeNoun: outcomeNounPlural(pending.outcome),
    }).catch(() => {});
    return { campaignId: campaign.id };
  }

  // Fire the full launch ONCE, in the background, the moment checkout returns. Idempotent
  // via `backgroundLaunchRef` (never creates two campaigns). A failure is surfaced at the
  // terminal launching screen (launchError) with a retry; the fire-site swallow keeps it
  // from becoming an unhandled rejection while the user is still on an earlier step.
  function startBackgroundLaunch(): Promise<{ campaignId: string }> {
    if (backgroundLaunchRef.current) return backgroundLaunchRef.current;
    const pending = pendingCheckoutRef.current;
    if (!pending) {
      return Promise.reject(new Error("Your checkout session was lost. Refresh to finish launching."));
    }
    const promise = runLaunchWork(pending);
    backgroundLaunchRef.current = promise;
    promise.catch((err) => {
      posthog.capture("onboarding_launch_failed", { flow: "beta", stage: "background_launch" });
      const detail = err instanceof Error ? err.message : "unknown error";
      setLaunchError(`Launch could not finish: ${detail}`);
      // Allow a retry from the terminal screen to re-run the work.
      backgroundLaunchRef.current = null;
    });
    return promise;
  }

  // Fetch the best-model projection LADDER (same endpoint + pick as the Strategy page,
  // so the numbers match). Prewarmed at the celebrate step, refetched after the LTR save.
  //
  // Keyed on the primary FUNNEL, never on a goal. `sales_meetings` covers both meeting
  // funnels, so a goal-keyed request is priced from BOTH channels (`clicks·visitToMeeting
  // + replies·replyToMeeting`) — and per dollar that buys ~86× more clicks than replies,
  // so the click leg supplies nearly every projected outcome. Two things then describe
  // the wrong chain: `recommendedWorkflowDynastySlug` is an argmin on that mixed cost, so
  // the workflow crowned BEST is whichever is cheapest per CLICK (its cost per reply is
  // incidental and can be several times the reply-cheapest one), and the economics beside
  // it price the website funnel. Measured on a conversation-led brand: $26 per meeting and
  // 26.8× return, where its own reply chain gives $283 and 2.1×.
  function fetchBestModelLadder(id: string, funnelKey: string | null): Promise<void> {
    const p = getWorkflowProjectionLadder({
      featureSlug: SALES_FEATURE_SLUG,
      brandId: id,
      ...(funnelKey ? { funnel: funnelKey as SalesFunnelKeyWire } : {}),
    })
      .then((ladder) => {
        setBestModelLadder(ladder);
      })
      .catch((e) => {
        console.error("[dashboard] onboarding: best-model ladder fetch failed", e);
      });
    bestModelFetchRef.current = p;
    return p;
  }

  // Build + persist the PendingCheckoutLaunch blob shared by BOTH launch paths:
  // the Stripe-checkout path (beginCheckoutAndLaunch, new orgs) and the direct
  // launch path (launchDirectlyWithoutCheckout, existing orgs adding a brand).
  // Throws (fail-loud) when any required launch input is missing; also writes the
  // wizard snapshot + the sessionStorage pending blob so a refresh can resume.
  function buildPendingLaunchBlob(): PendingCheckoutLaunch {
    const storedPending = readPendingCheckoutLaunchOrNull();
    const id = brandIdRef.current ?? storedPending?.brandId ?? null;
    const orgId = orgIdRef.current ?? storedPending?.orgId ?? null;
    // Same helper the summary callout and the checkout CTA read, so the charged amount
    // is the displayed amount by construction. Live selection wins: checkoutBudgetUsd is
    // only ever written from a restored/resumed snapshot, so after a checkout cancel it
    // holds the PRIOR budget and leading with it would charge the stale amount.
    const budget = budgetForCharge() ?? storedPending?.budgetUsd;
    const trimmed = url.trim();
    const normalizedCurrentUrl = trimmed ? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`) : null;
    // A no-website brand has no URL; its identity/hostname is the typed brand name.
    const brandUrl = noWebsiteMode ? null : normalizedCurrentUrl ?? storedPending?.brandUrl ?? null;
    const launchHostname = (noWebsiteMode ? brandName.trim() : hostname) || storedPending?.hostname || "";
    const launchOutcome = brandIdRef.current ? outcome : storedPending?.outcome ?? outcome;
    // brandUrl is required EXCEPT for a no-website brand (it legitimately has none).
    if (!id || !orgId || budget == null || (!brandUrl && !noWebsiteMode) || !launchHostname) {
      throw new Error("Checkout state is missing. Go back to pricing and try again.");
    }
    // Block launch when no audience is picked — outreach can't run without one, so
    // a campaign launched audience-less is a paid-for dead end. Live selection wins,
    // falling back to the resumed snapshot (same precedence as budget above).
    const launchAudienceIds = selectedAudienceIds.length
      ? selectedAudienceIds
      : storedPending?.selectedAudienceIds ?? storedPending?.onboardingState.selectedAudienceIds ?? [];
    if (launchAudienceIds.length === 0) {
      throw new Error("Pick at least one audience before launching — go back to the audience step.");
    }
    // Same live-selection-wins precedence as the audiences above, so a re-checkout after
    // a cancel carries whatever the user has picked NOW. Unlike audiences this is NOT a
    // launch gate: the per-funnel screens are a preview, so an empty selection must never
    // block a paid launch — it just means those screens have nothing to ask.
    const launchFunnelKeys = selectedFunnelKeys.length
      ? selectedFunnelKeys
      : storedPending?.selectedFunnelKeys ?? [];
    const launchPrimaryFunnelKey = primaryFunnelKey ?? storedPending?.primaryFunnelKey ?? null;
    // Live funding wins, the stored blob is the fallback — same precedence as the
    // selection, so a re-checkout after a cancel carries what the user funds NOW.
    const liveFunnelBudgets = Object.fromEntries(
      launchFunnelKeys
        .map((key) => [key, funnelBudgetUsd(key)] as const)
        .filter(([, usd]) => usd > 0),
    );
    const launchFunnelBudgets =
      Object.keys(liveFunnelBudgets).length > 0
        ? liveFunnelBudgets
        : storedPending?.funnelBudgets ?? {};
    const checkoutAmountCents = Math.round(budget * 100);
    const workflowSlug = activeWorkflow()?.workflowDynastySlug ?? storedPending?.workflowSlug ?? null;
    if (!workflowSlug) {
      throw new Error("Campaign workflow setup is still missing. Please try again.");
    }
    const checkoutState = buildOnboardingState({ step: "pricing", checkoutBudgetUsd: budget });
    writeOnboardingState(checkoutState);

    const pending: PendingCheckoutLaunch = {
      version: 1,
      brandId: id,
      orgId,
      brandUrl,
      hostname: launchHostname,
      outcome: launchOutcome,
      budgetUsd: budget,
      workflowSlug,
      checkoutAmountCents,
      topupAmountCents: checkoutAmountCents,
      topupThresholdCents: AUTO_TOPUP_THRESHOLD_CENTS,
      featureInputs: storedPending?.featureInputs,
      // "brand in memory matches this launch" holds for a URL brand (url resolved) OR
      // a no-website brand (no url, identified by noWebsiteMode) whose id matches.
      profile: brandIdRef.current === id && (noWebsiteMode || normalizedCurrentUrl) ? profile : storedPending?.profile,
      services: brandIdRef.current === id && (noWebsiteMode || normalizedCurrentUrl) ? services : storedPending?.services,
      selectedAudienceIds: launchAudienceIds,
      selectedFunnelKeys: launchFunnelKeys,
      primaryFunnelKey: launchPrimaryFunnelKey,
      funnelBudgets: launchFunnelBudgets,
      onboardingState: checkoutState,
      createdAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem(CHECKOUT_PENDING_KEY, JSON.stringify(pending));
    return pending;
  }

  async function beginCheckoutAndLaunch() {
    setBusy(true);
    setError(null);
    setCancelNotice(null);
    try {
      const pending = buildPendingLaunchBlob();
      const budget = pending.budgetUsd;
      const checkoutAmountCents = pending.checkoutAmountCents;

      const successUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      successUrl.searchParams.set("success", "true");
      successUrl.searchParams.set("launch_checkout", "success");
      // Google Ads PURCHASE conversion value = the 1-day budget the user picked
      // (dollars). Read on the checkout RETURN (payment succeeded) by
      // AdsPurchaseTracker. Reflects the recurring per-day commitment, not the
      // one-off charge amount.
      successUrl.searchParams.set("daily_budget", String(budget));
      const cancelUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      cancelUrl.searchParams.set("launch_checkout", "cancelled");

      const session = await createCheckoutSession({
        topup_amount_cents: checkoutAmountCents,
        success_url: successUrl.toString(),
        cancel_url: cancelUrl.toString(),
      });
      window.location.href = session.url;
    } catch (err) {
      posthog.capture("onboarding_launch_failed", { flow: "beta" });
      setError(err instanceof Error ? err.message : "Checkout failed. Campaign was not launched.");
      setBusy(false);
    }
  }

  // Payment succeeded. Restore the wizard state and stash the pending blob, then
  // route to the FIRST post-payment step (phone) — the launch itself is deferred
  // to finalizePostPaymentAndLaunch, which runs after the user walks phone → ltr →
  // offer levers. This lets those steps refine the profile/economics BEFORE the
  // campaign is created. If reading the pending blob fails we fall back to pricing.
  async function resumeCheckoutLaunch() {
    setError(null);
    try {
      const pending = readPendingCheckoutLaunch();
      pendingCheckoutRef.current = pending;
      applyRestoredOnboardingState(pending.onboardingState, { step: "celebrate" });
      applyRestoredFunnelSelection(pending);
      setCheckoutBudgetUsd(pending.budgetUsd);
      setLaunchingBrand({ domain: extractDomain(pending.brandUrl ?? ""), hostname: pending.hostname });
      setLaunchStep(0);
      setOfferIndex(0);
      setStep("celebrate");
      setBusy(false);
      // Kick the whole launch in the BACKGROUND right now — while the user fills the
      // optional post-payment steps — so the dashboard opens near-instantly and the
      // campaign is created even if they quit before reaching it. Also prewarm the
      // best-model projection (refetched after the LTR save) so the model step is warm.
      startBackgroundLaunch().catch(() => {});
      const prewarmId = pending.brandId;
      if (prewarmId) {
        void fetchBestModelLadder(prewarmId, pending.primaryFunnelKey);
        prewarmStoredEconomics(prewarmId);
      }
    } catch (err) {
      posthog.capture("onboarding_launch_failed", { flow: "beta", stage: "checkout_return" });
      const detail = err instanceof Error ? err.message : "unknown error";
      setError(`Checkout returned, but launch could not finish: ${detail}`);
      setStep("pricing");
      setBusy(false);
    }
  }

  // Direct launch — NO Stripe redirect. Used when an existing org ADDS a brand
  // (`?from=add`) and already has a payment method on file: card capture + the
  // first-$400 welcome match are new-org-only, so we skip the checkout screen and
  // launch straight into the post-payment sequence (celebrate → phone → ltr → …).
  // Funding is covered by the org's existing card via configureAutoTopup (re-armed
  // in runLaunchWork) — never a re-charge. Mirrors resumeCheckoutLaunch, but builds
  // the pending blob in-memory instead of reading a Stripe-return snapshot.
  async function launchDirectlyWithoutCheckout() {
    setBusy(true);
    setError(null);
    setCancelNotice(null);
    try {
      const pending = buildPendingLaunchBlob();
      pendingCheckoutRef.current = pending;
      setLaunchingBrand({ domain: extractDomain(pending.brandUrl ?? ""), hostname: pending.hostname });
      setLaunchStep(0);
      setOfferIndex(0);
      setStep("celebrate");
      setBusy(false);
      startBackgroundLaunch().catch(() => {});
      const prewarmId = pending.brandId;
      if (prewarmId) {
        void fetchBestModelLadder(prewarmId, pending.primaryFunnelKey);
        prewarmStoredEconomics(prewarmId);
      }
    } catch (err) {
      posthog.capture("onboarding_launch_failed", { flow: "beta", stage: "direct_launch" });
      setError(err instanceof Error ? err.message : "Launch failed. Your brand was not launched.");
      setBusy(false);
    }
  }

  // Pricing-step "Continue". For an existing org ADDING a brand (`?from=add`) with a
  // card already on file, skip the $400-welcome screen + Stripe checkout and launch
  // directly. New orgs — or an add-brand org with no payment method yet — keep the
  // checkout path (bonus → beginCheckoutAndLaunch) so the card is captured + auto-topup
  // armed. The billing-account check is fail-safe: on any error we fall back to
  // checkout rather than risk launching a recurring brand unfunded.
  async function continueFromPricing() {
    if (!fromAdd) {
      setStep("bonus");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const account = await getBillingAccount();
      if (account.has_payment_method) {
        await launchDirectlyWithoutCheckout();
        return;
      }
      setBusy(false);
      setStep("bonus");
    } catch (err) {
      console.error("[dashboard] onboarding: billing-account check failed, falling back to checkout", err);
      setBusy(false);
      setStep("bonus");
    }
  }

  // The numbers the best-model ROI is computed from, as the PRIMARY FUNNEL states
  // them: its own chain legs plus the lifetime revenue that closes the chain.
  //
  // These used to come from the retired goal vocabulary, whose per-goal rate list
  // held the ENTRY legs of DIFFERENT funnels (the meeting goal asked for both
  // reply-to-meeting and visit-to-meeting, one from each meeting funnel) rather than
  // the chain of the one funnel being priced. So the block asked for numbers that
  // belonged to no single path, and wrote them to a record nothing reads. It now
  // shows exactly what the funnel's own screen showed, in the same words, writing to
  // the same place.
  function modelFunnelDef(): SalesFunnelDef | null {
    return primaryFunnel ? salesFunnelByKey(primaryFunnel.key as SalesFunnelKey) : null;
  }

  /** The draft the model step edits — the primary funnel's, shared with its own screen. */
  function modelFunnelDraft(): FunnelDraft | null {
    return primaryFunnel ? funnelDraftForWrite(primaryFunnel) : null;
  }

  /**
   * A comparable snapshot of the two things this step edits. Only the rates and the
   * lifetime revenue: the destinations belong to the funnel's own screen, and folding
   * them in here would arm the button on a value this block never showed.
   */
  function serializeFunnelDraft(draft: FunnelDraft): string {
    return JSON.stringify({ rates: draft.rates, ltr: draft.lifetimeRevenueUsd });
  }

  // Save the edited economics onto the FUNNEL and recompute the projection.
  //
  // Same discipline as `saveFunnelStatsAndContinue`, and the same code path: what is
  // STORED is read from the wire on every write and the patch is the DIFF against it.
  // That is what keeps a field confirmed on the funnel's own screen from being
  // overwritten from a stale client copy, and what makes an emptied field clear
  // instead of being silently omitted. Load-bearing here in particular — this step
  // runs on the fresh page load after Stripe, where the client copy can be a
  // reconstructed snapshot full of placeholders.
  async function saveModelEconomics() {
    const id = brandIdRef.current;
    const funnel = primaryFunnel;
    const def = modelFunnelDef();
    const draft = modelFunnelDraft();
    if (!id || !funnel || !def || !draft) return;
    const valid = validateFunnelDraft(def, draft, domain || null);
    if (!valid.ok) {
      setModelEconomicsError(valid.error);
      return;
    }
    setModelEconomicsError(null);
    setModelEconomicsBusy(true);
    try {
      const { funnels: stored } = await getBrandSalesFunnels(id);
      const patch = buildFunnelPatch(def, draft, storedFunnelValues(stored, funnel.key));
      if (!isEmptyFunnelPatch(patch)) await declareBrandSalesFunnel(id, funnel.key, patch);
      setModelEconomicsBaseline(serializeFunnelDraft(draft));
      // Adopt what was PERSISTED, not the client copy — they differ for every metric
      // this block did not render.
      // A stale ROI sitting beside freshly typed inputs is an incoherent surface, so the
      // ladder is dropped and the step skeletons until the new projection lands.
      setBestModelLadder(null);
      await fetchBestModelLadder(id, funnel.key);
    } catch (err) {
      console.error("[dashboard] onboarding: failed to price the primary funnel from the model step", err);
      // brand-service says exactly what was wrong with the funnel it was asked to
      // store, in a sentence written for a person. Never `err.message` — that is the
      // whole downstream body verbatim.
      setModelEconomicsError(funnelWriteErrorMessage(err));
    } finally {
      setModelEconomicsBusy(false);
    }
  }

  // ── Post-payment steps ────────────────────────────────────────────
  // Save the optional phone (Clerk user metadata) and advance to the LTR step.
  // An empty number is a valid skip — no write, just advance.
  async function savePhoneAndContinue() {
    if (phone.national.trim()) {
      setBusy(true);
      try {
        await savePhoneNumber(phone);
      } catch (err) {
        // Phone is optional reassurance data — never block the (already paid)
        // launch on it. Log loud, advance anyway.
        console.error("[dashboard] onboarding: failed to save phone; advancing", err);
      } finally {
        setBusy(false);
      }
    }
    // The economics are collected per FUNNEL instead of as one lifetime revenue,
    // so there is one screen per selected funnel.
    setFunnelIndex(0);
    setStep("funnelStats");
  }

  // States the WHOLE set of funnels the brand sells through: exactly these, no
  // others. Distinct from declaring one funnel — this is what flips `declared`
  // (a brand that has answered, vs one that has never told us anything) and what
  // removes a funnel the user unpicked. features-service reads that declared set
  // to arbitrate which goal a campaign runs, so it has to land BEFORE the budget
  // step, which prices the outcome the primary funnel buys.
  //
  // It carries no economics: those are asked once per funnel after payment. A
  // funnel already in the set keeps what it was priced with, so re-stating the
  // set on a resume never wipes a value the brand confirmed.
  async function saveFunnelsAndContinue() {
    setPrimaryFunnelKey((current) => resolvePrimaryKey(selectedFunnelKeys, current));
    const id = brandIdRef.current;
    if (!id) {
      // No brand yet (fast click-through): the per-funnel writes after payment
      // declare each picked funnel on their own, so do not block the step.
      setError(null);
      setStep("primary");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await stateBrandSalesFunnels(id, selectedFunnelKeys);
      setStep("primary");
    } catch (err) {
      if (isInsufficientCredit(err)) {
        creditRetryRef.current = () => saveFunnelsAndContinue();
        return;
      }
      // brand-service writes its 400s for a person to read ("this funnel starts
      // with a click onto the brand's website…"). Never `err.message`: the shared
      // api client sets it to the whole downstream body verbatim, which would put
      // a JSON blob in front of a customer.
      setError(funnelWriteErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function savePrimaryFunnelAndContinue() {
    const goal = primaryFunnel?.goal;
    const nextOutcome = OUTCOMES.find((o) => o.key === goal)?.key ?? null;
    if (!nextOutcome) {
      setError("Pick the path you want us on first.");
      return;
    }
    // Picking the primary path WRITES NOTHING. It used to persist the brand-level
    // goal — the retired vocabulary, which features-service no longer reads at all,
    // and which could not tell the two meeting funnels apart anyway.
    // What the brand sells through is the funnel SET, already stated one step back
    // by `saveFunnelsAndContinue`; what each funnel is worth is stated per funnel on
    // the `funnelStats` screens. A write here would restate six brand-level metrics
    // nobody reads and, worse, would have to source them from somewhere — which is
    // exactly how a placeholder once overwrote rates a customer had confirmed.
    //
    // The pick still rides in local state: it orders the funnel detail screens,
    // picks the outcome the budget step prices, and names the funnel the projection
    // resolves against.
    setOutcome(nextOutcome);
    setError(null);
    setStep("consent");
  }

  // v2 — the draft shown for one funnel's detail screen. Falls back in CASCADE so
  // the second path is never a blank form: a value the user already typed on an
  // earlier path seeds this one, then whatever the brand actually saved, then
  // empty. Typing here overrides for this funnel only.
  function funnelDraft(funnel: FunnelView): FunnelDraftState {
    const own = funnelDrafts[funnel.key];
    const typedElsewhere = detailFunnels
      .filter((f) => f.key !== funnel.key)
      .map((f) => funnelDrafts[f.key])
      .filter((d): d is FunnelDraftState => Boolean(d));
    // Cascade: what the user typed on an earlier path seeds this one, then what
    // the brand actually saved, then empty. The second screen is never a blank form.
    const inheritedLtr = typedElsewhere.find((d) => d.ltr.trim())?.ltr;
    const inheritedPage = typedElsewhere.find((d) => (d.destinations.page ?? "").trim())?.destinations.page;
    const inheritedBooking = typedElsewhere.find((d) => (d.destinations.booking ?? "").trim())?.destinations
      .booking;
    // Rates seed from the brand's own economics through the SAME helper the Settings
    // card uses, so one funnel's rate reads the same number in both places. Without
    // this every conversion field rendered blank under copy promising we had prefilled
    // it, and the user retyped what we already knew. Per key, in order: what they typed
    // here, then the same key typed on another path, then the brand, then blank — the
    // show-up rate is measured nowhere in the fleet and stays blank by design.
    const def = salesFunnelByKey(funnel.key as SalesFunnelKey);
    const seeded = funnelDraftFromBrand(def, storedEconomics, defaultDestinationUrl).rates;
    const rates: Record<string, string> = {};
    for (const rate of funnelRateFields(def)) {
      const typedHere = own?.rates[rate.key];
      const typedOnAnotherPath = typedElsewhere.find((d) => (d.rates[rate.key] ?? "").trim())?.rates[
        rate.key
      ];
      rates[rate.key] = typedHere ?? typedOnAnotherPath ?? seeded[rate.key] ?? "";
    }
    return {
      rates,
      ltr: own?.ltr ?? inheritedLtr ?? rateText.ltv,
      destinations: {
        // A page destination defaults to the brand's own click destination. A
        // booking link has no counterpart on the brand and we never guess a
        // scheduling URL, so it starts empty.
        page: own?.destinations.page ?? inheritedPage ?? defaultDestinationUrl,
        booking: own?.destinations.booking ?? inheritedBooking ?? "",
      },
    };
  }

  function editFunnelDraft(
    funnel: FunnelView,
    patch: { rates?: Record<string, string>; ltr?: string; destinations?: Record<string, string> },
  ) {
    const current = funnelDraft(funnel);
    setFunnelDrafts((prev) => ({
      ...prev,
      [funnel.key]: {
        rates: { ...current.rates, ...(patch.rates ?? {}) },
        ltr: patch.ltr ?? current.ltr,
        destinations: { ...current.destinations, ...(patch.destinations ?? {}) },
      },
    }));
  }

  // "at your budget, this path builds $X of pipeline a month".
  //
  // ⚠️ This is the ONE number in this flow that is derived in the browser, and
  // it must not stay that way: features-service owns every displayed stat, and two
  // browser-derived numbers on one card is exactly how surfaces drift. There is no
  // served field for it today (the projection returns cost per outcome, cost per
  // paid client, the ROI multiple and the CAC share — not a budget-scaled pipeline),
  // so the request is filed against features-service and this reads from the fields
  // that ARE served until it lands.
  //
  // Returns null — not a zero, not a guess — whenever any input is missing, so an
  // unpriceable path says nothing rather than promising nothing.
  function monthlyPipelineLabel(resolved: { costPerPaidClientUsd: number | null } | null): string | null {
    const budget = budgetForCharge();
    const costPerClient = resolved?.costPerPaidClientUsd ?? null;
    const ltr = rates.ltv;
    if (budget == null || budget <= 0) return null;
    if (costPerClient == null || costPerClient <= 0) return null;
    if (!ltr || ltr <= 0) return null;
    const clientsPerMonth = (budget * 30) / costPerClient;
    const pipeline = clientsPerMonth * ltr;
    if (!Number.isFinite(pipeline) || pipeline <= 0) return null;
    return `$${formatLocaleInteger(Math.round(pipeline))}`;
  }

  // What the user typed on one funnel's screen, in the shape the shared patch
  // builder reads. The settings card feeds that same builder, so one funnel is
  // priced the same way wherever it is priced.
  function funnelDraftForWrite(funnel: FunnelView): FunnelDraft {
    const draft = funnelDraft(funnel);
    const def = salesFunnelByKey(funnel.key as SalesFunnelKey);
    const rates: FunnelDraft["rates"] = {};
    for (const rate of funnelRateFields(def)) {
      rates[rate.key] = draft.rates[rate.key] ?? "";
    }
    return {
      rates,
      lifetimeRevenueUsd: draft.ltr,
      // A destination the funnel has no use for is never sent: brand-service 400s
      // on it rather than dropping it.
      destinationUrl: def.pageDestination ? draft.destinations.page ?? "" : "",
      bookingUrl: def.bookingLink ? draft.destinations.booking ?? "" : "",
    };
  }

  /** What brand-service has stored for this funnel, or nothing declared yet. */
  function storedFunnelValues(
    stored: DeclaredSalesFunnel[],
    key: string,
  ): DeclaredFunnelValues {
    const row = stored.find((f) => f.funnelKey === key);
    if (!row) return NOTHING_DECLARED;
    return {
      rates: row.rates,
      lifetimeRevenueUsd: row.lifetimeRevenueUsd,
      destinationUrl: row.destinationUrl,
      bookingUrl: row.bookingUrl,
    };
  }

  // Write this funnel's economics, then advance to the next screen or the
  // projection. Runs on the post-payment fresh page load, so what is STORED is
  // read from the wire on every write rather than trusted from client state —
  // the patch is the DIFF against it, which is what keeps a field the user
  // confirmed elsewhere from being overwritten from a stale copy, and what makes
  // an emptied field clear (an explicit `null`) instead of being omitted.
  //
  // Errors STOP the step. brand-service's 400 names the one thing to fix and the
  // field is right there, so advancing past it would drop what was typed with
  // nothing said — the same class as a save that silently persists nothing.
  async function saveFunnelStatsAndContinue() {
    const funnel = detailFunnels[funnelIndex];
    const advance = () => {
      if (funnelIndex < detailFunnels.length - 1) {
        setFunnelIndex((i) => i + 1);
        return;
      }
      setOfferIndex(0);
      setStep("model");
    };
    const id = brandIdRef.current;
    if (!funnel || !id) {
      setError(null);
      advance();
      return;
    }
    const def = salesFunnelByKey(funnel.key as SalesFunnelKey);
    const draft = funnelDraftForWrite(funnel);
    // Client-side shape checks make typing pleasant; brand-service's 400 is the
    // source of truth and is surfaced verbatim below when one gets through.
    const valid = validateFunnelDraft(def, draft, domain || null);
    if (!valid.ok) {
      setError(valid.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { funnels: stored } = await getBrandSalesFunnels(id);
      const patch = buildFunnelPatch(def, draft, storedFunnelValues(stored, funnel.key));
      // An empty patch means every field still equals what is stored — including
      // a prefill the user left alone on a funnel that was never declared, which
      // must not read back as a number the brand stated. The declare itself still
      // has to happen, so send the empty body: it declares without pricing.
      await declareBrandSalesFunnel(id, funnel.key, patch);
      // The brand-level click destination still rides the brand read and every
      // consumer links off it, but the flow no longer asks for it on a screen of
      // its own — a funnel owns its landing page now. So the page the user gave
      // the FIRST funnel that lands a click on the site sets it: the same value
      // they just typed, never an invented one. The screens run primary-first,
      // so that is the primary funnel's page whenever it has one.
      //
      // Once per session (a later funnel must not silently repoint the brand),
      // and best-effort: the funnel's own landing page is already persisted, so
      // a failure here must not strand a paid user on this screen.
      const page = draft.destinationUrl.trim();
      if (page && !clickDestinationMirroredRef.current) {
        clickDestinationMirroredRef.current = true;
        try {
          await saveBrandClickDestination(id, page);
          setClickDestinationUrl(page);
        } catch (destErr) {
          console.error("[dashboard] onboarding: failed to mirror the brand click destination", destErr);
        }
      }
      advance();
    } catch (err) {
      if (isInsufficientCredit(err)) {
        creditRetryRef.current = () => saveFunnelStatsAndContinue();
        return;
      }
      setError(funnelWriteErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Offer-lever step Continue: advance to the next lever, or (on the last one)
  // finalize the launch. Lever edits live in `profile` state and are saved on top of
  // the background launch's as-of-checkout profile by finalizePostPaymentAndLaunch.
  function continueOffer() {
    if (offerIndex < POST_PAYMENT_OFFER_LEVERS.length - 1) {
      setOfferIndex((i) => i + 1);
      return;
    }
    void finalizePostPaymentAndLaunch();
  }

  // Terminal: the launch is (usually) already done in the background — here we just
  // persist the offer-lever edits, await the background launch, then clean up + redirect.
  // The background launch was fired at checkout return; awaiting it here is near-instant
  // when the user spent time on the post-payment steps. A background failure surfaces via
  // launchError with a retry.
  async function finalizePostPaymentAndLaunch() {
    setLaunchError(null);
    setStep("launching");
    try {
      // Confirm the offer-lever edits (the 7 user-fields) on top of the background
      // launch's as-of-checkout save (best-effort — never block the already-paid
      // launch on it). Agency consent is asked on the consent step but never
      // persisted (by decision — see the note in runLaunchWork).
      const id = brandIdRef.current ?? pendingCheckoutRef.current?.brandId ?? null;
      const svcs = pendingCheckoutRef.current?.services;
      if (id && svcs) {
        await saveBrandUserFields(id, buildUserFieldsPayload(profile, svcs)).catch((e) =>
          console.error("[dashboard] onboarding: offer-lever user-fields save failed; continuing", e),
        );
      }
      const result = await startBackgroundLaunch();
      // Cleanup + redirect happen ONLY at the terminal (not in the background work) so a
      // mid-flow refresh can still resume the optional post-payment steps.
      window.sessionStorage.removeItem(CHECKOUT_PENDING_KEY);
      clearOnboardingState();
      const pending = pendingCheckoutRef.current;
      const orgId = pending?.orgId ?? orgIdRef.current;
      router.push(`/orgs/${orgId}/brands/${id}?launched=${result.campaignId}`);
    } catch (err) {
      posthog.capture("onboarding_launch_failed", { flow: "beta", stage: "post_payment_finalize" });
      const detail = err instanceof Error ? err.message : "unknown error";
      setLaunchError(`Launch could not finish: ${detail}`);
    }
  }

  function applyRestoredOnboardingState(state: PersistedOnboardingState, opts?: { step?: Step }) {
    setUrl(state.url);
    setNoWebsiteMode(state.noWebsiteMode);
    setBrandName(state.brandName);
    setBrandContext(state.brandContext);
    setOutcome(state.outcome);
    setRates(state.rates);
    setRateText(state.rateText);
    setServices(state.services);
    setClickDestinationUrl(state.clickDestinationUrl);
    setProfile(state.profile);
    setSelectedBudget(state.selectedBudget);
    setCustomBudget(state.customBudget);
    setCheckoutBudgetUsd(state.checkoutBudgetUsd);
    setAudiencePrompt(state.audiencePrompt);
    setAudienceCandidates(state.audienceCandidates);
    setSelectedAudienceIds(state.selectedAudienceIds);
    setBrandId(state.brandId);
    brandIdRef.current = state.brandId;
    orgIdRef.current = state.orgId;
    servicesEditedRef.current = state.servicesEdited;
    ratesEditedRef.current = state.ratesEdited;
    projectionRef.current = state.workflowProjection;
    salesInputsRef.current = state.salesInputs;
    launchFeatureInputsRef.current = state.launchFeatureInputs;
    setPricingHydrationVersion((value) => value + 1);
    setStep(opts?.step ?? resolveResumeStep(state.step, state.brandId));
  }

  // v2 — put the picked funnels back after the Stripe round-trip. The selection lives
  // in React state only (see PendingCheckoutLaunch), and the checkout return is a FRESH
  // page load, so without this the per-funnel screens have nothing to walk and skip
  // themselves. Reads the blob's top-level fields, which are version-independent.
  function applyRestoredFunnelSelection(pending: PendingCheckoutLaunch) {
    setSelectedFunnelKeys(pending.selectedFunnelKeys);
    setPrimaryFunnelKey(pending.primaryFunnelKey);
    // The funding comes back with the selection, or a cancel would land on pricing
    // with every path reading zero and the customer re-typing what they just set.
    setFunnelBudgets(
      Object.fromEntries(
        Object.entries(pending.funnelBudgets ?? {}).map(([key, usd]) => [key, String(usd)]),
      ),
    );
    setFunnelIndex(0);
  }

  async function hydratePricingForRestoredCheckout(state: PersistedOnboardingState): Promise<void> {
    if (state.workflowProjection) {
      projectionRef.current = state.workflowProjection;
      setPricingHydrationVersion((value) => value + 1);
      return;
    }
    if (!state.brandId) {
      throw new Error("Checkout returned without a brand id for pricing restore.");
    }
    projectionRef.current = await getWorkflowProjection({
      featureSlug: SALES_FEATURE_SLUG,
      brandId: state.brandId,
      objective: salesObjectiveForOptimizationGoal(optimizationGoalForOutcome(state.outcome)),
      budgetUsd: PROJECTION_REF_BUDGET,
    });
    setPricingHydrationVersion((value) => value + 1);
  }

  // After the user adds credit in the billing-guard modal, re-run the step action
  // that 402'd. Embedded Checkout completes in-page (no reload), so the React state
  // for this onboarding session is intact and the retry resumes seamlessly.
  useEffect(() => {
    function onResolved() {
      const retry = creditRetryRef.current;
      creditRetryRef.current = null;
      setError(null);
      if (retry) void retry();
    }
    window.addEventListener("billing:resolved", onResolved);
    return () => window.removeEventListener("billing:resolved", onResolved);
  }, []);

  useEffect(() => {
    const launchCheckout = searchParams.get("launch_checkout");
    if (checkoutResumeStartedRef.current) return;
    if (launchCheckout === "success") {
      checkoutResumeStartedRef.current = true;
      void resumeCheckoutLaunch();
      return;
    }
    if (launchCheckout === "cancelled") {
      checkoutResumeStartedRef.current = true;
      setBusy(false);
      try {
        const pending = readPendingCheckoutLaunch();
        applyRestoredOnboardingState(pending.onboardingState, { step: "pricing" });
        // A cancel lands back on pricing, where Back walks up through primary/funnels —
        // so the selection has to come back here too, not only on the success return.
        applyRestoredFunnelSelection(pending);
        void hydratePricingForRestoredCheckout(pending.onboardingState).catch((e) => {
          console.error("[dashboard] onboarding checkout-cancel pricing restore failed:", e);
          setError(e instanceof Error ? e.message : "Could not restore your budget options. Try again.");
        });
      } catch {
        // Pending state missing — still land on pricing with the reassuring note.
        setStep("pricing");
      }
      setCancelNotice(CHECKOUT_CANCELLED_NOTICE);
    }
  }, [searchParams]);

  // Put a number in front of the customer instead of a row of empty fields: the
  // funnel they picked to start on takes the recommended budget, the others start
  // unfunded and they fund what they want. Runs on the pricing step rather than at
  // the pick, because the goal and its projection have both settled by then — the
  // unit cost read a step earlier would still be the previous goal's.
  //
  // Seeds ONCE and only into an untouched set: a resume, a cancelled checkout or a
  // Back must never overwrite what the customer already funded.
  useEffect(() => {
    if (step !== "pricing" || !primaryFunnelKey) return;
    setFunnelBudgets((prev) => {
      if (Object.values(prev).some((v) => (parseLocaleNumberInput(v) ?? 0) > 0)) return prev;
      const floor = FUNNEL_MIN_DAILY_BUDGET_USD[primaryFunnelKey as SalesFunnelKey];
      const recommended = budgetForCount(RECOMMENDED_OUTCOME_COUNT);
      return { ...prev, [primaryFunnelKey]: String(Math.max(floor, recommended ?? floor)) };
    });
    // `budgetForCount` reads the live projection; re-running as it warms is the
    // point, and the untouched-set guard makes the repeat a no-op.
  }, [step, primaryFunnelKey, pricingHydrationVersion]);

  // ── Per-outcome economics for the budget cards ──────────────────
  // The outcome-optimized workflow's funnel projection (counts at PROJECTION_REF_BUDGET).
  function activeWorkflow() {
    const resp = projectionRef.current;
    if (!resp) return null;
    return selectWorkflowForOptimizationGoal(resp, optimizationGoalForOutcome(outcome), {
      visitToSignupPct: rates.v2s,
      replyToMeetingPct: rates.r2m,
      visitToMeetingPct: rates.v2m,
      visitToPaidClientPct: rates.v2p,
      replyToPaidClientPct: rates.r2p,
    });
  }

  function activeProjection() {
    return activeWorkflow()?.projection ?? null;
  }

  // $ per chosen outcome (budget-invariant): PROJECTION_REF_BUDGET ÷ per-day count.
  function outcomeUnitCost(): number | null {
    const workflow = activeWorkflow();
    return workflow
      ? workflowOutcomeUnitCost(workflow, optimizationGoalForOutcome(outcome), {
          visitToSignupPct: rates.v2s,
          replyToMeetingPct: rates.r2m,
          visitToMeetingPct: rates.v2m,
          visitToPaidClientPct: rates.v2p,
          replyToPaidClientPct: rates.r2p,
        })
      : null;
  }

  // Daily budget needed to hit `n` outcomes / month.
  function budgetForCount(n: number): number | null {
    const uc = outcomeUnitCost();
    if (uc == null || uc <= 0) return null;
    return Math.max(1, Math.round((n * uc) / 30));
  }

  // Outcomes / month a `$b`/day budget buys (inverse of budgetForCount). Display only.
  function countForBudget(b: number): number | null {
    const uc = outcomeUnitCost();
    if (uc == null || uc <= 0) return null;
    return Math.max(0, Math.round((b * 30) / uc));
  }

  /** What this funnel is funded with, in whole dollars. Blank or junk reads as 0. */
  function funnelBudgetUsd(key: string): number {
    const parsed = parseLocaleNumberInput((funnelBudgets[key] ?? "").trim());
    return parsed === null ? 0 : Math.max(0, Math.round(parsed));
  }

  /**
   * The picked funnels whose ceiling is under their own floor. Zero is never in
   * here: a funnel funded at nothing is one the brand is not paying for, which is
   * an ordinary answer — the gate is that at least ONE of them is funded.
   */
  function underfundedFunnels(): FunnelView[] {
    return selectedFunnels.filter((f) =>
      // Zero stored: signup is a brand stating its ceilings for the FIRST time,
      // so the floor applies in full. The grandfather in `funnelBudgetBelowMinimum`
      // exists for brands billing already funds under it, which nobody here is.
      funnelBudgetBelowMinimum(f.key as SalesFunnelKey, funnelBudgetUsd(f.key), 0),
    );
  }

  // The $/day the brand is charged: the SUM of what each picked funnel is funded
  // with. Null when nothing is funded yet, so the step cannot be passed — "we could
  // not price this" and "it costs nothing" are different statements, and only the
  // first should hold the Continue button.
  function derivedBudget(): number | null {
    const total = selectedFunnels.reduce((sum, f) => sum + funnelBudgetUsd(f.key), 0);
    return total > 0 ? total : null;
  }

  // ONE source for every $/day the user is shown or charged: the pricing summary, the
  // checkout CTA and the Stripe amount. They each carried their own copy of this
  // expression, which is precisely how a displayed amount and a charged amount drift.
  function budgetForCharge(): number | null {
    return derivedBudget() ?? checkoutBudgetUsd;
  }

  const outcomeMeta = OUTCOMES.find((o) => o.key === outcome)!;

  // ── Service-tag editor helpers ────────────────────────────────────
  // Re-run the service extraction from the services step. Same call the loading
  // screen makes, so it succeeds under exactly the conditions that one does — the
  // point is that a failure is now recoverable in place instead of leaving the step
  // permanently empty with nothing to press.
  async function retryServicesExtract() {
    const id = brandIdRef.current;
    if (!id || servicesRetrying) return;
    setServicesRetrying(true);
    const startedAt = performance.now();
    try {
      const fields = await extractBrandFields([id], SERVICES_PROFILE_FIELDS, {
        urlStrategy: noWebsiteMode ? undefined : "landing",
        mode: "suggest",
      });
      captureSetupMilestone("services_extracted", startedAt);
      const next = normalizeServices(fields.fields.services?.value);
      setServicesExtractFailed(next.length === 0);
      if (next.length > 0) {
        setProfile((prev) => ({ ...prev, services: next }));
        setServices((prev) => (prev.length ? prev : next));
      }
    } catch (e) {
      console.error("[dashboard] retryServicesExtract failed:", e);
      captureSetupMilestone("services_extract_failed", startedAt);
      setServicesExtractFailed(true);
    } finally {
      setServicesRetrying(false);
    }
  }

  function addService(raw: string) {
    const value = raw.trim();
    setServiceDraft("");
    if (!value) return;
    servicesEditedRef.current = true;
    launchFeatureInputsRef.current = null;
    setServices((prev) => {
      return prev.some((s) => s.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value];
    });
  }
  function removeService(value: string) {
    servicesEditedRef.current = true;
    launchFeatureInputsRef.current = null;
    setServices((prev) => prev.filter((s) => s !== value));
  }

  // ── Step renders ─────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <StepShell
        maxWidth="sm:max-w-5xl"
        footer={
          <button onClick={() => setStep("url")} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 sm:mt-8">
            Get started <ArrowRightIcon className="h-4 w-4" />
          </button>
        }
      >
        {/* Continues the landing: the visitor clicked "Launch from $1/day" on a
            page headlined "Sell like crazy, autonomously.", so the first screen after
            signup repeats that promise rather than re-pitching a converted user with a
            different one. The three cards are not a feature tour (which NN/g's "skip
            onboarding when possible" says to cut) — they answer the objections that
            actually stand between this screen and the URL field. */}
        {/* Every size below steps down on mobile. The three cards alone were
            528px of a 926px column on a 667px screen, which is what pushed the
            CTA off. */}
        <h1 className="font-display text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
          Sell like crazy, autonomously.
        </h1>
        <p className="mt-2.5 text-sm leading-6 text-gray-500 sm:mt-3 sm:text-base sm:leading-7">
          Drop your website. We find the buyers, reach out on your behalf, and forward the interested replies to your inbox. You handle the closing.
        </p>
        <div className="mt-5 grid gap-2.5 sm:mt-7 sm:gap-4 sm:grid-cols-3">
          {[
            {
              title: "We send, not you",
              desc: "Outreach goes out from our own domains. Yours is never touched.",
              Icon: ShieldCheckIcon,
            },
            {
              title: "You set the ceiling",
              desc: "You authorize a daily budget and pay that, nothing else. No seat, no retainer.",
              Icon: CreditCardIcon,
            },
            {
              title: "Pause anytime",
              desc: "One click stops the spend. You keep every conversation it started.",
              Icon: TrophyIcon,
            },
          ].map((f) => (
            // Icon beside the text on mobile (the stacked form spends a whole
            // 40px row on a decorative tile), back to stacked from sm.
            <div key={f.title} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:block sm:p-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-white text-brand-600 sm:h-10 sm:w-10">
                <f.Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-950 sm:mt-4 sm:text-base">{f.title}</div>
                <div className="mt-1 text-sm leading-5 text-gray-500 sm:mt-1.5 sm:leading-6">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </StepShell>
    );
  }

  if (step === "url") {
    const urlFooter = noWebsiteMode ? (
      <button onClick={startAnalyzeNoWebsite} disabled={!brandName.trim() || !brandContext.trim()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
        Build my strategy <ArrowRightIcon className="h-4 w-4" />
      </button>
    ) : (
      <button onClick={startAnalyze} disabled={!domain} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
        Analyze my product <ArrowRightIcon className="h-4 w-4" />
      </button>
    );
    return (
      <StepShell
        maxWidth="sm:max-w-md"
        pad="p-5 sm:p-6 md:p-8"
        footer={urlFooter}
      >
        {noWebsiteMode ? (
          <>
            <h2 className="font-display text-2xl font-bold text-gray-900">Tell us about your business</h2>
            <p className="mt-2 mb-6 text-gray-500">No website? No problem. Give us your brand name and everything about what you sell, and we build the outreach from it.</p>
            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <label htmlFor="ob-brand-name" className="block text-sm font-medium text-gray-700">Brand name</label>
            <input
              id="ob-brand-name"
              type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. Acme Consulting" autoFocus
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <label htmlFor="ob-brand-context" className="mt-5 block text-sm font-medium text-gray-700">About your business</label>
            <textarea
              id="ob-brand-context"
              value={brandContext} onChange={(e) => setBrandContext(e.target.value)} rows={10} maxLength={300000}
              placeholder="Paste everything about your business: what you sell, who you sell it to, your pricing, and what makes you different. The more you give us, the better we target."
              className="mt-1.5 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="button" onClick={() => setNoWebsiteMode(false)} className="mt-4 text-sm font-medium text-brand-600 transition hover:text-brand-700">
              I have a website
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold text-gray-900">What are we promoting?</h2>
            <p className="mt-2 mb-6 text-gray-500">We read your product, find the leads, and run the outreach. Just drop the URL.</p>
            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <input
              type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="e.g. https://acme.com/pricing" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && domain) startAnalyze(); }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {url.trim() && !domain && <p className="mt-2 text-sm text-red-500">Please enter a valid URL (e.g. acme.com)</p>}
            <button type="button" onClick={enterNoWebsiteMode} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 transition hover:text-brand-700">
              I have no website
            </button>
          </>
        )}
      </StepShell>
    );
  }

  if (step === "loading") {
    const loadingComplete = fetchDoneRef.current || loadStep >= LOADING_STEPS.length;
    return (
      <StepShell
        maxWidth="sm:max-w-md"
        pad="p-5 sm:p-6 md:p-8"
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} onEdit={() => setStep("url")} />}
      >
          <div className="mb-2 text-center text-lg font-semibold text-gray-950">{loadingComplete ? "Your strategy is ready." : "Building your strategy…"}</div>
          <p className="mb-6 text-center text-sm text-gray-500">Reading <span className="font-medium text-gray-700">{headerHostname}</span></p>
          <div className="space-y-2">
            {LOADING_STEPS.map((s, i) => {
              const isDone = loadingComplete || i < loadStep;
              const isActive = !isDone && i === loadStep;
              return (
                <div key={s.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${isActive ? "border-brand-200 bg-brand-50" : "border-gray-100 bg-white"} ${isDone || isActive ? "opacity-100" : "opacity-40"}`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {isDone ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckIcon className="h-3.5 w-3.5" /></span>
                      : isActive ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                      : <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />}
                  </span>
                  <span className={`text-sm ${isActive ? "font-medium text-gray-900" : "text-gray-600"}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
          {!loadingComplete && <p className="mt-5 text-center text-xs text-gray-400">This may take a few minutes.</p>}
      </StepShell>
    );
  }

  if (step === "services") {
    // A list on screen came from somewhere: either the extraction produced it or the
    // user typed it. Either way there is a draft to talk about.
    const servicesDrafted = services.length > 0;
    // Nothing to show AND something still running that could deliver it. A retry is
    // pointless here — the hydrate is already the retry.
    const servicesPending = !servicesDrafted && (servicesHydrating || servicesRetrying);
    // Nothing to show and nothing left running: the read is over and it produced
    // nothing. Say that, and give the reader a way to ask again.
    const servicesUnread = !servicesDrafted && !servicesPending && servicesExtractFailed;
    return (
      <StepShell
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} onEdit={() => setStep("url")} />}
        footer={<NextButton onClick={() => { addService(serviceDraft); setStep("audiences"); }} disabled={services.length === 0 && serviceDraft.trim() === ""} />}
      >
        <h2 className="font-display text-2xl font-bold text-gray-900">What services do you want to promote with us?</h2>
        {/* The "we drafted these" line is a claim about a successful extraction. With
            nothing extracted it described an empty box, which reads as "your site
            sells nothing" — so it is gated on there being a draft to talk about. */}
        {servicesDrafted ? (
          <p className="mt-2 mb-6 text-gray-500">We drafted these from <span className="font-medium text-gray-700">{hostname}</span>. Add or remove until the list matches what you sell.</p>
        ) : (
          <p className="mt-2 mb-6 text-gray-500">Tell us what you sell. Add one per line.</p>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-3 sm:p-4">
          {services.map((s, i) => (
            <span key={s} className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${TAG_TONES[i % TAG_TONES.length]}`}>
              <span className="min-w-0 break-words">{s}</span>
              <button type="button" onClick={() => removeService(s)} aria-label={`Remove ${s}`} className="opacity-60 transition hover:opacity-100">
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            value={serviceDraft}
            onChange={(e) => setServiceDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addService(serviceDraft); }
              else if (e.key === "Backspace" && serviceDraft === "" && services.length) removeService(services[services.length - 1]);
            }}
            onBlur={() => addService(serviceDraft)}
            placeholder={services.length ? "Add a service…" : "e.g. SEO audits"}
            className="min-w-0 flex-1 basis-full bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none sm:min-w-[8rem] sm:basis-auto"
          />
        </div>
        {/* Three honest states, in order of what the reader most needs to know. A
            still-running read is a wait, a settled empty read is a verdict, and the
            two must never look the same — that ambiguity is the whole bug. */}
        {servicesPending ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            Still reading <span className="font-medium text-gray-700">{hostname}</span>. You can start typing.
          </p>
        ) : servicesUnread ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-800">
            <span>We couldn&apos;t read your site. Add what you sell, or try again.</span>
            <button
              type="button"
              onClick={retryServicesExtract}
              disabled={servicesRetrying}
              className="font-semibold text-brand-600 transition hover:text-brand-700 disabled:opacity-50"
            >
              {servicesRetrying ? "Reading…" : "Try again"}
            </button>
          </div>
        ) : (
          services.length === 0 && serviceDraft.trim() === "" && <p className="mt-2 text-xs text-gray-400">Add at least one service to continue.</p>
        )}
      </StepShell>
    );
  }

  // Fail-safe: nothing ROUTES into the steps the brand-level flow had, but a resume
  // can still point at one (a snapshot written before the funnels flow shipped, an
  // in-flight checkout blob). Land on the step that asks the same thing now instead
  // of rendering a step this flow does not have — the same pattern the funnelStats
  // branch uses when it has no funnel to show.
  if (step === "destination" || step === "objective" || step === "rates" || step === "ltr") {
    setStep(legacyStepFor(step));
    return null;
  }

  if (step === "audiences") {
    return (
      <OnboardingAudiences
        brandId={brandId}
        brandDomain={headerDomain}
        brandName={headerName}
        hostname={headerHostname}
        services={services}
        prefetch={audiencePrefetch}
        prompt={audiencePrompt}
        onPromptChange={setAudiencePrompt}
        candidates={audienceCandidates}
        onCandidatesChange={setAudienceCandidates}
        selectedAudienceIds={selectedAudienceIds}
        onSelectedAudienceIdsChange={setSelectedAudienceIds}
        onBack={() => setStep("services")}
        onContinue={() => setStep("funnels")}
        onEdit={() => setStep("url")}
      />
    );
  }

  // Every way the brand sells. Selection only: no rates, no lifetime revenue, no
  // destination URL. Those are asked once per funnel after payment, so this step
  // stays a single question ("which chains do you sell through?") instead of a form.
  if (step === "funnels") {
    return (
      <StepShell
        maxWidth="sm:max-w-2xl"
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} onEdit={() => setStep("url")} />}
        footer={
          <NextButton
            onClick={saveFunnelsAndContinue}
            disabled={selectedFunnelKeys.length === 0 || busy}
            busy={busy}
            label="Continue"
          />
        }
      >
        <BackButton onClick={() => setStep("audiences")} />
        <h2 className="font-display text-2xl font-bold text-gray-900">How do you sell?</h2>
        <p className="mt-2 mb-6 text-gray-500">
          Pick every path a prospect can take to become a paying customer. You can pick more than one — we ask for the numbers behind each one once you are set up.
        </p>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="space-y-3">
          {offeredFunnels.map((f) => (
            <FunnelSelectCard
              key={f.key}
              funnel={f}
              selected={selectedFunnelKeys.includes(f.key)}
              onToggle={() =>
                setSelectedFunnelKeys((prev) => {
                  const next = prev.includes(f.key) ? prev.filter((k) => k !== f.key) : [...prev, f.key];
                  // A primary that just got deselected hands the role to another
                  // selected funnel — a selection with no primary has no goal for
                  // the budget step to price.
                  setPrimaryFunnelKey((current) => resolvePrimaryKey(next, current));
                  return next;
                })
              }
            />
          ))}
        </div>
        {noWebsiteMode && (
          <p className="mt-4 text-xs leading-5 text-gray-400">
            Paths that start with a click onto your website are hidden because this brand has no site.
          </p>
        )}
      </StepShell>
    );
  }

  // Which of the picked funnels we optimize for first. This is the brand's
  // optimization goal, and the budget step right after prices the outcome this
  // funnel buys.
  if (step === "primary") {
    return (
      <StepShell
        maxWidth="sm:max-w-2xl"
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} onEdit={() => setStep("url")} />}
        footer={
          <NextButton
            onClick={savePrimaryFunnelAndContinue}
            disabled={!primaryFunnel || busy}
            busy={busy}
            label="Continue"
          />
        }
      >
        <BackButton onClick={() => setStep("funnels")} />
        <h2 className="font-display text-2xl font-bold text-gray-900">
          What&apos;s your primary sales funnel goal with us today?
        </h2>
        {/* States ONLY what this answer is used for. It used to say we put the budget
            behind that path first and that the others could be switched at any time —
            a claim about what the orchestrator does, which we do not control and
            cannot promise. The one true consequence is the pricing calibration. */}
        <p className="mt-2 mb-6 text-gray-500">
          We use it to calibrate your pricing on the next step.
        </p>
        <div className="space-y-3">
          {selectedFunnels.map((f) => (
            <FunnelSelectCard
              key={f.key}
              funnel={f}
              selected={primaryFunnelKey === f.key}
              radio
              onToggle={() => setPrimaryFunnelKey(f.key)}
            />
          ))}
        </div>
      </StepShell>
    );
  }

  if (step === "consent") {
    return (
      <StepShell
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} onEdit={() => setStep("url")} />}
        footer={<NextButton onClick={() => setStep("pricing")} label="Continue" />}
      >
          <BackButton onClick={() => setStep("primary")} />
          <div className="mb-4 flex items-start gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-brand-600" />
            <h2 className="font-display text-2xl font-bold text-gray-900">We reach out on your behalf.</h2>
          </div>
          <p className="mb-4 text-sm leading-6 text-gray-500">distribute is a marketing agency. All outreach goes out from inboxes and domains <strong>we own and warm</strong> — never from yours, like a PR firm pitching from its own contacts.</p>
          <ul className="mb-6 space-y-1.5">
            {AGENCY_BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-xs leading-5 text-gray-600"><CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{b}</li>
            ))}
          </ul>
          <p className="text-[11px] leading-5 text-gray-400">By continuing you authorize distribute to contact prospects on your behalf, representing your brand, per our <a href="https://distribute.you/terms" target="_blank" rel="noreferrer" className="underline">Terms</a>.</p>
      </StepShell>
    );
  }

  if (step === "celebrate") {
    return (
      <StepShell
        maxWidth="sm:max-w-2xl"
        footer={<NextButton onClick={() => setStep("phone")} label="Let's optimize" />}
      >
        <ConfettiBurst />
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-600">
            <SparklesIcon className="h-8 w-8" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-gray-950">You're in. Welcome aboard.</h1>
          <p className="mt-3 max-w-md text-base leading-7 text-gray-500">
            Your outreach is funded and ready to launch. Now a few quick details so we get the most value out of every dollar you put in. It takes under a minute.
          </p>
        </div>
      </StepShell>
    );
  }

  if (step === "phone") {
    return (
      <StepShell
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} />}
        footer={<NextButton onClick={savePhoneAndContinue} busy={busy} label="Continue" />}
      >
        <div className="mb-4 flex items-start gap-2">
          <PaperAirplaneIcon className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-2xl font-bold text-gray-900">Your phone number.</h2>
        </div>
        <p className="mb-6 text-sm leading-6 text-gray-500">Optional. We only use it to reach you quickly about your own campaign, never for outreach. Add it or skip it.</p>
        <PhoneInput value={phone} onChange={setPhone} autoFocus />
        <button
          onClick={() => { setFunnelIndex(0); setStep("funnelStats"); }}
          className="mt-4 text-sm text-gray-400 underline transition hover:text-gray-600"
        >
          Skip for now
        </button>
      </StepShell>
    );
  }

  // One screen per selected funnel, primary first. Replaces the single
  // lifetime-revenue screen: a self-serve signup customer and an enterprise
  // meeting customer are not worth the same and do not land on the same page,
  // so each funnel carries its own rates, its own lifetime revenue and its own
  // destinations — and each is written to brand-service on Continue, through the
  // same partial patch the Settings card uses.
  if (step === "funnelStats") {
    const funnel = detailFunnels[funnelIndex];
    if (!funnel) {
      // No funnel picked (a resumed session that never saw the funnels step) —
      // there is nothing to ask, so fall through to the projection.
      setOfferIndex(0);
      setStep("model");
      return null;
    }
    const draft = funnelDraft(funnel);
    const isLast = funnelIndex === detailFunnels.length - 1;
    return (
      <StepShell
        maxWidth="sm:max-w-2xl"
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} />}
        footer={
          <NextButton
            onClick={saveFunnelStatsAndContinue}
            busy={busy}
            label={isLast ? "Continue" : "Next path"}
          />
        }
      >
        <BackButton
          onClick={() => (funnelIndex > 0 ? setFunnelIndex((i) => i - 1) : setStep("phone"))}
        />
        {/* A counter over ONE item states nothing: "1 of 1" reads as a step the flow
            is missing rather than as the only path there is. */}
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
          {detailFunnels.length === 1
            ? "Your path"
            : `Your paths · ${funnelIndex + 1} of ${detailFunnels.length}`}
        </div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl font-bold text-gray-900">{funnel.title}</h2>
          {/* A tag ranking one item against nothing: with a single path there is no
              second one for it to be primary OVER, so it only invites the question. */}
          {detailFunnels.length > 1 && funnel.key === primaryFunnelKey && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              Primary
            </span>
          )}
        </div>
        <FunnelChain steps={funnel.steps} tone={funnel.tone} />
        <p className="mt-4 mb-5 text-sm leading-6 text-gray-500">
          What this path is worth to you, and where it sends people. We prefilled it from what we already know — correct anything that is off.
        </p>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          {funnel.rates.map((rate) => (
            <label key={rate.key} className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                {rate.label}
                {rate.tip && <InfoTooltip tip={rate.tip} />}
              </span>
              <span className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-brand-400">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draft.rates[rate.key] ?? ""}
                  onChange={(e) => editFunnelDraft(funnel, { rates: { [rate.key]: e.target.value } })}
                  className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
                />
                <span className="text-sm text-gray-500">%</span>
              </span>
            </label>
          ))}

          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
              Lifetime revenue per paid client
              <InfoTooltip tip="Average revenue a customer won through this path brings over their lifetime." />
            </span>
            <span className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-brand-400">
              <span className="text-sm text-gray-500">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={draft.ltr}
                onChange={(e) => editFunnelDraft(funnel, { ltr: e.target.value })}
                className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
              />
            </span>
          </label>

          {/* A funnel can send people to BOTH a page on the site and a scheduling
              link (website visit → meeting booked does exactly that), so this is a
              list, not one field. Each destination keeps its own draft value. */}
          {funnel.destinations.map((dest) => (
            <label key={dest.kind} className="flex flex-col gap-1">
              {/* "Optional" belongs beside the LABEL, where a reader decides whether to
                  fill the field — buried at the head of the hint under the input, it is
                  read after the decision it was meant to inform. */}
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                {dest.label}
                {dest.optional && (
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    Optional
                  </span>
                )}
              </span>
              <input
                type="text"
                value={draft.destinations[dest.kind] ?? ""}
                onChange={(e) => editFunnelDraft(funnel, { destinations: { [dest.kind]: e.target.value } })}
                placeholder={dest.placeholder}
                className="w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-brand-400 focus:outline-none"
              />
              {dest.hint && <span className="text-[11px] leading-5 text-gray-400">{dest.hint}</span>}
            </label>
          ))}
        </div>

        <p className="mt-3 text-[11px] leading-5 text-gray-400">
          Saved to this path only. You can change any of it later in Settings.
        </p>
      </StepShell>
    );
  }

  if (step === "model") {
    const goal = optimizationGoalForOutcome(outcome);
    const rows = bestModelLadder?.rows ?? [];
    const brandRow = pickBestBrandRow(rows, bestModelLadder?.recommendedWorkflowDynastySlug ?? null);
    const resolved = brandRow?.resolved ?? null;
    const bestName =
      brandRow?.workflow.workflowDynastyName ?? brandRow?.workflow.workflowDynastySlug ?? "-";
    const bestSlug = brandRow?.workflow.workflowDynastySlug ?? null;
    const avatar = bestSlug ? modelAvatar(bestSlug) : { emoji: "✨", color: "#6366f1" };
    const pending = bestModelLadder === null;
    // The primary funnel's own chain — the same fields, in the same words, that its
    // detail screen collected a few steps back, because they are the same numbers.
    const economicsFunnel = primaryFunnel;
    const economicsDef = modelFunnelDef();
    const economicsDraft = modelFunnelDraft();
    const economicsRates = economicsDef ? funnelRateFields(economicsDef) : [];
    // Live compare against the last written draft, never a sticky "edited" latch:
    // typing a value and undoing it must disarm the button again.
    const economicsSnapshot = economicsDraft ? serializeFunnelDraft(economicsDraft) : null;
    const economicsDirty =
      economicsSnapshot !== null &&
      modelEconomicsBaseline !== null &&
      economicsSnapshot !== modelEconomicsBaseline;
    const roiUnderOne = resolved?.roiMultiple != null && resolved.roiMultiple < 1;
    return (
      <StepShell
        maxWidth="sm:max-w-2xl"
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} />}
        footer={<NextButton onClick={() => setStep("offer")} label="Continue" />}
      >
        <BackButton
          onClick={() => {
            setFunnelIndex(Math.max(0, detailFunnels.length - 1));
            setStep("funnelStats");
          }}
        />
        {/* No "model" vocabulary — a customer does not care which model produced the
            number, only what the path is worth. The headline names the FUNNEL; the
            machinery behind it stays out of the copy.

            A superlative over a set of ONE says nothing: "your most profitable path"
            and "your primary goal" both promise a comparison the page cannot show when
            the brand sells through a single chain, so with one path it simply states
            what that path returns. */}
        <h2 className="font-display text-2xl font-bold text-gray-900">
          {selectedFunnels.length > 1 ? "Your most profitable path with us." : "What your path should return."}
        </h2>
        <p className="mt-2 mb-6 text-gray-500">
          {selectedFunnels.length > 1
            ? "Based on your numbers, here is what your primary goal should return and what each outcome should cost. Estimated from companies like yours until your own results come in."
            : "Based on your numbers, here is what it should return and what each outcome should cost. Estimated from companies like yours until your own results come in."}
        </p>
        {primaryFunnel && (
          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              {/* The numeral is a RANK, so it only means something beside a second path.
                  On its own it reads as "1 of several" on a page showing one, so a single
                  path wears the funnel's own mark — the same one the settings card and the
                  Campaigns table draw for it. */}
              {selectedFunnels.length > 1 ? (
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${primaryFunnel.tone.iconBg} ${primaryFunnel.tone.iconText}`}>
                  <span className="text-xs font-bold">1</span>
                </span>
              ) : (
                <SalesFunnelMark def={salesFunnelByKey(primaryFunnel.key as SalesFunnelKey)} size="sm" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900">{primaryFunnel.title}</div>
                <FunnelChain steps={primaryFunnel.steps} tone={primaryFunnel.tone} />
              </div>
            </div>
            {monthlyPipelineLabel(resolved) && (
              <div className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
                At your budget, this path should build{" "}
                <span className="font-semibold text-gray-900">{monthlyPipelineLabel(resolved)}</span> of pipeline a month.
              </div>
            )}
            {selectedFunnels.length > 1 && (
              <p className="mt-3 text-[11px] leading-5 text-gray-400">
                Priced against this path. Your other {selectedFunnels.length - 1 === 1 ? "path" : "paths"} stay on your account.
              </p>
            )}
          </div>
        )}
        {/* The numbers the projection below is computed from. Without them on screen a
            return under 1x reads as the model being bad, when it is almost always the
            lifetime revenue being small. Editable, because the fix is to correct them. */}
        <div
          className={`mb-5 rounded-xl border p-4 ${roiUnderOne ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"}`}
        >
          <div className="text-sm font-semibold text-gray-900">Your numbers</div>
          <p className="mt-1 text-xs leading-5 text-gray-600">
            {roiUnderOne
              ? "The return below is under 1x because these do not yet cover what one outcome costs. Correct them and we will recompute."
              : "The projection below is computed from these. Change them and we will recompute."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-700">Lifetime revenue / paid client</span>
              <span className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-brand-400">
                <span className="text-sm text-gray-500">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={economicsDraft?.lifetimeRevenueUsd ?? ""}
                  onChange={(e) =>
                    economicsFunnel && editFunnelDraft(economicsFunnel, { ltr: e.target.value })
                  }
                  className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
                />
              </span>
            </label>
            {economicsRates.map((rate) => (
              <label key={rate.key} className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700">{rate.label}</span>
                <span className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 focus-within:border-brand-400">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={economicsDraft?.rates[rate.key] ?? ""}
                    onChange={(e) =>
                      economicsFunnel &&
                      editFunnelDraft(economicsFunnel, { rates: { [rate.key]: e.target.value } })
                    }
                    className="w-full min-w-0 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </span>
              </label>
            ))}
          </div>
          {modelEconomicsError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {modelEconomicsError}
            </div>
          )}
          <button
            onClick={saveModelEconomics}
            disabled={!economicsDirty || modelEconomicsBusy}
            className={`mt-3 flex items-center gap-2 rounded-lg border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 ${modelEconomicsBusy ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
          >
            {modelEconomicsBusy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" /> Updating…
              </>
            ) : (
              "Update projection"
            )}
          </button>
        </div>
        {pending ? (
          <div className="space-y-4">
            <Skeleton className="h-14 w-full" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </div>
        ) : resolved ? (
          <div className="space-y-5">
            <BestModelStats
              resolved={resolved}
              bestName={bestName}
              brandGrain={resolved.grain}
              avatar={avatar}
              roiMultiple={resolved.roiMultiple}
              floored={brandRow ? isRowFloored(brandRow) : false}
              cppr={cpprFromRow(brandRow)}
              funnelKey={(primaryFunnel?.key as SalesFunnelKeyWire | undefined) ?? null}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            We are still crunching your projections. You can continue; the full numbers appear on your dashboard.
          </p>
        )}
      </StepShell>
    );
  }

  if (step === "offer") {
    const lever = POST_PAYMENT_OFFER_LEVERS[offerIndex];
    const raw = profile[lever.key];
    // List-kind levers (socialProof) edit one item per line and persist as string[];
    // writing the raw textarea string back would clobber the array (the empty-on-
    // Strategy bug). Free-text levers keep their plain string — and a text-kind lever
    // the extractor returned as string[] is joined on newline, matching what the value
    // is normalised to everywhere else, so leaving the box untouched persists that same
    // string instead of the array.
    const isList = isListLever(lever.key);
    const current = isList ? formatListLeverValue(raw) : coerceTextField(raw);
    const isLast = offerIndex === POST_PAYMENT_OFFER_LEVERS.length - 1;
    return (
      <StepShell
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} />}
        footer={<NextButton onClick={continueOffer} busy={busy} label={isLast ? "Launch my campaign" : "Continue"} />}
      >
        <BackButton onClick={() => (offerIndex > 0 ? setOfferIndex((i) => i - 1) : setStep("model"))} />
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
          Your offer · {offerIndex + 1} of {POST_PAYMENT_OFFER_LEVERS.length}
        </div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl font-bold text-gray-900">{lever.title}</h2>
          {/* Only the confirmed state is badged. A prefilled lever is obviously
              a draft, so labelling it adds nothing. */}
          {fieldProvenance[lever.key] === "confirmed" && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              Confirmed
            </span>
          )}
        </div>
        <p className="mt-2 mb-5 text-sm leading-6 text-gray-500">{lever.why}</p>
        <textarea
          value={current}
          onChange={(e) =>
            setProfile((p) => ({
              ...p,
              [lever.key]: isList ? parseListLeverInput(e.target.value) : e.target.value,
            }))
          }
          placeholder={lever.placeholder}
          rows={5}
          className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-base leading-6 text-gray-900 focus:border-brand-400 focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">We prefilled this from your website. Edit it or keep it, then continue.</p>
          <CopyForLLMButton text={buildLeverLLMPrompt(lever, current, hostname || domain || "my business")} />
        </div>
      </StepShell>
    );
  }

  if (step === "launching") {
    const brand = launchingBrand ?? { domain, hostname };
    return (
      <StepShell header={<BrandStepHeader domain={brand.domain} hostname={brand.hostname} />}>
          <div className="mb-2 text-center text-lg font-semibold text-gray-950">Launching your campaign...</div>
          <p className="mb-6 text-center text-sm text-gray-500">Keep this tab open while we finish setup.</p>
          {launchError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p>{launchError}</p>
              <button
                onClick={() => {
                  setLaunchError(null);
                  void finalizePostPaymentAndLaunch();
                }}
                className="mt-2 font-semibold underline hover:text-red-800"
              >
                Try again
              </button>
            </div>
          )}
          <div className="space-y-2">
            {LAUNCH_STEPS.map((s, i) => {
              const isDone = i < launchStep;
              const isActive = i === launchStep;
              return (
                <div key={s.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${isActive ? "border-brand-200 bg-brand-50" : "border-gray-100 bg-white"} ${isDone || isActive ? "opacity-100" : "opacity-40"}`}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                    {isDone ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckIcon className="h-3.5 w-3.5" /></span>
                      : isActive ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                      : <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />}
                  </span>
                  <span className={`text-sm ${isActive ? "font-medium text-gray-900" : "text-gray-600"}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
      </StepShell>
    );
  }

  if (step === "bonus") {
    const amount = budgetForCharge();
    return (
      <StepShell
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} onEdit={() => setStep("url")} />}
        footer={
          <button onClick={beginCheckoutAndLaunch} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Redirecting to checkout…
              </>
            ) : (
              <>
                {amount != null ? `Continue to checkout (${fmtUsd0(amount)})` : "Continue to checkout"} <ArrowRightIcon className="h-4 w-4" />
              </>
            )}
          </button>
        }
      >
          <BackButton onClick={() => setStep("pricing")} />
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
              <GiftIcon className="h-7 w-7 text-brand-600" />
            </span>
            <h2 className="font-display text-2xl font-bold text-gray-900">{welcomeHeadline(referredSignup)}</h2>
            {/* The gift is earned on PAYMENTS RECEIVED, never on usage consumed: the
                account is threshold-postpaid, so an org can consume on credit before
                paying anything. This one sentence is true in BOTH branches — when the
                first checkout is $800+ the $400 comes off it as a Stripe discount, so the
                buyer still pays $400 and still crosses the threshold that lands the rest.
                It is NOT a per-dollar match: a flat $400 gated at $400 of payments, so
                paying $10 earns nothing yet. Guard: welcome-credits-promise.test.ts.

                The org's entitlement and threshold are FROZEN on its billing account when
                that account is created, so an org that signed up under the old offer keeps
                $25/$25 forever and this screen (new orgs only) is the $400 cohort. */}
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-gray-600">
              {welcomeDetail(referredSignup)}
            </p>
            {referredByLine(inviterOrgName) && (
              <p className="mx-auto mt-2 max-w-sm text-xs text-gray-500">
                {referredByLine(inviterOrgName)}
              </p>
            )}
          </div>
      </StepShell>
    );
  }

  // pricing — one daily ceiling per PICKED funnel. The brand is charged their sum,
  // and billing stores them per funnel, so the money the customer commits to is
  // allocated to the paths they chose rather than to one undifferentiated pot.
  const displayBudget = budgetForCharge();
  const displayCount = displayBudget != null ? countForBudget(displayBudget) : null;
  const fundedFunnelCount = selectedFunnels.filter((f) => funnelBudgetUsd(f.key) > 0).length;
  const underfunded = underfundedFunnels();
  // A brand that picked ONE path reads every "each path" sentence as being about
  // something it does not have, and two of them contradicted this screen's own
  // button: Continue is gated on at least one funded path, so inviting the user to
  // leave the only path at 0 promises a step it then refuses. The plural copy is
  // kept byte-identical for a real multi-path selection.
  const onePath = selectedFunnels.length === 1;
  return (
    <StepShell
      header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} onEdit={() => setStep("url")} />}
      footer={
        <button onClick={continueFromPricing} disabled={displayBudget == null || underfunded.length > 0 || busy} className={`mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 ${busy ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-50"}`}>
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Launching…
            </>
          ) : (
            <>Continue <ArrowRightIcon className="h-4 w-4" /></>
          )}
        </button>
      }
    >
      <BackButton onClick={() => setStep("consent")} />
      <h2 className="font-display text-2xl font-bold text-gray-900">
        {onePath ? "Set your daily budget." : "Fund each path."}
      </h2>
      <p className="mt-2 mb-5 text-gray-500">
        {onePath ? (
          <>Set what we may spend a day on this path. You can change it whenever you like.</>
        ) : (
          <>
            Set what each path may spend a day. You can leave one at <strong>0</strong> and start it later. Fund at least one to continue.
          </>
        )}
      </p>
      {cancelNotice && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{cancelNotice}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <CreditCardIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <p className="text-sm leading-6 text-brand-800">
          {onePath
            ? "We spend up to your ceiling, and never more than that in a day."
            : "Each path spends up to its own ceiling, and never more than that in a day."}{" "}
          You pay as you go for what we actually spend. Cancel anytime.
        </p>
      </div>

      <div className="space-y-3">
        {selectedFunnels.map((f) => {
          const usd = funnelBudgetUsd(f.key);
          const floor = FUNNEL_MIN_DAILY_BUDGET_USD[f.key as SalesFunnelKey];
          const under = funnelBudgetBelowMinimum(f.key as SalesFunnelKey, usd, 0);
          const count = usd > 0 ? countForBudget(usd) : null;
          return (
            <div
              key={f.key}
              className={`rounded-xl border-2 p-4 transition ${
                under ? "border-red-200 bg-red-50" : usd > 0 ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${f.tone.iconBg} ${f.tone.iconText}`}>
                  <SalesFunnelMark def={salesFunnelByKey(f.key as SalesFunnelKey)} size="md" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{f.title}</div>
                  <FunnelChain steps={f.steps} tone={f.tone} />
                </div>
                <div className="flex shrink-0 items-baseline gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 focus-within:border-brand-400">
                  <span className="text-lg font-bold text-gray-400">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={funnelBudgets[f.key] ?? ""}
                    onChange={(e) =>
                      setFunnelBudgets((prev) => ({
                        ...prev,
                        [f.key]: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="0"
                    aria-label={`Daily budget for ${f.title}`}
                    className="w-16 bg-transparent text-right text-lg font-bold text-gray-950 placeholder-gray-300 focus:outline-none"
                  />
                  <span className="text-xs font-normal text-gray-500">/ day</span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 pl-14 text-xs">
                {under ? (
                  <span className="text-red-600">
                    This path starts at {fmtUsd0(floor)} a day.
                    {!onePath && " Leave it at 0 to skip it for now."}
                  </span>
                ) : count != null ? (
                  <>
                    <span className="text-gray-500">{fmtCount(count)} {outcomeMeta.unit} / mo</span>
                    <InfoTooltip tip={ESTIMATE_TOOLTIP} placement="top" />
                  </>
                ) : (
                  <span className="text-gray-400">
                    {onePath ? "From" : "Not funded. From"} {fmtUsd0(floor)} a day.
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* The total is a SUM, so it only says something when there is more than one
          thing to add. With one path it restates the figure typed an inch above,
          under a second label, alongside a count that card already carries. */}
      {!onePath && displayBudget != null && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Daily budget: <strong className="text-gray-900">{fmtUsd0(displayBudget)} / day</strong>
          <span className="text-gray-400"> across {fundedFunnelCount} {fundedFunnelCount === 1 ? "path" : "paths"}</span>
          {displayCount != null && <span className="mt-1 block text-gray-400 sm:mt-0 sm:inline"> · {fmtCount(displayCount)} {outcomeMeta.unit} / mo estimated</span>}
        </div>
      )}

    </StepShell>
  );
}

// Natural-language → audiences. The user describes the people they want to
// reach; human-service `/suggest` returns ONE candidate per audience (the winning
// provider, live-counted), each already persisted at status "suggested". The user
// picks one or more, which are ACTIVATED via `setAudienceStatus(audienceId,
// "active")`. This is the audience concept that replaces the persona step.
function OnboardingAudiences({
  brandId,
  brandDomain,
  brandName,
  hostname,
  services,
  prefetch,
  prompt,
  onPromptChange,
  candidates,
  onCandidatesChange,
  selectedAudienceIds,
  onSelectedAudienceIdsChange,
  onBack,
  onContinue,
  onEdit,
}: {
  brandId: string | null;
  brandDomain: string | null;
  // Threaded so this step's header reads the same company name as every sibling
  // step. Left on the domain here while the others show the name is an internally
  // incoherent header, not a cosmetic gap.
  brandName: string | null;
  hostname: string;
  services: string[];
  prefetch: AudiencePrefetch | null;
  prompt: string;
  onPromptChange: (value: string) => void;
  candidates: AudienceCandidate[] | null;
  onCandidatesChange: (value: AudienceCandidate[] | null) => void;
  selectedAudienceIds: string[];
  onSelectedAudienceIdsChange: (value: string[]) => void;
  onBack: () => void;
  onContinue: () => void;
  onEdit?: () => void;
}) {
  const fallbackPrompt = services.length
    ? `Find the ideal customers for ${hostname || "my brand"}: the people most likely to buy ${services.join(", ")}.`
    : "";
  const [icpLoading, setIcpLoading] = useState(true);
  // True when the sentence in the box was assembled HERE from the picked services
  // rather than drafted by brand-service. The two are indistinguishable on screen,
  // and a reader who assumes the second edits it as if we had read their site.
  const [icpFallback, setIcpFallback] = useState(false);
  const icpFetchedRef = useRef(false);
  // Mirrors of the two values the seed below has to compare against. It runs inside
  // a promise callback created at MOUNT, so reading `prompt` / `fallbackPrompt`
  // directly there reads the mount render: the "never clobber an edited prompt"
  // guard tested a stale empty string and overwrote live text whenever the prewarm
  // settled late — which a failing ICP call guarantees it does.
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const fallbackPromptRef = useRef(fallbackPrompt);
  fallbackPromptRef.current = fallbackPrompt;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // A successful suggest APPENDS below the already-picked cards, so with a full
  // selection above the fold the user sees nothing move and reads the click as a
  // no-op. `notice` reports what the run actually produced, next to the button.
  const [notice, setNotice] = useState<string | null>(null);
  const selectedAudienceIdSet = new Set(selectedAudienceIds);
  const candidateCount = candidates?.length ?? 0;
  const audienceMaxWidth =
    candidateCount >= 3 ? "sm:max-w-5xl" : candidateCount === 2 ? "sm:max-w-3xl" : "sm:max-w-xl";
  // Columns follow the CARD COUNT, not the breakpoint — so a single card spans the
  // full shell (grid-cols-1) instead of getting a 1/3-wide column at desktop width.
  const audienceGridCols =
    candidateCount >= 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : candidateCount === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";

  // Seed the step from the parent's pre-warm (ICP prompt + candidates drafted in
  // the background during the loading screen) when present — zero wait, zero click.
  // No pre-warm (fast click-through / no brandId yet) → draft the ICP here and
  // AUTO-FIRE the suggest, so the step still needs no click. Runs once; never
  // clobbers a prompt the user already edited.
  useEffect(() => {
    if (icpFetchedRef.current) return;
    icpFetchedRef.current = true;
    if (prompt.trim() || candidates) {
      setIcpLoading(false);
      return;
    }

    if (prefetch) {
      // Pre-warm in flight or already resolved — show drafting/generating until ready.
      setIcpLoading(true);
      setLoading(true);
      prefetch.promise
        .then(({ prompt: p, candidates: c, icpFailed }) => {
          const seeded = promptRef.current.trim() ? promptRef.current : p || fallbackPromptRef.current;
          onPromptChange(seeded);
          if (icpFailed) setIcpFallback(true);
          if (c) {
            onCandidatesChange(c);
            if (c.length === 0) setErr("No audiences matched that description. Try rephrasing.");
            setLoading(false);
            return;
          }
          // The prewarm bails the moment the ICP throws, so `suggestAudiences` never
          // ran. Leaving it there made a dead prewarm look like a step that merely
          // wanted a click. The no-prefetch branch below already self-fires; so does
          // this one now, off whatever sentence we ended up with.
          //
          // `loading` is HANDED OVER rather than cleared: runSuggest raises it again
          // itself, so clearing it here (or in a shared `finally`) would drop the
          // button back to its idle label for the whole call it just started — and
          // leave it clickable, so a second suggest could be fired over the first.
          if (seeded && brandId) {
            void runSuggest(seeded);
            return;
          }
          setLoading(false);
        })
        .catch((e) => {
          console.error("[dashboard] audience prefetch adopt failed:", e);
          setIcpFallback(true);
          onPromptChange(promptRef.current.trim() ? promptRef.current : fallbackPromptRef.current);
          setLoading(false);
        })
        .finally(() => {
          setIcpLoading(false);
        });
      return;
    }

    if (!brandId) {
      setIcpFallback(true);
      onPromptChange(promptRef.current.trim() ? promptRef.current : fallbackPromptRef.current);
      setIcpLoading(false);
      return;
    }
    (async () => {
      let nl = fallbackPromptRef.current;
      try {
        const { icp } = await suggestBrandIcp(brandId);
        nl = icp.trim() || fallbackPromptRef.current;
        if (!icp.trim()) setIcpFallback(true);
      } catch (e) {
        console.error("[dashboard] suggestBrandIcp (onboarding prefill) failed:", e);
        setIcpFallback(true);
      } finally {
        setIcpLoading(false);
      }
      const seeded = promptRef.current.trim() ? promptRef.current : nl;
      onPromptChange(seeded);
      if (seeded) void runSuggest(seeded);
    })();
  }, [brandId, prefetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-grow textarea to fit content — fires whenever prompt changes (user typing
  // or programmatic prefill). Reset height to "auto" first so shrinking works too.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt]);

  async function runSuggest(nlArg?: string) {
    const nl = (nlArg ?? prompt).trim();
    if (!brandId || !nl) {
      setErr("Describe who you want to reach first.");
      return;
    }
    setErr(null);
    setNotice(null);
    setLoading(true);
    // Preserve already-selected candidates across a re-fetch — keep them selected,
    // visible during load, and merged ahead of the new results. Editing the prompt
    // and re-fetching ADDS to the prior picks, it does not wipe them.
    const keep = (candidates ?? []).filter((c) => selectedAudienceIdSet.has(c.audienceId));
    onCandidatesChange(keep.length ? keep : null);
    try {
      const res = await suggestAudiences(brandId, nl);
      const keepIds = new Set(keep.map((c) => c.audienceId));
      const merged = [...keep, ...res.candidates.filter((c) => !keepIds.has(c.audienceId))];
      onCandidatesChange(merged);
      const added = merged.length - keep.length;
      if (added > 0) {
        setNotice(`${added} new ${added === 1 ? "audience" : "audiences"} generated`);
      } else if (keep.length > 0) {
        // Every candidate came back as one we already hold. This branch used to be
        // SILENT: no cards moved, no message, so the run was indistinguishable from a
        // dead button and one user re-clicked five times before giving up.
        setErr("No new audiences this time. Try rephrasing your description.");
      } else if (res.candidates.length === 0) {
        setErr("No audiences matched that description. Try rephrasing.");
      }
    } catch (e) {
      console.error("[dashboard] suggestAudiences failed:", e);
      setNotice(null);
      setErr("We couldn't generate audiences right now. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(candidate: AudienceCandidate) {
    const next = new Set(selectedAudienceIds);
    if (next.has(candidate.audienceId)) next.delete(candidate.audienceId);
    else next.add(candidate.audienceId);
    onSelectedAudienceIdsChange([...next]);
  }

  async function saveAndContinue() {
    if (!brandId || !candidates) {
      onContinue();
      return;
    }
    const picks = candidates.filter((c) => selectedAudienceIdSet.has(c.audienceId));
    if (picks.length === 0) {
      setErr("Select at least one audience.");
      return;
    }
    setErr(null);
    // NO activation here — the picks are carried forward in `selectedAudienceIds` and
    // committed once at the post-payment terminal step (completeLaunchAfterCheckout),
    // which makes them the brand's EXACT active set. Activating at this step made a
    // re-roll / Back-then-re-pick stack stale `active` rows (the "picked 2, page shows
    // 5" bug). Each candidate stays "suggested" until the launch commits.
    onContinue();
  }

  return (
    <StepShell
      maxWidth={audienceMaxWidth}
      header={<BrandStepHeader domain={brandDomain} hostname={hostname} name={brandName} onEdit={onEdit} />}
      footer={<NextButton onClick={saveAndContinue} disabled={!candidates || candidates.every((c) => !selectedAudienceIdSet.has(c.audienceId))} label="Continue" />}
    >
      <div>
        <BackButton onClick={onBack} />
        <h2 className="font-display text-2xl font-bold text-gray-900">Who do you want to reach?</h2>
        <p className="mt-2 text-gray-500">
          Describe your ideal customers in plain words. We&apos;ll turn it into targeted audiences you can pick from.
        </p>

        <div className="relative mt-5">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            disabled={icpLoading}
            placeholder="e.g. Heads of marketing at Series A–B B2B SaaS companies in the US, 50–500 employees."
            style={{ minHeight: "80px", overflow: "hidden" }}
            className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50"
          />
          {icpLoading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 text-sm text-gray-500">
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
              Drafting your ideal customer profile…
            </div>
          )}
        </div>
        {/* A sentence we assembled from the picked services looks exactly like one
            drafted off the site, so the reader is told which they are holding. Say it
            only once there is something in the box to describe. */}
        {icpFallback && !icpLoading && prompt.trim() && (
          <p className="mt-2 text-xs text-gray-500">
            We couldn&apos;t read enough from <span className="font-medium text-gray-700">{hostname}</span> to draft this, so we started it from your services. Edit it to match who you actually sell to.
          </p>
        )}
        {/* The outcome of the run sits BESIDE the button: the new cards render below the
            already-picked ones, which on a full selection is off-screen. */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => runSuggest()}
            disabled={loading || icpLoading || !prompt.trim()}
            className="flex items-center justify-center gap-2 rounded-xl border border-brand-500 px-5 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" /> Generating…
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="h-4 w-4" /> {candidates ? "Find new audiences" : "Find my perfect audiences"}
              </>
            )}
          </button>
          {notice && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckIcon className="h-4 w-4" /> {notice}
            </span>
          )}
        </div>

        {err && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{err}</div>
        )}
      </div>

      {candidates && candidates.length > 0 && (
        <>
          <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {candidates.filter((c) => selectedAudienceIdSet.has(c.audienceId)).length} of {candidates.length} selected
          </div>
          <div className={`grid gap-3 ${audienceGridCols}`}>
            {candidates.map((c, i) => (
              <AudienceCandidateCard key={c.audienceId || i} candidate={c} selected={selectedAudienceIdSet.has(c.audienceId)} onToggle={() => toggle(c)} />
            ))}
          </div>
        </>
      )}
    </StepShell>
  );
}

function AudienceCandidateCard({
  candidate,
  selected,
  onToggle,
}: {
  candidate: AudienceCandidate;
  selected: boolean;
  onToggle: () => void;
}) {
  const groups = audienceFilterGroups(candidate.filters);
  const invalid = Boolean(candidate.validationError) || candidate.count === 0;
  return (
    <button
      onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-5 text-left transition ${selected ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${selected ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"}`}
      >
        {selected && <CheckIcon className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{candidate.name}</span>
          {!invalid && (
            <span className="text-[11px] font-medium text-gray-400">~{candidate.count.toLocaleString()} matches</span>
          )}
        </span>
        <span className="mt-1 block text-xs leading-5 text-gray-500">{candidate.rationale}</span>
        {groups.length > 0 && (
          <span className="mt-3 flex flex-col gap-2">
            {groups.map((g) => (
              <span key={g.label} className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {g.label}
                </span>
                {g.values.map((v, j) => (
                  <span
                    key={j}
                    className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${g.tone}`}
                  >
                    <span className="min-w-0 truncate">{v}</span>
                  </span>
                ))}
              </span>
            ))}
          </span>
        )}
        {invalid && (
          <span className="mt-2 block text-[11px] text-amber-600">
            {candidate.validationError ? "Couldn't validate these filters." : "No live matches for these filters."}
          </span>
        )}
      </span>
    </button>
  );
}

function BrandStepHeader({ domain, hostname, name, onEdit }: { domain: string | null; hostname: string; name?: string | null; onEdit?: () => void }) {
  // The logo is keyed on the DOMAIN and the label reads the company NAME — two
  // different values that used to be one. `img.logo.dev/<name>` resolves nothing,
  // so collapsing them again silently empties the logo slot.
  const logoDomain = domain ?? hostname;
  // The domain is what we can show on the very first frame (it is parsed from the
  // typed URL, no network). The real company name arrives with the brand-create
  // response and replaces it; a resumed session that never saw that response
  // falls back to the domain rather than an empty header.
  const label = name?.trim() || domain || hostname;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
        <BrandLogo
          domain={logoDomain}
          size={28}
          className="h-7 w-7 rounded-md object-contain"
          fallbackClassName="h-5 w-5 text-gray-400"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Brand</div>
        <div className="truncate text-sm font-semibold text-gray-900">{label}</div>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Change website"
          className="ml-auto flex items-center justify-center rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600"
        >
          <PencilSquareIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Step shell. On MOBILE every step fills the available body height (`flex-1` under
// the layout's `100svh` app-shell column, no side gutters, no card chrome): the
// optional brand header is pinned at the top, the forward CTA is pinned to the bottom
// (always reachable, never scroll to find it), and ONLY the middle content scrolls —
// and only on the few steps too tall to fit. `svh` (not `dvh`) so the iOS Safari
// address bar can't push the pinned CTA off-screen. On `sm+` it reverts to the prior
// floating card: centered, max-width-capped, rounded border + shadow, natural flow.
// One-shot confetti burst on mount (post-payment celebration). Dynamic-imports
// canvas-confetti so it stays out of the initial onboarding bundle, and guards
// against SSR (window absent). Renders nothing.
function ConfettiBurst() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;
        if (cancelled) return;
        const fire = (particleRatio: number, opts: Record<string, unknown>) =>
          confetti({
            origin: { y: 0.6 },
            particleCount: Math.floor(200 * particleRatio),
            ...opts,
          });
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
      } catch (err) {
        // Confetti is pure delight — never block the (already paid) flow on it.
        console.error("[dashboard] onboarding: confetti failed to load", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

function StepShell({
  header,
  footer,
  maxWidth = "sm:max-w-xl",
  pad = "p-5 sm:p-8 md:p-12",
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  pad?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex min-h-0 w-full min-w-0 flex-1 flex-col sm:mx-auto sm:min-h-0 sm:flex-none sm:gap-3 ${maxWidth}`}>
      {header && <div className="shrink-0 px-3 pt-3 sm:px-0 sm:pt-0">{header}</div>}
      <div
        className={`flex min-h-0 flex-1 flex-col bg-white ${pad} sm:flex-none sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-sm`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto sm:flex-none sm:overflow-visible">{children}</div>
        {footer && <div className="shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mb-6 flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-gray-600">
      <ChevronLeftIcon className="h-4 w-4" /> Back
    </button>
  );
}

// Secondary CTA on the offer-lever steps: copies a ready prompt (the offer
// question + the user's current draft) so they can hand it to their own LLM,
// get a tighter answer, and paste it back. Self-contained state so it can
// render inside the `offer` step's conditional block.
function CopyForLLMButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
    >
      {copied ? "Copied!" : "Copy for LLM"}
    </button>
  );
}

function NextButton({ onClick, disabled = false, busy = false, label = "Continue" }: { onClick: () => void; disabled?: boolean; busy?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={disabled || busy} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…</> : <>{label} <ArrowRightIcon className="h-4 w-4" /></>}
    </button>
  );
}

// The funnel's chain, rendered under its title. Discreet on purpose: the name is
// what identifies the path, the chain is the reminder of what it means.
function FunnelChain({ steps, tone }: { steps: string[]; tone: { iconBg: string; iconText: string } }) {
  if (steps.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500">
      {steps.map((s, i) => (
        <span key={`${s}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span className={tone.iconText}>→</span>}
          <span>{s}</span>
        </span>
      ))}
    </div>
  );
}

// One sales funnel, as a selectable card: a tone-coloured mark tall enough to
// cover both text rows, the funnel's NAME as the heading, and its chain under it
// in a lighter weight. `radio` switches the control from multi-select to the
// single primary-goal pick — same card, so the two steps read as one idea.
function FunnelSelectCard({
  funnel,
  selected,
  onToggle,
  radio = false,
}: {
  funnel: FunnelView;
  selected: boolean;
  onToggle: () => void;
  radio?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition ${selected ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${funnel.tone.iconBg} ${funnel.tone.iconText}`}
      >
        <span className="flex flex-col items-center gap-[3px]">
          {funnel.steps.slice(0, 4).map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="block h-[3px] rounded-full bg-current"
              style={{ width: `${18 - i * 3}px` }}
            />
          ))}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">{funnel.title}</span>
        <FunnelChain steps={funnel.steps} tone={funnel.tone} />
      </span>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${radio ? "rounded-full" : "rounded-md"} ${selected ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"}`}
      >
        {selected && <CheckIcon className="h-3 w-3" />}
      </span>
    </button>
  );
}
