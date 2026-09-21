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
  PaperAirplaneIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { orgOnboardingComplete } from "@/lib/org-onboarding-complete";
import { startAnonSession } from "@/lib/anon-session-client";
import { refusalExits, type RefusalExits } from "@/lib/claimed-signup";
import {
  StartPicks,
  useStartCatalogue,
  START_STEP_LABELS,
  START_STEP_COUNT,
  type StartScreen,
} from "@/components/start/start-picks";
import { StartShell } from "@/components/start/start-shell";
import { funnelKeysFromSelection, startSelectionCookieAssignment } from "@/lib/start-selection-cookie";
import { DEFAULT_CHANNEL_SLUG } from "@/lib/start-catalogue";
import { BuiltSummaryPanel } from "@/components/onboarding/built-summary-panel";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { OnboardingAccountWidget } from "@/components/onboarding/onboarding-account-widget";
import { useOnboardingEscapeChrome } from "@/components/onboarding/onboarding-top-chrome";
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
  saveBrandTargetAudience,
  USER_FIELD_KEYS,
  type FieldProvenance,
  type UserFieldKey,
  type UserFieldValue,
  getSalesEconomicsEffective,
  stateBrandSalesFunnels,
  type DeclaredSalesFunnel,
  savePhoneNumber,
  listBrandOffers,
  suggestBrandIcp,
  type AudienceCandidate,
  getWorkflowProjection,
  type WorkflowProjectionLadderResponse,
  getFeature,
  prefillFeatureInputs,
  prefillToStringMap,
  configureAutoTopup,
  createCheckoutSession,
  getBillingAccount,
  createCampaignWithoutBrandEnrichment,
  getPublicChannels,
  getPublicChannelsSignedOut,
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
  coerceListField,
  coerceTextField,
} from "@/lib/strategy-model";
import { BestModelStats, cpprFromRow } from "@/components/strategy/best-model-card";
import { Skeleton } from "@/components/skeleton";
import { PhoneInput, EMPTY_PHONE, type PhoneValue } from "./phone-input";
import { phoneSyntaxProblem } from "@/lib/phone-syntax";
import {
  POST_PAYMENT_OFFER_LEVERS,
  buildLeverLLMPrompt,
  formatListLeverValue,
  isListLever,
  isListLeverKey,
  parseListLeverInput,
} from "./offer-levers";
import {
  buildAudienceLLMPrompt,
  buildServicesLLMPrompt,
  copyStepIntent,
} from "./llm-prompt";
import { businessDomainFromEmail, extractDomain, subpageDestinationFromUrl } from "@/lib/extract-domain";
import { NOT_A_WEBSITE, websiteInputProblem } from "@/lib/website-input";
import {
  clearLandingUrlCookieString,
  normalizeLandingUrl,
  readLandingUrlCookie,
} from "@/lib/landing-url-cookie";
import { displaySetupError } from "@/lib/onboarding-setup-error";
import {
  NO_CHANNEL_MINIMUMS,
  channelBudgetBelowMinimum,
  channelMinimumCents,
  channelMinimumsFromWire,
  fmtDailyFloorUsd,
  type ChannelMinimums,
} from "@/lib/channel-minimums";
import { BrandLogo } from "@/components/brand-logo";
import { RateInput } from "@/components/rate-input";
import {
  SALES_FUNNELS,
  funnelRateFields,
  roundPrefilledRate,
  salesFunnelByKey,
  normalizeSalesFunnelKey,
  salesFunnelKeyOrNull,
  funnelWriteErrorMessage,
  type SalesFunnelDef,
  type SalesFunnelKey,
  type SalesFunnelKeyWire,
  type FunnelDraft,
  type DeclaredFunnelValues,
} from "@/lib/sales-funnels";
import { launchLegKey } from "@/lib/stated-campaign-leg";
import { fundedLaunchFunnelKey } from "@/lib/launch-funnel";
import { soleOfferId } from "@/lib/launch-offer";
import { launchDestinationHref } from "@/lib/launch-destination";
import {
  resolvePrimaryKey,
  selectableFunnels,
  toFunnelViews,
  type FunnelCatalogueEntry,
  type FunnelView,
} from "@/lib/onboarding-funnel-view";
import { validateInvite } from "@/lib/api";
import { inviteCodeFromCookie } from "@/lib/invite-link";
import { onboardingBrandCookieAssignment } from "@/lib/onboarding-brand-cookie";
import { welcomeHeadline, welcomeDetail, referredByLine } from "@/lib/welcome-offer-copy";
import { planFirstCharge } from "@/lib/onboarding-charge";
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
  // THE SELL-FIRST SCREENS, the wizard's own first steps: what the visitor
  // wants, through which path, and what our clients got back. They were a
  // separate route (`/start`) handing off through a cookie and a full
  // navigation; the seam read as two products, so they are steps now.
  // Appended to ALL_STEPS rather than inserted, so an older snapshot parses.
  | "outcome"
  | "path"
  | "returns"
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
  // What we assembled, stated back — the last screen before anyone is asked for
  // an account. Appended to ALL_STEPS rather than inserted, so a snapshot
  // written before it existed still parses and no version bump is needed.
  | "built"
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
  // RETIRED — the per-funnel rate screens and the best-model screen used to run
  // HERE, after the card. They collected each funnel's conversion rates and its
  // lifetime revenue, and they asked for them at the worst moment in the whole
  // flow: a person who has just paid, on a screen standing between them and the
  // thing they paid for. Everything that identifies the business is already
  // stated BEFORE the account (the goal, the path, the services, the audience,
  // the six offer levers), so the post-payment run is the phone and the launch.
  //
  // Unlike the retired PRE-payment steps above, these leave no trace in the
  // union: post-payment steps are never written to the resume snapshot (the
  // persist effect skips on `?launch_checkout=success`) and were never in
  // ALL_STEPS, so nothing parses against them and no snapshot can name one.
  //
  // WHAT IT COSTS, stated rather than hidden: a new brand declares its funnels
  // with no rates and no lifetime revenue, so features-service prices its
  // pipeline off brand-service's effective economics until the customer states
  // its own on Settings -> Sales Funnels. A figure we cannot measure reads as
  // unmeasured there, which is the honest render.
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

// The outcome a funnel's goal is priced as, or null when the catalogue prices no
// such outcome. Read by BOTH the primary-funnel pick and the skip that fires when
// the brand picked a single funnel — one home, so the two can never disagree about
// which outcome a funnel buys.
function outcomeForFunnelGoal(goal: string | null | undefined): Outcome | null {
  if (!goal) return null;
  return OUTCOMES.find((o) => o.key === goal)?.key ?? null;
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
  promise: Promise<{ prompt: string; icpFailed: boolean }>;
};

/**
 * What the launch created, and the scope it created it in.
 *
 * The scope is carried out because the terminal redirect lands on the deepest level
 * with no choice left in it, and the launch has already resolved both: the offer it
 * read off the brand and the funnel the customer funded. `offerId` is null when the
 * launch could not name ONE offer (several, or a failed read) — the campaign then
 * ships unattributed and the redirect hands the landing to the walk instead.
 */
type LaunchResult = {
  campaignId: string;
  offerId: string | null;
  funnelKey: string;
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
  /**
   * Whether the six offer levers were answered BEFORE the account existed (the
   * anonymous path). The post-payment steps run on a FRESH page load — the Stripe
   * return — so React state cannot carry it there; top level for the same reason
   * as the selection above, and version-independent, so ONBOARDING_STATE_VERSION
   * stays at 8. Absent on a blob written before this shipped: reads false, and the
   * post-payment walk asks the levers exactly as it did then.
   */
  leversStatedBeforeAccount?: boolean;
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
  // The sell-first picks (outcome keys, and (funnel x channel) pair keys), so a
  // refresh on any step keeps them and the funnel step stays pre-selected.
  // OPTIONAL: a snapshot written before the picks became steps has none, and
  // requiring them would strand it (a version bump strands an in-flight checkout).
  startOutcomes?: string[];
  startFunnels?: string[];
  // Did this visitor answer the six offer levers BEFORE creating the account?
  // The post-payment sequence ends `model` -> `offer` -> launch, so without this
  // an anonymous visitor who stated them pre-account is asked the same six
  // questions again after paying, prefilled with their own answers. OPTIONAL for
  // the same reason as the two above: a snapshot written before it shipped has
  // none and reads false, which is exactly the pre-change walk, and requiring it
  // would need a version bump — which strands an in-flight checkout.
  leversStatedBeforeAccount?: boolean;
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
  "welcome", "url", "loading", "services", "destination", "objective", "rates", "funnels", "primary", "audiences", "consent", "pricing", "bonus", "launching",
  // APPENDED, never inserted: this list is what a persisted snapshot parses
  // against, so the order is not meaningful and growing it at the end keeps
  // every older snapshot valid. A bump would strand a session mid-checkout.
  "built",
  "outcome", "path", "returns",
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
    typeof p.servicesEdited !== "boolean" || typeof p.ratesEdited !== "boolean" ||
    !(p.startOutcomes === undefined || isStringList(p.startOutcomes)) ||
    !(p.startFunnels === undefined || isStringList(p.startFunnels)) ||
    !(p.leversStatedBeforeAccount === undefined || typeof p.leversStatedBeforeAccount === "boolean")
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
    // The funnel set is stated on the sell-first Path screen; the wizard's own
    // how-do-you-sell step and the primary pick were removed (one question
    // twice), so a snapshot naming either lands on the picks.
    case "funnels":
    case "primary":
      return "outcome";
    // The single lifetime-revenue screen, and the per-funnel screens that
    // replaced it, are both gone: rates and lifetime revenue are not asked at
    // signup at all. A snapshot naming it lands on the phone step, where the
    // post-payment run now begins. Never reached from a resume (the post-payment
    // steps are not persisted); the render fail-safe uses this arm.
    case "ltr":
      return "phone";
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

  // THE SELL-FIRST PICKS, the wizard's own first three steps. They live here so
  // they persist with the rest of the snapshot, pre-select the funnel step, and
  // still reach the `distribute-start` cookie the proxy and the payment screens
  // read on the far side of the Clerk redirect.
  const [startOutcomes, setStartOutcomes] = useState<string[]>(() => restored?.startOutcomes ?? []);
  const [startFunnels, setStartFunnels] = useState<string[]>(() => restored?.startFunnels ?? []);
  // Set when a signed-out visitor finishes the offer levers, read by the
  // post-payment walk so it does not ask them a second time.
  const [leversStatedBeforeAccount, setLeversStatedBeforeAccount] = useState<boolean>(
    () => restored?.leversStatedBeforeAccount ?? false,
  );
  const { catalogue: startCatalogue, catalogueError: startCatalogueError } = useStartCatalogue();

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
        : // A CLAIMED return: they built the whole thing signed out, just made
          // an account, and the org they built is now theirs. The only thing
          // left is the money, so land on the budget step rather than resuming
          // at `built` — which is where the snapshot legitimately says they
          // were, and which would ask them to create an account they now have.
          searchParams.get("claimed") === "1"
          ? "pricing"
          : resolveResumeStep(restored.step, restored.brandId)
      : resumeBrandIdParam && searchParams.get("launch_checkout") === null
        ? // Cross-session brand resume: show the loading screen immediately (no URL
          // flash) while the param-resume effect re-hydrates the brand, then it lands
          // on the goal step.
          "loading"
        : fromAdd
          ? // Adding a brand: the pitch is not repeated, the three sell-first
            // screens are. They are the ONLY place the funnel set is stated now
            // that the how-do-you-sell step is gone.
            "outcome"
          : // A fresh visitor: the welcome, then the three sell-first screens,
            // then the website (only if the landing did not carry one), then the
            // build. One flow, whatever the landing handed over.
            "welcome",
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
  // The exits offered under a refused signed-out setup, on the URL step itself.
  // Cleared the moment the website is edited: the links carried the old one.
  const [refusal, setRefusal] = useState<RefusalExits | null>(null);
  // Whether this signup arrived through someone's referral link, and who sent them.
  //
  // A referred signup is owed BOTH offers: the $30 welcome, given outright at
  // signup, and $500 of referral credits earned once their payments reach the
  // stacked bar. The gift step must not quote the welcome figure alone: that
  // understates what they get by $500 on the screen where they decide to pay, and
  // contradicts the link that brought them here.
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
  // THE PATHS PICKED ON THE SELL-FIRST SCREENS ARE THE FUNNEL STEP'S ANSWER.
  // The picks name (funnel x channel) pairs in the producer's spelling; this
  // app's catalogue names funnels in its own. Each key goes through the
  // tolerant collapse and anything it cannot name — a funnel the catalogue no
  // longer offers, a hand-edited snapshot — is dropped rather than guessed.
  // The picks ARE the answer: the wizard's own how-do-you-sell step and the
  // primary pick were removed, since asking either two screens after "how should
  // it turn into revenue?" is the same question twice. A flow that reaches the
  // services step with no pick is sent back to the Path screen.
  const pickedFunnelKeys = funnelKeysFromSelection(startFunnels)
    .map((key) => salesFunnelKeyOrNull(key))
    .filter((key): key is NonNullable<typeof key> => key !== null && offeredFunnels.some((f) => f.key === key));
  const pickedFunnelKeysJoined = pickedFunnelKeys.join(",");
  useEffect(() => {
    if (pickedFunnelKeys.length === 0) return;
    setSelectedFunnelKeys((current) => (current.length > 0 ? current : pickedFunnelKeys));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedFunnelKeysJoined]);
  // Every pick is written through immediately, so a visitor who signs up from a
  // second tab, or who is bounced through an OAuth round, arrives with what they
  // chose. `paid: []` on purpose: these steps are where a selection is MADE, and
  // anything bought under a previous one belongs to that one. The channel is not
  // picked, so it is STATED — billing keys its ceiling on the (funnel x channel)
  // pair. Only the signup flow: an existing customer adding a brand never sees
  // the picks, and a blank write here would erase a selection in flight.
  useEffect(() => {
    if (flowKey !== "signup") return;
    document.cookie = startSelectionCookieAssignment({
      outcomes: startOutcomes,
      channels: [DEFAULT_CHANNEL_SLUG],
      funnels: startFunnels,
      paid: [],
    });
  }, [flowKey, startOutcomes, startFunnels]);
  const [primaryFunnelKey, setPrimaryFunnelKey] = useState<string | null>(null);
  // Per-funnel draft answers for the post-payment detail screens, keyed by funnel.
  // Each holds that funnel's rate fields plus its own lifetime revenue and
  // destination — a self-serve signup customer and an enterprise meeting customer
  // are not worth the same and do not land on the same page.
  const selectedFunnels = offeredFunnels.filter((f) => selectedFunnelKeys.includes(f.key));
  const primaryFunnel = selectedFunnels.find((f) => f.key === primaryFunnelKey) ?? null;
  // A brand that picked ONE path. Read by the budget step (which drops every "each
  // path" sentence and its total).
  const onePath = selectedFunnels.length === 1;
  // What the brand's economics actually say, for the funnel screens to prefill from.
  // Deliberately NOT in the persisted snapshot: adding a field there forces an
  // ONBOARDING_STATE_VERSION bump, which strands an in-flight checkout — and this is
  // re-read from the wire on the post-payment page load anyway (prewarmStoredEconomics).
  const [storedEconomics, setStoredEconomics] = useState<EffectiveSalesEconomics | null>(null);
  const [rates, setRates] = useState<Record<RateKey, number>>(() => restored?.rates ?? { ...DEFAULT_RATES });
  const [rateText, setRateText] = useState<Record<RateKey, string>>(() => restored?.rateText ?? { ...DEFAULT_RATE_TEXT });
  const [services, setServices] = useState<string[]>(() => restored?.services ?? []);
  const [serviceDraft, setServiceDraft] = useState("");
  // The brand-level page outreach clicks land on. Each FUNNEL owns its own
  // landing page, and the screens that asked for one ran AFTER the card and are
  // gone, so the flow no longer asks this at all. brand-service still serves the
  // field on the brand read and consumers link off it, so the value survives and
  // is set on Settings instead. "" means "not set yet". Seeded from
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

  // What a day of cold email costs to run — the floor every ceiling stated here
  // must clear, read from that channel's own published terms rather than from a
  // per-funnel table. Signup funds one channel: a funnel-grain ceiling names no
  // channel, and billing resolves a funnel that funds none yet to cold email, so
  // that is the channel these figures are judged against.
  //
  // Fetched imperatively because this flow holds no react-query provider of its
  // own — it can create the org it runs in, so it opts out of the org-keyed one.
  // Through the PUBLIC route, because this wizard runs signed out: `/api/v1/*`
  // lives inside `(authed)` and answers a session-less read with the sign-in
  // page, so the authed reader threw on HTML on every signed-out visit.
  // NO floor is the honest reading while it settles or if it fails: billing holds
  // the same rule against the same figure and its 400 is what decides, so nothing
  // here refuses money billing would accept.
  const [channelMinimums, setChannelMinimums] = useState<ChannelMinimums>(NO_CHANNEL_MINIMUMS);
  useEffect(() => {
    let live = true;
    getPublicChannelsSignedOut()
      .then((channels) => {
        if (live) setChannelMinimums(channelMinimumsFromWire(channels));
      })
      .catch((err) => {
        console.error("[dashboard] onboarding: could not read the channels' published terms", err);
      });
    return () => {
      live = false;
    };
  }, []);
  const launchFloorCents = channelMinimumCents(channelMinimums, SALES_FEATURE_SLUG);
  /** The same floor in whole dollars, rounded UP so the seed can never be refused. */
  const launchFloorUsd = launchFloorCents === null ? null : Math.ceil(launchFloorCents / 100);
  const [checkoutBudgetUsd, setCheckoutBudgetUsd] = useState<number | null>(() => restored?.checkoutBudgetUsd ?? null);
  const [audiencePrompt, setAudiencePrompt] = useState(() => restored?.audiencePrompt ?? "");
  // Pre-warmed audience step: during the loading screen we draft the ICP prompt
  // in the background, so the target-audience box opens already filled. Stashed in
  // state (not a ref) so a late-resolving prewarm still flows into the step as a prop.
  // NO audience is searched, suggested or created here: the customer states who
  // they sell to in one box, and the audiences are built by hand once they have
  // paid. `audienceCandidates` / `selectedAudienceIds` stay on the persisted shape
  // (removing a field is a version bump, which strands an in-flight checkout) and
  // are written EMPTY.
  const [audiencePrefetch, setAudiencePrefetch] = useState<AudiencePrefetch | null>(null);
  // Whether the loading-screen service extraction FAILED. The services step
  // renders one of two honest states off this — a list, or a stated failure with
  // a retry — instead of its "we drafted these" copy over an empty box, which is
  // what a swallowed extract failure used to look like. There is no third
  // "still reading" state: the loading screen does not end until the services
  // have been read (or have failed to be), so nothing can still be in flight.
  const [servicesExtractFailed, setServicesExtractFailed] = useState(false);
  const [servicesRetrying, setServicesRetrying] = useState(false);
  const [launchStep, setLaunchStep] = useState(0);
  const [launchingBrand, setLaunchingBrand] = useState<{ domain: string | null; hostname: string } | null>(null);
  // Post-payment steps (phone → ltr → offer levers). `phone` is user-level
  // (Clerk metadata), optional. `offerIndex` walks the offer levers one screen at
  // a time. The pending checkout blob is stashed so the terminal offer step can
  // run completeLaunchAfterCheckout AFTER the user finishes these steps (with
  // their edited profile), instead of at the checkout-return effect.
  const [phone, setPhone] = useState<PhoneValue>(EMPTY_PHONE);
  // Whether the syntax problem is on SCREEN. Separate from whether one EXISTS:
  // a message under a half-typed number is noise, so it is revealed once the
  // person has finished typing (blur) or has pressed Continue. Continue is only
  // greyed out while the reason is visible, so the button never reads dead.
  const [phoneProblemRevealed, setPhoneProblemRevealed] = useState(false);
  // Declared here, ABOVE every consumer (`savePhoneAndContinue`, the step's
  // render) — a const a consumer declared earlier would read is a TDZ throw at
  // render time that `tsc` cannot see.
  const phoneProblem = phoneSyntaxProblem({ dialCode: phone.dialCode, national: phone.national });
  const [offerIndex, setOfferIndex] = useState(0);
  const pendingCheckoutRef = useRef<PendingCheckoutLaunch | null>(null);
  // Best-model step (post-payment, after LTR). The 3-grain workflow-projection
  // LADDER — the SAME endpoint + pick the Strategy page uses, so the numbers match
  // byte-for-byte. Prewarmed at the celebrate step, refetched after the LTR save
  // (the entered lifetime revenue changes the projected CAC / ROI). `null` = still
  // loading; the step shows a skeleton until it lands.
  // The model step lets the user edit the two things the ROI is computed from
  // (lifetime revenue and the goal's conversion rate) and recompute, because a return
  // under 1x is otherwise unexplainable on a screen that shows neither number.
  // What the primary funnel's draft looked like the last time this step wrote it (or
  // when the step was first shown). The Update button arms on a LIVE compare against
  // it, never a sticky "edited" latch: typing a value and undoing it must disarm the
  // button again.
  // Aggressive parallel launch. The whole launch (audiences, auto-topup, budget,
  // campaign create, onboarding-complete) is kicked off in the BACKGROUND the moment
  // the checkout returns — while the user fills the optional post-payment steps — so
  // "Opening your dashboard" is near-instant, and the campaign is created even if the
  // user quits before reaching the dashboard. `backgroundLaunchRef` holds the single
  // in-flight promise (fire once); `launchError` surfaces a background failure at the
  // terminal launching screen with a retry.
  const backgroundLaunchRef = useRef<Promise<LaunchResult> | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Loading-sequence + real fetch coordination. The visible checks follow real
  // client milestones: org ready, brand upserted, then service extraction.
  const [loadStep, setLoadStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [brandId, setBrandId] = useState<string | null>(() => restored?.brandId ?? null);
  const brandIdRef = useRef<string | null>(restored?.brandId ?? null);
  const orgIdRef = useRef<string | null>(restored?.orgId ?? null);

  // A signed-in session recovers the org it belongs to from Clerk, when nothing
  // else has stated one.
  //
  // `orgIdRef` is written by the loading step, and the SIGNED-OUT path leaves it
  // null on purpose: the anonymous session IS the org and there is no Clerk org to
  // name yet. At signup `/onboarding/claim` re-points that same org at the Clerk
  // org the visitor just made and sends them back here with `?claimed=1` — which
  // lands on the budget step, from a snapshot written while signed out, so the ref
  // is restored as null. The `?brandId=` resume effect that WOULD read Clerk bails
  // whenever a snapshot exists, which is the ordinary same-tab case, so nothing
  // ever filled it and the launch blob threw on every claimed signup.
  //
  // FILLS ONLY, never overwrites. `createBrandAndFetchServices` is authoritative:
  // on `?new=1` it mints a fresh org and writes it here, and a later Clerk read
  // must not walk over it.
  useEffect(() => {
    if (orgIdRef.current || !organization?.id) return;
    orgIdRef.current = organization.id;
  }, [organization?.id]);
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
  // Whether what is in the field can be a website at all. `extractDomain` is
  // deliberately lax (it also reduces a stored brand URL on the post-Stripe
  // replay path), so it happily returns `gmail.com` for `kevin@gmail.com` and
  // the button was gated on that alone. `websiteInputProblem` is the rule; see
  // `lib/website-input.ts` for what accepting an address cost a customer.
  const websiteProblem = noWebsiteMode ? null : websiteInputProblem(url);
  // What every step's shell needs beyond its own body: where the flow is (the
  // stepper), the trust strip's count, and the website the bar names.
  const chrome: StepChrome = { step, founders: startCatalogue?.founders ?? null, brandHost: domain };
  // The sentence to show under the field, or null while there is nothing to
  // refuse. ONE derivation because the message and the standing "I have no
  // website" button are mutually exclusive: two ways out stacked on top of each
  // other read as the same control twice, and the refusal's own link is the one
  // that belongs to the moment. `NOT_A_WEBSITE` is the defensive tail for an
  // input the rule accepts and `extractDomain` still cannot reduce.
  const websiteRefusal = !url.trim() || noWebsiteMode ? null : (websiteProblem ?? (domain ? null : NOT_A_WEBSITE));
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
      audienceCandidates: null,
      selectedAudienceIds: [],
      workflowProjection: projectionRef.current,
      salesInputs: salesInputsRef.current,
      launchFeatureInputs: launchFeatureInputsRef.current,
      brandId,
      orgId: orgIdRef.current,
      servicesEdited: servicesEditedRef.current,
      ratesEdited: ratesEditedRef.current,
      startOutcomes,
      startFunnels,
      leversStatedBeforeAccount,
    };
  }

  // Persist the in-progress wizard on every change so a refresh / back resumes here.
  // Skipped only while Stripe success owns the launch path. A cancelled checkout must
  // keep writing the restored full snapshot so further edits persist normally.
  useEffect(() => {
    if (searchParams.get("launch_checkout") === "success") return;
    writeOnboardingState(buildOnboardingState());
  }, [step, url, noWebsiteMode, brandName, brandContext, outcome, rates, rateText, services, clickDestinationUrl, profile, selectedBudget, customBudget, checkoutBudgetUsd, audiencePrompt, brandId, flowKey, searchParams, pricingHydrationVersion, startOutcomes, startFunnels, leversStatedBeforeAccount]);

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
  // audience prewarm from backend) and land on the funnels step — the user re-confirms
  // funnels → primary → audiences → consent → budget with everything before it prefilled.
  // We stop at the funnels step (not budget) because the pre-terminal audience picks +
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
        // The funnel set is stated on the sell-first screens, so a resumed brand
        // starts there; `continueAfterPicks` then skips the analyze it already ran.
        await runResume("outcome", seededUrl);
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

  // The ONE writer of the services list from an extraction. Never clobbers a list
  // the user edited on the services step: a same-brand re-analyze (edit-brand →
  // url → analyze) keeps servicesEditedRef true (the brand-switch reset only fires
  // when the brandId actually changes), so the user's edits win over a re-read.
  function applyExtractedServices(nextServices: string[]) {
    if (nextServices.length === 0) return;
    setProfile((prev) => ({
      ...prev,
      services: servicesEditedRef.current ? prev.services ?? nextServices : nextServices,
    }));
    if (!servicesEditedRef.current) setServices((prev) => (prev.length ? prev : nextServices));
  }

  async function hydrateOnboardingInBackground(id: string): Promise<void> {
    // Pre-warm the audience step FIRST: draft the ICP prompt in the background,
    // before the lever extraction below is awaited. The
    // ICP seeds from the services (extracted and awaited by the caller) and
    // deliberately EXCLUDES the offer levers (brand-service curateIcpProfileFields),
    // so it does not need that extraction — and awaiting it first (p90 35 s) left
    // `prefetch` null when a fast click-through reached the audience step, which
    // then fired its OWN ICP + suggest while this one ran unadopted: two ~35 s
    // suggest runs per signup, both billed. By the time the user clicks through
    // services → funnels → primary, candidates are ready. Fail-soft — a failed
    // ICP/suggest resolves candidates:null and the step falls back to its own draft
    // + manual "Suggest audiences".
    const audiencePrewarm = (async (): Promise<{ prompt: string; icpFailed: boolean }> => {
      // The ICP draft ONLY. No audience suggest runs during onboarding any more:
      // the customer states who they sell to and the audiences are built by hand
      // after payment, so a suggest here would be LLM spend on a result nobody
      // reads. An ICP that came back empty is the same situation as one that
      // threw: nothing brand-service drafted, so the step must not present its
      // own sentence as one.
      try {
        const { icp } = await suggestBrandIcp(id);
        const prompt = icp.trim();
        return { prompt, icpFailed: !prompt };
      } catch (e) {
        console.error("[dashboard] audience prewarm (ICP draft) failed:", e);
        return { prompt: "", icpFailed: true };
      }
    })();
    setAudiencePrefetch({ promise: audiencePrewarm });

    // Then warm ONLY the 7 user-facing fields (services + the 6 offer levers) in suggest
    // mode — the offer step reads these via getBrandUserFields and needs a best-effort
    // value for every lever (never "Unknown"). The backend-only SALES_PROFILE_FIELDS
    // (funding/competitors/leadership/...) are NOT extracted here: onboarding never reads
    // them, and the brand-info alpha page regenerates them on demand.
    await extractBrandFields([id], USER_PROFILE_FIELDS, { mode: "suggest" }).catch((e) => {
      console.error("[dashboard] extractBrandFields (background) failed:", e);
    });

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
      // The services CHIPS are deliberately not written here. This hydrate resolves
      // tens of seconds after the loading screen settled that list, and a list
      // swapping in under whoever is reading the step is the bug the loading
      // screen exists to prevent. Only the profile bag above takes the value, and
      // only when the loading screen produced none.
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
      // A prefilled DEFAULT is a whole number (8.8429 → 9): the backend economics
      // carry full precision, and a guess offered with decimals reads as a
      // measurement. The user can still type finer precision manually.
      const roundRate = (n: number) => roundPrefilledRate(n);
      const loaded: Record<RateKey, number> = {
        ltv: Math.round(e.lifetimeRevenueUsd),
        v2s: roundRate(e.visitToSignupPct),
        s2c: roundRate(e.signupToPaidClientPct),
        v2m: roundRate(e.visitToMeetingPct),
        r2m: roundRate(e.replyToMeetingPct),
        m2c: roundRate(e.meetingToClosePct),
        // The effective economics carry only the signup/meeting funnel + the derived
        // visit→close. Seed website_visits' visit→paid from visitToClosePct (same grain);
        // the reply/form beta rates have no effective-econ source → keep the seeded
        // defaults (the user tweaks them on the rates step).
        v2p: roundRate(e.visitToClosePct),
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
  //
  // ⚠️ `flowKey === "signup"` means "no ?from=add and no ?new=1", which is NOT the
  // same statement as "this person is signing up". `/start` is a 308 onto a BARE
  // `/onboarding`, and the landing sends every visitor there — a signed-in
  // customer included. So the URL shape alone licensed renaming a live customer's
  // org to whatever domain they happened to type on the landing: measured
  // 2026-09-19, an agency org running 15 brands was renamed to `lefigaro.fr`, and
  // nothing anywhere said so. The authoritative signal for "this org has already
  // been set up" is the one the edge gate itself reads, so read that instead of
  // inferring a first run from the address bar.
  function maybeRenameFreshSignupOrg(orgId: string, orgName: string) {
    if (flowKey !== "signup") return;
    if (!organization || organization.id !== orgId || !orgName) return;
    if (orgOnboardingComplete(organization)) return;
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
    // Null on the signed-out path: there is no Clerk org yet, and the calls
    // below that take one are skipped rather than handed a placeholder.
    let targetOrgId: string | null = null;

    // SIGNED OUT: the whole build half runs before anyone has an account.
    //
    // There is no Clerk org to create and none is created — the session IS an
    // org, one with no identity provider attached yet, and at signup that same
    // org is re-pointed at the Clerk org the visitor makes. So nothing here
    // moves later: the brand, the funnels, the audiences and the spend are
    // already on the org that becomes theirs.
    //
    // A REFUSAL IS NOT AN ERROR. It means this visitor gets the flow we shipped
    // before this existed, where the card comes first — so it is stated in the
    // server's own words and they continue to signup rather than being stopped.
    if (!user) {
      const outcome = await startAnonSession(brandUrl);
      if (!outcome.started) {
        setError(outcome.message);
        setBusy(false);
        // The visitor STAYS on the URL step, website still in the field, so a
        // held or mistyped website can be changed right here. The two exits
        // (sign in when it is theirs, create an account anyway) are links under
        // the error, never a redirect: the redirect this replaced left a person
        // on the sign-up wall with no way back to the field (#4296).
        setRefusal(
          refusalExits({
            reason: outcome.reason,
            domain: domain ?? hostname,
            brandUrl,
          }),
        );
        setStep("url");
        return;
      }
    } else if (reuseOrg) {
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
    // prompt ("already filled") and keeps the previous brand's ICP; rates stay
    // stale because ratesEditedRef is still set. A same-brand
    // RESUME has equal ids → no reset → user edits preserved.
    if (previousBrandId && previousBrandId !== newBrandId) {
      setAudiencePrompt("");
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
    // The services are READ HERE, on the loading screen, and nowhere later. The
    // landing page is the fast path (one scrape); when it yields nothing (an
    // unscrapable landing, a site whose offer lives on a sub-page) the whole-site
    // map is walked before this screen is allowed to end. The next step used to
    // open on an empty box with a "still reading" spinner, waiting for the
    // background hydrate to fill it in tens of seconds later; a list appearing
    // under the cursor is not a draft, and the loading screen is where waiting
    // belongs. Both attempts are `.catch`ed: a failed read must not strand
    // someone here, so the failure is RECORDED and the services step states it
    // with a retry, rather than claiming a list it never received.
    const landingFields = await extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { urlStrategy: "landing", mode: "suggest" }).catch((e) => {
      console.error("[dashboard] extractBrandFields (landing) failed:", e);
      return null;
    });
    let extractedServices = normalizeServices(landingFields?.fields.services?.value);
    if (extractedServices.length === 0) {
      const mappedFields = await extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { urlStrategy: "url_map", mode: "suggest" }).catch((e) => {
        console.error("[dashboard] extractBrandFields (url_map) failed:", e);
        return null;
      });
      extractedServices = normalizeServices(mappedFields?.fields.services?.value);
    }
    captureSetupMilestone(extractedServices.length > 0 ? "services_extracted" : "services_extract_failed", servicesStartedAt);
    setServicesExtractFailed(extractedServices.length === 0);
    brandIdRef.current = newBrandId;
    orgIdRef.current = targetOrgId;
    setBrandId(newBrandId);
    // Remember the brand for the edge gate. Everything from here on is persisted
    // in brand-service, but the wizard's own progress is not: it lives in
    // sessionStorage, so closing the tab loses it, and `onboardingComplete` is
    // only written at the terminal launch — so the gate bounces the user back here
    // and needs to be told which brand to resume. Cleared at launch.
    //
    // Signed out there is no org to scope it to, and none is needed: the edge
    // gate that reads this cookie only ever fires for a signed-in user, and an
    // anonymous session already carries its own brand inside its signed token.
    if (targetOrgId) {
      document.cookie = onboardingBrandCookieAssignment(targetOrgId, newBrandId);
    }
    posthog.capture("onboarding_brand_created", {
      flow: "beta",
      org_id: targetOrgId ?? "anonymous",
      brand_id: newBrandId,
    });
    applyExtractedServices(extractedServices);
    fetchDoneRef.current = true;
    setLoadStep(LOADING_STEPS.length);
    // The hydrate warms the offer levers, the economics and the projection for
    // the steps AFTER services. It never writes the services list: that list was
    // settled above, before this screen ended.
    const hydration = hydrateOnboardingInBackground(newBrandId).catch((e) => {
      console.error("[dashboard] onboarding background hydrate failed:", e);
    });
    hydrationPromiseRef.current = hydration;
  }

  // The last sell-first screen's CTA. The website is already in the field when
  // the landing carried one (the seeding effect above), so the setup starts at
  // once and the visitor watches work happen; without one, or with one the
  // website rule refuses, the URL step asks — never the welcome pitch again.
  function continueAfterPicks() {
    // A resumed brand (`?brandId=`, or a refresh after the build) was already
    // analyzed: re-running the setup would bill the extraction twice.
    if (brandIdRef.current && services.length > 0) {
      setStep("services");
      return;
    }
    if (!url.trim() || !domain || websiteProblem !== null) {
      setStep("url");
      return;
    }
    void startAnalyze();
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
    let targetOrgId: string | null = null;

    // SIGNED OUT — the same branch the website path has had since the signed-out
    // half shipped, and its absence here was a dead end: `createOrganization` is
    // Clerk's and is undefined with no session, so "I have no website" threw
    // "Organization setup is not ready yet" for every signed-out visitor. That
    // button renders on the URL step unconditionally, which is a step reached
    // before anyone has an account, so the path was unreachable for exactly the
    // people it exists for.
    //
    // There is nothing to claim: the claim question is about a domain and this
    // visitor has none, so the session is started on that declared fact rather
    // than on a website string nobody typed.
    if (!user) {
      const outcome = await startAnonSession("", { noWebsite: true });
      if (!outcome.started) {
        // A refusal is not an error here either: they continue to signup and get
        // the flow where the card comes first. Stated in the server's own words,
        // on the step they are already on, never a redirect.
        setError(outcome.message);
        setBusy(false);
        setStep("url");
        return;
      }
    } else if (reuseOrg) {
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
    // One read, awaited: there is no site to walk, the pasted context is all
    // there is. Same rule as the website path — the list is settled before this
    // screen ends, or its absence is recorded for the services step to state.
    const contextFields = await extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { mode: "suggest" }).catch((e) => {
      console.error("[dashboard] extractBrandFields (no-website) failed:", e);
      return null;
    });
    const extractedServices = normalizeServices(contextFields?.fields.services?.value);
    captureSetupMilestone(extractedServices.length > 0 ? "services_extracted" : "services_extract_failed", servicesStartedAt);
    setServicesExtractFailed(extractedServices.length === 0);
    brandIdRef.current = newBrandId;
    orgIdRef.current = targetOrgId;
    setBrandId(newBrandId);
    // Same resume cookie as the website path, and the same guard: signed out
    // there is no org to scope it to and none is needed, because the edge gate
    // that reads it only fires for a signed-in user and an anonymous session
    // already carries its brand inside its own signed token.
    if (targetOrgId) {
      document.cookie = onboardingBrandCookieAssignment(targetOrgId, newBrandId);
    }
    posthog.capture("onboarding_brand_created", { flow: "beta", org_id: targetOrgId, brand_id: newBrandId, no_website: true });
    applyExtractedServices(extractedServices);
    fetchDoneRef.current = true;
    setLoadStep(LOADING_STEPS.length);
    const hydration = hydrateOnboardingInBackground(newBrandId).catch((e) => {
      console.error("[dashboard] onboarding background hydrate (no-website) failed:", e);
    });
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
  // re-saves any offer-lever edits on top.
  //
  // Returns the created campaign id AND the scope it was created in — the offer it
  // sells and the funnel it runs — because the terminal redirect lands on the deepest
  // scope with no choice left in it, and this is where both are already resolved. A
  // null offer is the launch failing to name one (see below), never a level to invent.
  async function runLaunchWork(pending: PendingCheckoutLaunch): Promise<LaunchResult> {
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
    // NO audience is activated here. Onboarding collects the customer's own words
    // for who they sell to (saved on the brand as `targetAudience`); the audiences
    // themselves are built by hand after payment, so there is nothing to commit.
    await configureAutoTopup(pending.topupAmountCents, pending.topupThresholdCents);
    setLaunchStep(1);
    // The OFFER everything this launch creates is about. A campaign is
    // (offer x funnel x channel) and billing keys its ceiling on the same triple,
    // so a launch that names no offer produces a campaign no offer page can show
    // and a ceiling that addresses the pair rather than the campaign it funds.
    //
    // Read, never created: brand-service gives a brand its first offer on the
    // first brand-scoped write, and the funnels step made one several minutes ago.
    // Best-effort BY DESIGN — the customer has already been charged, and both
    // consumers adopt an unattributed row on their own cadence, so a brand whose
    // offers cannot be read (or that holds several, where there is no single
    // correct answer) launches unattributed rather than not at all.
    let launchOfferId: string | null = null;
    try {
      const { offers } = await listBrandOffers(pending.brandId);
      launchOfferId = soleOfferId(offers);
    } catch (err) {
      console.error("[dashboard] launch could not name the brand's offer", err);
    }
    if (!launchOfferId) {
      console.error(
        `[dashboard] launch could not name the brand's offer for brand ${pending.brandId} — campaign and ceiling ship unattributed`,
      );
    }
    // Fund each funnel it its own ceiling. billing then answers the brand's daily
    // budget as their SUM, so every consumer that reads the brand total — the launch
    // gate, the runway, the credit alerts, the Overview tile — is unchanged.
    //
    // A blob written before per-funnel funding shipped carries no map; it falls back
    // to the single brand-level write, which is exactly what it expected to happen.
    const funnelBudgetRows = Object.entries(pending.funnelBudgets ?? {})
      .filter(([, usd]) => usd > 0)
      .map(([funnelKey, usd]) => ({
        funnelKey,
        dailyBudgetCents: Math.round(usd * 100),
        ...(launchOfferId ? { offerId: launchOfferId } : {}),
      }));
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
    // WHICH ARROW of that funnel this campaign buys, stated the way the fleet keys it.
    //
    // A campaign is (brand x offer x channel x leg), and the leg is what a customer
    // actually buys — the funnel cannot name which of its own arrows a channel performs.
    // Resolved out of the published channel catalogue, so the identifier is
    // features-service's rather than one minted here, and the arrow is placed by the SAME
    // rule every surface later reads it back with.
    //
    // Best-effort by construction: the customer has already been charged by the time this
    // runs, so a catalogue read that fails must not strand the launch. A campaign that
    // states no leg is read exactly as every campaign created before the column existed.
    const launchLeg = await getPublicChannels()
      .then((channels) => launchLegKey(channels, SALES_FEATURE_SLUG, salesFunnelByKey(normalizeSalesFunnelKey(launchFunnelKey))))
      .catch((err) => {
        console.error("[dashboard] launch: could not resolve the leg for this campaign", err);
        return null;
      });
    const { campaign } = await createCampaignWithoutBrandEnrichment({
      funnelKey: launchFunnelKey,
      ...(launchLeg ? { legKey: launchLeg } : {}),
      // The proposition this campaign sells, resolved above from the brand's own
      // offers. Omitted rather than nulled when there is no single correct answer:
      // campaign-service adopts an offer-less campaign on its own tick.
      ...(launchOfferId ? { offerId: launchOfferId } : {}),
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
      // No per-campaign budget ceiling is stated, and campaign-service refuses one
      // on a sales campaign. The daily budget the customer picked was written to
      // billing a few lines above, on the brand's funnel ceilings, at the
      // (funnel, channel, offer) grain that IS a campaign — nothing reads a
      // per-campaign copy, so stating one only 400s the launch, after the
      // customer has already been charged.
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
    return { campaignId: campaign.id, offerId: launchOfferId, funnelKey: launchFunnelKey };
  }

  // Fire the full launch ONCE, in the background, the moment checkout returns. Idempotent
  // via `backgroundLaunchRef` (never creates two campaigns). A failure is surfaced at the
  // terminal launching screen (launchError) with a retry; the fire-site swallow keeps it
  // from becoming an unhandled rejection while the user is still on an earlier step.
  function startBackgroundLaunch(): Promise<LaunchResult> {
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
    // No audience gate: nothing is picked during onboarding any more (the
    // audiences are built by hand after payment), so the blob carries an empty
    // list under the field older readers still expect.
    const launchAudienceIds: string[] = [];
    // Live selection wins, the stored blob is the fallback, so a re-checkout after
    // a cancel carries whatever the user has picked NOW. This is NOT a launch gate:
    // the per-funnel screens are a preview, so an empty selection must never block
    // a paid launch — it just means those screens have nothing to ask.
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
    // The first charge is the budget MINUS the welcome gift; the auto-topup reload
    // below is the FULL budget. Reusing the discounted figure for both would leave
    // every later reload short by the gift, forever, on a one-time discount.
    const firstCharge = planFirstCharge(budget);
    const checkoutAmountCents = firstCharge.chargeCents;
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
      topupAmountCents: Math.round(budget * 100),
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
      // Live state wins, the stored blob is the fallback — same precedence as the
      // selection above, so a re-checkout after a cancel still remembers that the
      // levers were answered before the account.
      leversStatedBeforeAccount: leversStatedBeforeAccount || (storedPending?.leversStatedBeforeAccount ?? false),
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

      const charges = checkoutAmountCents > 0;

      const successUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      successUrl.searchParams.set("success", "true");
      successUrl.searchParams.set("launch_checkout", "success");
      if (charges) {
        // Google Ads PURCHASE conversion value = the 1-day budget the user picked
        // (dollars). Read on the checkout RETURN (payment succeeded) by
        // AdsPurchaseTracker. Reflects the recurring per-day commitment, not the
        // one-off charge amount.
        //
        // Set ONLY when money actually moves. A budget covered by the welcome gift
        // returns through the same success URL having paid nothing, and the tracker
        // reads this param as the conversion value — so leaving it on would report a
        // purchase to Google Ads for a $0 card imprint, at the full budget.
        successUrl.searchParams.set("daily_budget", String(budget));
      }
      const cancelUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      cancelUrl.searchParams.set("launch_checkout", "cancelled");

      // Nothing left to charge once the gift covers the budget: take the card
      // imprint and no money. Same success URL, so the launch resumes identically.
      const session = await createCheckoutSession(
        charges
          ? {
              topup_amount_cents: checkoutAmountCents,
              success_url: successUrl.toString(),
              cancel_url: cancelUrl.toString(),
            }
          : {
              mode: "setup",
              success_url: successUrl.toString(),
              cancel_url: cancelUrl.toString(),
            },
      );
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
      // The levers, when this visitor stated them before the account. React state
      // is gone by now (this is the Stripe return, a fresh page), so the blob is
      // where the fact lives.
      setLeversStatedBeforeAccount(pending.leversStatedBeforeAccount ?? false);
      setStep("celebrate");
      setBusy(false);
      // Kick the whole launch in the BACKGROUND right now — while the user fills the
      // optional post-payment steps — so the dashboard opens near-instantly and the
      // campaign is created even if they quit before reaching it. Also prewarm the
      // best-model projection (refetched after the LTR save) so the model step is warm.
      startBackgroundLaunch().catch(() => {});
      const prewarmId = pending.brandId;
      if (prewarmId) {
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
  // the welcome gift is new-org-only, so we skip the checkout screen and
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
        prewarmStoredEconomics(prewarmId);
      }
    } catch (err) {
      posthog.capture("onboarding_launch_failed", { flow: "beta", stage: "direct_launch" });
      setError(err instanceof Error ? err.message : "Launch failed. Your brand was not launched.");
      setBusy(false);
    }
  }

  // Pricing-step "Continue". For an existing org ADDING a brand (`?from=add`) with a
  // card already on file, skip the welcome screen + Stripe checkout and launch
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

  // Consent-step "Continue". SIGNED OUT the next thing is the OFFER, then the
  // recap, then the account — never the money: the launch blob requires an org id
  // a signed-out session does not have by design, so walking an anonymous visitor
  // into the checkout threw and going back to pricing changed nothing.
  //
  // It routed straight to `built` for one release, which skipped the six lever
  // screens the recap STATES — so the recap listed an offer the visitor had never
  // been asked about. The levers are asked before they are recapped; the index is
  // reset so the walk starts at the first one whatever a previous pass left behind.
  function continueFromConsent() {
    if (!user) setOfferIndex(0);
    setStep(user ? "pricing" : "offer");
  }

  // ── Post-payment steps ────────────────────────────────────────────
  // Save the optional phone (Clerk user metadata) and advance to the LTR step.
  // An empty number is a valid skip — no write, just advance.
  //
  // A number that cannot be a number does NOT advance: a US customer typed one
  // that was syntactically impossible and it was stored, so the step accepted an
  // answer it could tell was wrong. Refusing here is what makes the reason
  // visible; `/api/onboarding/phone` refuses it again, because a control the UI
  // blocks is still a request anyone can send.
  async function savePhoneAndContinue() {
    if (phoneProblem) {
      setPhoneProblemRevealed(true);
      return;
    }
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
    // STRAIGHT TO THE LAUNCH. The per-funnel rate screens and the best-model
    // screen used to sit here, asking a person who had just paid for conversion
    // rates — the worst moment in the flow to ask anything.
    //
    // The levers are the one exception, on the rule `model` already used: a
    // visitor who answered the six lever screens before creating the account is
    // not asked again, while an existing org adding a brand never saw them, so
    // it still walks them.
    if (leversStatedBeforeAccount) {
      void finalizePostPaymentAndLaunch();
      return;
    }
    setOfferIndex(0);
    setStep("offer");
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
  // The one thing the audience step collects: who the customer sells to, in
  // their own words. Saved on the brand as the `targetAudience` user-field (the
  // same store the brand profile reads), where the person building the
  // audiences after payment finds it. Fail loud on a refusal: a blank field here
  // is a blank brief for that person.
  async function saveTargetAudienceAndContinue() {
    const text = audiencePrompt.trim();
    if (!text) {
      setError("Tell us who you sell to first.");
      return;
    }
    const id = brandIdRef.current;
    if (!id) {
      setError("Your setup is still running. Give it a moment and try again.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveBrandTargetAudience(id, text);
      setStep("consent");
    } catch (err) {
      if (isInsufficientCredit(err)) {
        creditRetryRef.current = () => saveTargetAudienceAndContinue();
        return;
      }
      console.error("[dashboard] saveBrandTargetAudience failed:", err);
      setError("We could not save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveFunnelsAndContinue() {
    // The primary is the first picked funnel (or the one already held). There is
    // no screen asking for it any more: the Path screen already ordered the picks,
    // and asking "which one first?" after it was one question twice. The outcome
    // it buys prices the budget step, so it is written from the DERIVED funnel
    // here rather than from `primaryFunnelKey`, whose setter has not applied yet.
    const primaryKey = resolvePrimaryKey(selectedFunnelKeys, primaryFunnelKey);
    setPrimaryFunnelKey(primaryKey);
    const nextOutcome = outcomeForFunnelGoal(offeredFunnels.find((f) => f.key === primaryKey)?.goal);
    if (nextOutcome) setOutcome(nextOutcome);
    const nextStep: Step = "audiences";
    const id = brandIdRef.current;
    if (!id) {
      // No brand yet (fast click-through): the per-funnel writes after payment
      // declare each picked funnel on their own, so do not block the step.
      setError(null);
      setStep(nextStep);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await stateBrandSalesFunnels(id, selectedFunnelKeys);
      setStep(nextStep);
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
  // Offer-lever step Continue: advance to the next lever, or (on the last one)
  // finalize the launch. Lever edits live in `profile` state and are saved on top of
  // the background launch's as-of-checkout profile by finalizePostPaymentAndLaunch.
  function continueOffer() {
    if (offerIndex < POST_PAYMENT_OFFER_LEVERS.length - 1) {
      setOfferIndex((i) => i + 1);
      return;
    }
    // SIGNED OUT, the offer is the last thing we BUILD. Everything after it is
    // the account and the card, so the next screen states what we assembled and
    // the launch happens once there is money behind it. Signed in — an existing
    // org adding a brand, or a session that has already paid — this is still the
    // terminal step it has always been.
    if (!user) {
      // Stated here so the post-payment walk (`model` -> `offer` -> launch) knows
      // these six screens are already answered and does not ask them again after
      // the card. It travels on the snapshot AND on the pending blob, because the
      // post-payment steps run on a fresh page load.
      setLeversStatedBeforeAccount(true);
      setStep("built");
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
      // Land on the DEEPEST scope with no choice left in it, the same place signing in
      // lands — and name it outright rather than handing the walk a bare brand URL: the
      // launch just created this campaign, so it holds the offer and the funnel already,
      // and the walk's own reads would be cold here (see `lib/launch-destination.ts`).
      router.push(
        launchDestinationHref({
          orgId: String(orgId),
          brandId: String(id),
          offerId: result.offerId,
          funnelKey: result.funnelKey,
        }),
      );
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
      const recommended = budgetForCount(RECOMMENDED_OUTCOME_COUNT);
      // Nothing to seed with: neither a priced projection nor a published floor.
      // An empty field is honest; a figure nobody computed is not.
      if (recommended === null && launchFloorUsd === null) return prev;
      const seed = recommended ?? launchFloorUsd ?? 0;
      const floored = launchFloorUsd === null ? seed : Math.max(launchFloorUsd, seed);
      return { ...prev, [primaryFunnelKey]: String(floored) };
    });
    // `budgetForCount` reads the live projection and the floor lands a moment
    // after mount; re-running as either warms is the point, and the untouched-set
    // guard makes the repeat a no-op.
  }, [step, primaryFunnelKey, pricingHydrationVersion, launchFloorUsd]);

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
      // so the floor applies in full. The grandfather in `channelBudgetBelowMinimum`
      // exists for brands billing already funds under it, which nobody here is.
      channelBudgetBelowMinimum(launchFloorCents, funnelBudgetUsd(f.key), 0),
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
  // Re-run the service extraction from the services step. The loading screen
  // already tried the landing page and then the whole site, so the retry walks
  // the whole site again (the wider of the two) — the point is that a failure is
  // recoverable in place instead of leaving the step permanently empty with
  // nothing to press.
  async function retryServicesExtract() {
    const id = brandIdRef.current;
    if (!id || servicesRetrying) return;
    setServicesRetrying(true);
    const startedAt = performance.now();
    try {
      const fields = await extractBrandFields([id], SERVICES_PROFILE_FIELDS, {
        urlStrategy: noWebsiteMode ? undefined : "url_map",
        mode: "suggest",
      });
      const next = normalizeServices(fields.fields.services?.value);
      captureSetupMilestone(next.length > 0 ? "services_extracted" : "services_extract_failed", startedAt);
      setServicesExtractFailed(next.length === 0);
      applyExtractedServices(next);
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
  if (step === "welcome" || step === "outcome" || step === "path" || step === "returns") {
    return (
      <StartPicks
        screen={step}
        catalogue={startCatalogue}
        catalogueError={startCatalogueError}
        outcomes={startOutcomes}
        funnels={startFunnels}
        onOutcomesChange={setStartOutcomes}
        onFunnelsChange={setStartFunnels}
        onScreenChange={(next: StartScreen) => setStep(next)}
        onContinue={continueAfterPicks}
        brandHost={domain}
      />
    );
  }

  if (step === "url") {
    const urlFooter = noWebsiteMode ? (
      <button onClick={startAnalyzeNoWebsite} disabled={!brandName.trim() || !brandContext.trim()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
        Build my strategy <ArrowRightIcon className="h-4 w-4" />
      </button>
    ) : (
      <button onClick={startAnalyze} disabled={!domain || websiteProblem !== null} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
        Analyze my product <ArrowRightIcon className="h-4 w-4" />
      </button>
    );
    return (
      <StepShell chrome={chrome}
        maxWidth="sm:max-w-md"
        footer={urlFooter}
      >
        {/* Every step can go back. This one returns to the Results screen, the
            last of the sell-first picks, which every entry into the wizard now
            walks through before asking for the website. */}
        <BackButton onClick={() => setStep("returns")} />
        {noWebsiteMode ? (
          <>
            <h2 className="font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">Tell us about your business</h2>
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
            <h2 className="font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">What are we promoting?</h2>
            <p className="mt-2 mb-6 text-gray-500">We read your product, find the leads, and run the outreach. Just drop the URL.</p>
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-url-refusal>
                <p>{error}</p>
                {refusal && (
                  <p className="mt-2">
                    {refusal.signIn ? (
                      <>
                        {refusal.signIn.lead}{" "}
                        <a href={refusal.signIn.href} className="font-medium underline transition hover:text-red-800">
                          {refusal.signIn.label}
                        </a>
                        {" "}to pick it up. Otherwise change the website above, or{" "}
                      </>
                    ) : (
                      <>Change the website above, or </>
                    )}
                    <a href={refusal.signUp.href} className="font-medium underline transition hover:text-red-800">
                      {refusal.signUp.label}
                    </a>
                    {" "}and we start right after.
                  </p>
                )}
              </div>
            )}
            <input
              type="url" value={url} onChange={(e) => { setUrl(e.target.value); if (refusal) { setRefusal(null); setError(null); } }} placeholder="e.g. https://acme.com/pricing" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && domain && !websiteProblem) startAnalyze(); }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {websiteRefusal ? (
              <p className="mt-2 text-sm text-red-500">
                {websiteRefusal}{" "}
                <button type="button" onClick={enterNoWebsiteMode} className="font-medium underline transition hover:text-red-600">
                  No website? Tell us about your business instead.
                </button>
              </p>
            ) : (
              <button type="button" onClick={enterNoWebsiteMode} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 transition hover:text-brand-700">
                I have no website
              </button>
            )}
          </>
        )}
      </StepShell>
    );
  }

  if (step === "loading") {
    const loadingComplete = fetchDoneRef.current || loadStep >= LOADING_STEPS.length;
    return (
      <StepShell chrome={chrome}
        maxWidth="sm:max-w-md"
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
    // Nothing to show: the loading screen's read is over and it produced nothing.
    // Say that, and give the reader a way to ask again. There is no waiting state
    // here — nothing that could still deliver a list is running once this step
    // renders.
    const servicesUnread = !servicesDrafted && servicesExtractFailed;
    // One string, two paths: the button writes it and Ctrl+C rewrites to it.
    const servicesPrompt = buildServicesLLMPrompt(
      [...services, serviceDraft.trim()].filter(Boolean),
      hostname || domain || "my business",
    );
    return (
      <StepShell chrome={chrome}
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} onEdit={() => setStep("url")} />}
        footer={<NextButton onClick={() => { addService(serviceDraft); if (selectedFunnelKeys.length === 0) setStep("path"); else void saveFunnelsAndContinue(); }} disabled={services.length === 0 && serviceDraft.trim() === ""} />}
        copyText={servicesPrompt}
      >
        <BackButton onClick={() => setStep("url")} />
        {/* Same placement as the offer levers': the button acts on the QUESTION,
            not on what has been typed, so it reads as another way to answer rather
            than as a step after the fact. The typed-but-unadded chip rides along
            because it is on screen, so what is copied is what the reader sees. */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">What services do you want to promote with us?</h2>
          <div className="shrink-0">
            <CopyForLLMButton text={servicesPrompt} />
          </div>
        </div>
        {/* The "we drafted these" line is a claim about a successful extraction. With
            nothing extracted it described an empty box, which reads as "your site
            sells nothing" — so it is gated on there being a draft to talk about. */}
        {/* NAME THE SOURCE WE ACTUALLY READ. `hostname` is empty on the no-website
            path — there is no site — so interpolating it printed "We drafted
            these from ." with a bare full stop where the source should be, on
            the one step whose whole job is to say where the list came from.
            What we read there is what the visitor pasted, so that is what it
            says. Observed on a prod walk of the no-website path. */}
        {servicesDrafted ? (
          hostname ? (
            <p className="mt-2 mb-6 text-gray-500">We drafted these from <span className="font-medium text-gray-700">{hostname}</span>. Add or remove until the list matches what you sell.</p>
          ) : (
            <p className="mt-2 mb-6 text-gray-500">We drafted these from what you told us. Add or remove until the list matches what you sell.</p>
          )
        ) : (
          <p className="mt-2 mb-6 text-gray-500">Tell us what you sell. Add one per line.</p>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-3 sm:p-4">
          {/* The chips ARE this step's answer, so they light up with the selection
              like a field would. `data-copy-value` is what the highlight targets:
              a chip is a <span>, not a form control. */}
          {services.map((s, i) => (
            <span key={s} data-copy-value className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${TAG_TONES[i % TAG_TONES.length]}`}>
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
        {/* A settled empty read is a verdict, stated as one. The read itself
            happened on the loading screen, so a spinner here would be a lie. */}
        {servicesUnread ? (
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
        chrome={chrome}
        brandId={brandId}
        brandDomain={headerDomain}
        brandName={headerName}
        hostname={headerHostname}
        services={services}
        prefetch={audiencePrefetch}
        prompt={audiencePrompt}
        onPromptChange={setAudiencePrompt}
        busy={busy}
        error={error}
        onBack={() => setStep("services")}
        onContinue={() => void saveTargetAudienceAndContinue()}
        onEdit={() => setStep("url")}
      />
    );
  }

  // The funnel step and the primary pick no longer render: the sell-first Path
  // screen is where the set is stated. A resume can still point here (a snapshot
  // or an in-flight checkout blob written before they went), so land on the
  // picks — the same fail-safe shape as the retired-step branch above.
  if (step === "funnels" || step === "primary") {
    setStep(legacyStepFor(step));
    return null;
  }

  if (step === "consent") {
    return (
      <StepShell chrome={chrome}
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} onEdit={() => setStep("url")} />}
        footer={<NextButton onClick={continueFromConsent} label="Continue" />}
      >
          <BackButton onClick={() => setStep("audiences")} />
          <div className="mb-4 flex items-start gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-brand-600" />
            <h2 className="font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">We reach out on your behalf.</h2>
          </div>
          <p className="mb-4 text-sm leading-6 text-gray-500">distribute.you is a marketing agency. All outreach goes out from inboxes and domains <strong>we own and warm</strong>, never from yours, like a PR firm pitching from its own contacts.</p>
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
      <StepShell chrome={chrome}
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
      <StepShell chrome={chrome}
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} />}
        footer={
          <NextButton
            onClick={savePhoneAndContinue}
            disabled={phoneProblemRevealed && phoneProblem !== null}
            busy={busy}
            label="Continue"
          />
        }
      >
        <BackButton onClick={() => setStep("celebrate")} />
        <div className="mb-4 flex items-start gap-2">
          <PaperAirplaneIcon className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">Your phone number.</h2>
        </div>
        <p className="mb-6 text-sm leading-6 text-gray-500">Optional. We only use it to reach you quickly about your own campaign, never for outreach. Add it or skip it.</p>
        <PhoneInput
          value={phone}
          onChange={(v) => {
            // Hide the message the moment they start correcting it. It comes
            // back on the next blur if the number is still impossible.
            setPhoneProblemRevealed(false);
            setPhone(v);
          }}
          onBlur={() => setPhoneProblemRevealed(true)}
          problem={phoneProblemRevealed ? phoneProblem : null}
          autoFocus
        />
        <button
          onClick={() => {
            // Same destination as Continue — skipping the number must not skip
            // the launch it precedes.
            if (leversStatedBeforeAccount) {
              void finalizePostPaymentAndLaunch();
              return;
            }
            setOfferIndex(0);
            setStep("offer");
          }}
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
    // One string, two paths: the button writes it and Ctrl+C rewrites to it.
    const leverPrompt = buildLeverLLMPrompt(lever, current, hostname || domain || "my business");
    return (
      <StepShell chrome={chrome}
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} />}
        footer={
          <NextButton
            onClick={continueOffer}
            busy={busy}
            // Signed out, nothing launches here: the recap and the account come
            // next, so the button says what actually happens. Signed in, this IS
            // the terminal step it has always been.
            label={isLast ? (user ? "Launch my campaign" : "See what we built") : "Continue"}
          />
        }
        copyText={leverPrompt}
      >
        {/* Two entrances, two exits. Post-payment the levers follow the phone
            step; before the account they follow `consent`. `model` used to sit
            between the phone and here and is gone. */}
        <BackButton onClick={() => (offerIndex > 0 ? setOfferIndex((i) => i - 1) : setStep(user ? "phone" : "consent"))} />
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
          Your offer · {offerIndex + 1} of {POST_PAYMENT_OFFER_LEVERS.length}
        </div>
        {/* The copy-for-LLM button sits on the title row rather than under the
            textarea: it acts on the QUESTION, not on what has been typed, so it
            reads as an alternative way to answer instead of a step after the fact. */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">{lever.title}</h2>
            {/* Only the confirmed state is badged. A prefilled lever is obviously
                a draft, so labelling it adds nothing. */}
            {fieldProvenance[lever.key] === "confirmed" && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                Confirmed
              </span>
            )}
          </div>
          <div className="shrink-0">
            <CopyForLLMButton text={leverPrompt} />
          </div>
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
        <p className="mt-3 text-xs text-gray-400">We prefilled this from your website. Edit it or keep it, then continue.</p>
      </StepShell>
    );
  }

  // WHAT WE BUILT FOR YOU — the last screen before anyone is asked for an
  // account, and the reason the wall moved here at all. Everything on it was
  // assembled in the last ten minutes against an org the visitor has no account
  // for; the button below is the first time we ask for one.
  //
  // The MODEL decides what is on it (`built-summary.ts`, real unit tests): a
  // section with nothing in it is dropped rather than rendered empty, because
  // this is the evidence somebody decides to pay us on.
  if (step === "built") {
    const summaryInput = {
      services,
      funnels: selectedFunnelKeys.map((key) => {
        const def = SALES_FUNNELS.find((f) => f.key === normalizeSalesFunnelKey(key as never));
        return {
          key,
          name: def?.name ?? "",
          steps: def?.steps ?? [],
          isPrimary: key === primaryFunnelKey,
        };
      }),
      // The customer's own words for who they sell to. Not an audience list: the
      // audiences are built by hand after payment, from exactly this text.
      targetAudience: audiencePrompt,
      levers: POST_PAYMENT_OFFER_LEVERS.map((l) => ({
        key: l.key,
        // The lever's own step title, so it reads here exactly as it did on the
        // screen that asked for it.
        label: l.title,
        value: isListLever(l.key)
          ? formatListLeverValue(profile[l.key])
          : coerceTextField(profile[l.key]),
      })),
    };
    // Resolved HERE and handed over, because the catalogue's own lookup throws
    // on a key it does not carry and a throw on this screen loses the summary.
    const funnelMarks: Record<string, ReactNode> = {};
    for (const f of summaryInput.funnels) {
      const def = SALES_FUNNELS.find((d) => d.key === normalizeSalesFunnelKey(f.key as never));
      if (def) funnelMarks[f.key] = <SalesFunnelMark def={def} size="sm" />;
    }

    return (
      <StepShell chrome={chrome}
        header={<BrandStepHeader domain={headerDomain} hostname={headerHostname} name={headerName} />}
        footer={
          <NextButton
            onClick={() => {
              // SIGNED IN there is nothing to create, and sending them to
              // `/sign-up` anyway is a closed loop rather than a no-op: the proxy
              // bounces an authenticated user off every auth page to `/orgs`, the
              // first-run gate bounces that to `/onboarding?brandId=`, and the
              // snapshot restores this very screen. Three redirects and the same
              // page, so the only control on it reads as dead.
              //
              // They reach this screen at all because the snapshot is
              // sessionStorage: a tab left open across a signup comes back here
              // with a session attached. The money is what is left to answer, and
              // it is where `continueFromConsent` already sends a signed-in
              // visitor.
              if (user) {
                setStep("pricing");
                return;
              }
              // The account is the next thing, and the claim is what happens on
              // the way back: `/onboarding/claim` re-points the org they have
              // been building at the Clerk org they are about to create.
              window.location.href = "/sign-up";
            }}
            label={user ? "Continue" : "Create my account"}
          />
        }
      >
        {/* Back to the levers this screen recaps — at the LAST one, which is the
            screen it was reached from. */}
        <BackButton
          onClick={() => {
            setOfferIndex(POST_PAYMENT_OFFER_LEVERS.length - 1);
            setStep("offer");
          }}
        />
        <h2 className="font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">
          Here&apos;s what we built for you.
        </h2>
        <p className="mt-2 mb-5 text-gray-500">
          Create your account to launch it. Nothing goes out until you do.
        </p>
        <BuiltSummaryPanel input={summaryInput} funnelMarks={funnelMarks} />
      </StepShell>
    );
  }

  if (step === "launching") {
    const brand = launchingBrand ?? { domain, hostname };
    return (
      <StepShell chrome={chrome} header={<BrandStepHeader domain={brand.domain} hostname={brand.hostname} />}>
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
    // What the buyer actually pays here: their budget minus the welcome gift. The
    // CTA has to state THAT, not the budget — a button reading "$50" that charges
    // $20 is a worse surprise than one reading "$20", in both directions.
    const firstChargePlan = planFirstCharge(amount);
    const chargeUsd = amount == null ? null : firstChargePlan.chargeCents / 100;
    const giftCoversBudget = amount != null && !firstChargePlan.charges;
    return (
      <StepShell chrome={chrome}
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
                {giftCoversBudget
                  ? "Continue. No payment today"
                  : chargeUsd != null
                    ? `Continue to checkout (${fmtUsd0(chargeUsd)})`
                    : "Continue to checkout"} <ArrowRightIcon className="h-4 w-4" />
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
            <h2 className="font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">{welcomeHeadline(referredSignup)}</h2>
            {/* The gift is GIVEN, not earned: $30 lands when the account is created,
                with no payments threshold and no second instalment. It used to be a
                match ($5 up front, the rest once payments reached $400), which is why
                this screen once explained a threshold — there is none left to explain.

                What the buyer pays here is their daily budget MINUS that $30, so the
                gift reaches them as cash off the first checkout rather than as a second
                grant on top of it. Below $30 there is nothing to charge and the session
                only takes a card imprint. Either way the gift is exactly $30, which is
                the invariant planFirstCharge exists to hold.

                The entitlement is FROZEN on the billing account when it is created, so
                an org that signed up under an older offer keeps $400/$400 or $25/$25
                forever and this screen (new orgs only) is the $30 cohort.
                Guard: welcome-credits-promise.test.ts. */}
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
  // `onePath` is derived once at the top of the flow: a brand that picked ONE path
  // reads every "each path" sentence as being about something it does not have, and
  // two of them contradicted this screen's own button (Continue is gated on at least
  // one funded path, so inviting the user to leave the only path at 0 promises a step
  // it then refuses). The plural copy is byte-identical for a real multi-path pick.
  return (
    <StepShell chrome={chrome}
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
      <h2 className="font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">
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
          const under = channelBudgetBelowMinimum(launchFloorCents, usd, 0);
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
                  <FunnelStepRow steps={f.steps} tone={f.tone} />
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
                {under && launchFloorCents !== null ? (
                  <span className="text-red-600">
                    This path starts at {fmtDailyFloorUsd(launchFloorCents)} a day.
                    {!onePath && " Leave it at 0 to skip it for now."}
                  </span>
                ) : count != null ? (
                  <>
                    <span className="text-gray-500">{fmtCount(count)} {outcomeMeta.unit} / mo</span>
                    <InfoTooltip tip={ESTIMATE_TOOLTIP} placement="top" />
                  </>
                ) : launchFloorCents !== null ? (
                  <span className="text-gray-400">
                    {onePath ? "From" : "Not funded. From"} {fmtDailyFloorUsd(launchFloorCents)} a
                    day.
                  </span>
                ) : (
                  !onePath && <span className="text-gray-400">Not funded.</span>
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

// The target audience, in the customer's own words. Nothing is searched or
// created: the text is saved on the brand (`targetAudience`) and the audiences
// are built by hand after payment. The audience suggest + pick that stood here
// was a ~35 s billed run whose result nobody read before paying.
function OnboardingAudiences({
  chrome,
  brandId,
  brandDomain,
  brandName,
  hostname,
  services,
  prefetch,
  prompt,
  onPromptChange,
  busy,
  error,
  onBack,
  onContinue,
  onEdit,
}: {
  chrome: StepChrome;
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
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
  onEdit?: () => void;
}) {
  // One string, two paths: the button writes it and Ctrl+C rewrites to it.
  const audienceLlmPrompt = buildAudienceLLMPrompt(prompt, services, hostname || brandDomain || "my business");
  // ONE box. The customer says who they sell to and nothing is searched: the
  // audiences are built by hand after payment, from this text. The old step ran
  // an audience suggest (LLM + a people search, ~35 s, billed) and asked the
  // customer to pick cards; it is gone with the picks and the activation.
  const [icpLoading, setIcpLoading] = useState(true);
  // True when the box is EMPTY because brand-service could not draft an ICP, so
  // the step says so instead of presenting a blank as a prompt to fill.
  const [icpFallback, setIcpFallback] = useState(false);
  const icpFetchedRef = useRef(false);
  // Mirror of the prompt for the seed below, which runs inside a promise callback
  // created at MOUNT: reading `prompt` there reads the mount render, so the
  // "never clobber an edited prompt" guard would test a stale empty string.
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Seed the box from the parent's pre-warm (the ICP drafted during the loading
  // screen) when present; without one, draft it here. Runs once; never clobbers
  // a prompt the user already edited.
  useEffect(() => {
    if (icpFetchedRef.current) return;
    icpFetchedRef.current = true;
    if (prompt.trim()) {
      setIcpLoading(false);
      return;
    }
    const adopt = (drafted: string, failed: boolean) => {
      if (!promptRef.current.trim() && drafted) onPromptChange(drafted);
      if (failed) setIcpFallback(true);
    };
    if (prefetch) {
      setIcpLoading(true);
      prefetch.promise
        .then(({ prompt: p, icpFailed }) => adopt(p, icpFailed))
        .catch((e) => {
          console.error("[dashboard] audience prefetch adopt failed:", e);
          setIcpFallback(true);
        })
        .finally(() => setIcpLoading(false));
      return;
    }
    if (!brandId) {
      setIcpFallback(true);
      setIcpLoading(false);
      return;
    }
    (async () => {
      try {
        const { icp } = await suggestBrandIcp(brandId);
        adopt(icp.trim(), !icp.trim());
      } catch (e) {
        console.error("[dashboard] suggestBrandIcp (onboarding prefill) failed:", e);
        setIcpFallback(true);
      } finally {
        setIcpLoading(false);
      }
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

  return (
    <StepShell chrome={chrome}
      maxWidth="sm:max-w-xl"
      header={<BrandStepHeader domain={brandDomain} hostname={hostname} name={brandName} onEdit={onEdit} />}
      footer={<NextButton onClick={onContinue} disabled={icpLoading || busy || !prompt.trim()} busy={busy} label="Continue" />}
      copyText={audienceLlmPrompt}
    >
      <div>
        <BackButton onClick={onBack} />
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 font-display text-3xl leading-none tracking-[-0.03em] text-gray-900 sm:text-4xl">Who do you sell to?</h2>
          <div className="shrink-0">
            <CopyForLLMButton text={audienceLlmPrompt} />
          </div>
        </div>
        <p className="mt-2 text-gray-500">
          Describe your ideal customers in plain words. We build your audiences from this once you are set up.
        </p>

        <div className="relative mt-5">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            disabled={icpLoading}
            placeholder="e.g. Heads of marketing at Series A to B B2B SaaS companies in the US, 50 to 500 employees."
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
        {/* An empty box because brand-service could not draft an ICP looks like a
            box nobody has drafted yet, so the reader is told which they are holding. */}
        {icpFallback && !icpLoading && !prompt.trim() && (
          <p className="mt-2 text-xs text-gray-500">
            We couldn&apos;t read enough from <span className="font-medium text-gray-700">{hostname}</span> to draft this. Tell us in your own words.
          </p>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
        )}
      </div>
    </StepShell>
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

type StepChrome = { step: Step; founders: number | null; brandHost: string | null };

/**
 * Where a wizard step sits on the ONE stepper the flow wears from the landing
 * to the dashboard. The three sell-first screens are steps 1-3 (they draw
 * their own shell); the build half is step 4; the summary and the money are
 * step 5. The post-payment screens run after the account exists and the bar
 * would state a position in a sequence that is over, so they draw none.
 */
function stepperFor(step: Step): { step: number; count: number } {
  switch (step) {
    case "url":
    case "loading":
    case "services":
    case "destination":
    case "objective":
    case "rates":
    case "audiences":
      return { step: 4, count: START_STEP_COUNT };
    case "built":
    case "consent":
    case "pricing":
    case "bonus":
      return { step: 5, count: START_STEP_COUNT };
    default:
      return { step: 1, count: 1 };
  }
}

/**
 * ONE SHELL FOR THE WHOLE FLOW. Every wizard step renders through `StartShell`,
 * the same pill bar, stepper, glow and trust strip the sell-first screens wear,
 * so the pitch, the questions and the build read as one product. It used to be
 * its own card (a different width, no stepper, no bar) and the join between the
 * two read as a second product with a reload between them.
 */
function StepShell({
  chrome,
  header,
  footer,
  maxWidth = "sm:max-w-xl",
  copyText,
  children,
}: {
  chrome: StepChrome;
  header?: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
  /** Present on a step that asks for a written answer: Ctrl+C anywhere in the
   *  body then yields the whole question-and-answer prompt instead of whatever
   *  fragment of prose the selection could reach. Absent everywhere else, so a
   *  step with nothing to copy behaves exactly as it always has. */
  copyText?: string;
  children: ReactNode;
}) {
  // The first-run account widget rides the step's OWN header row on mobile
  // (beside the Brand card) instead of a dedicated bar above it — see the note in
  // `onboarding-top-chrome.tsx`. When the escape chrome is showing (`?from=add`,
  // `?new=1`, staff, an already-onboarded org) it already renders a widget in its
  // sticky header, so this one stays off: two widgets on one screen is the same
  // surface answering twice.
  const escapeChrome = useOnboardingEscapeChrome();
  const showWidget = !escapeChrome;
  const stepCopy = useStepCopy(copyText);
  const pos = stepperFor(chrome.step);
  return (
    <StartShell
      step={pos.step}
      stepCount={pos.count}
      stepLabels={START_STEP_LABELS}
      founders={chrome.founders}
      brand={chrome.brandHost ? { url: `https://${chrome.brandHost}`, host: chrome.brandHost } : null}
      cardMaxWidth={maxWidth}
      showEyebrow={!header}
      scrollKey={chrome.step}
      footer={footer}
    >
      {(header || showWidget) && (
        // One row: the header takes the width, the widget sits at its right edge.
        // With no header the row is the widget alone, `sm:hidden` so the desktop
        // card never opens a gap for an empty row.
        <div className={`mb-4 flex shrink-0 items-center gap-2 ${header ? "" : "justify-end sm:hidden"}`}>
          {header && <div className="min-w-0 flex-1">{header}</div>}
          {showWidget && (
            <div className="shrink-0 sm:hidden">
              <OnboardingAccountWidget />
            </div>
          )}
        </div>
      )}
      <div {...stepCopy}>{children}</div>
    </StartShell>
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
      {copied ? "Copied!" : "Copy content for LLM"}
    </button>
  );
}

// Ctrl+C on a step hands over the SAME text the button does, AND the step SHOWS
// that it will before the reader presses anything.
//
// A drag-selection stops at the edge of an `<input>`/`<textarea>`, because a form
// field is its own editing context. The `copy` EVENT has no such limit, so the
// clipboard can carry the question and the field together. That alone is a
// surface that LIES: the reader sees the question highlighted, presses Ctrl+C,
// and silently gets more than was on screen. A copy that hands over more than it
// showed is worse than one that hands over too little, because nothing tells the
// reader it happened.
//
// So the highlight and the clipboard are driven by ONE predicate. While a
// selection would be rewritten, the step's fields render in the selection colour
// (`data-copy-included`, styled in `globals.css` off the same `::selection`
// ramp), so what is lit is exactly what Ctrl+C delivers. They cannot disagree,
// because a disagreement would require two predicates and there is one.
//
// ⚠️ Measured alternatives, so nobody re-derives them: `setSelectionRange` on an
// UNFOCUSED textarea paints nothing at all (zero pixels change), and focusing it
// to make it paint would collapse the page selection it is meant to extend. A
// read-only `<div>` value DOES take a real native selection, and is the honest
// shape if a field is ever rewritten as click-to-edit; it was not taken here
// because it means recabling every editable control on four steps.
function useStepCopy(text: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const [included, setIncluded] = useState(false);

  useEffect(() => {
    if (!text) {
      setIncluded(false);
      return;
    }
    const onSelectionChange = () => {
      const el = ref.current;
      const selection = window.getSelection();
      if (!el || !selection || selection.rangeCount === 0) {
        setIncluded(false);
        return;
      }
      // `selectionchange` is a DOCUMENT event, so a selection anywhere else on the
      // page fires it too. Without this the fields would light up for a selection
      // that has nothing to do with this step.
      const range = selection.getRangeAt(0);
      if (!range.intersectsNode(el)) {
        setIncluded(false);
        return;
      }
      const active = document.activeElement;
      const isField =
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      setIncluded(
        copyStepIntent({
          activeElementIsField: isField && el.contains(active),
          fieldSelectionIsRange: isField && active.selectionStart !== active.selectionEnd,
          selectionText: selection.toString(),
        }) === "rewrite",
      );
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [text]);

  const onCopy = (e: React.ClipboardEvent<HTMLElement>) => {
    if (!text) return;
    const active = document.activeElement;
    const isField =
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
    const intent = copyStepIntent({
      activeElementIsField: isField && e.currentTarget.contains(active),
      fieldSelectionIsRange: isField && active.selectionStart !== active.selectionEnd,
      selectionText: window.getSelection()?.toString() ?? "",
    });
    if (intent === "passthrough") return;
    e.clipboardData.setData("text/plain", text);
    e.preventDefault();
  };

  return {
    ref,
    // Absent rather than `false`, so the attribute is simply not in the DOM when
    // the step is not part of a selection.
    "data-copy-included": included || undefined,
    onCopy: text ? onCopy : undefined,
  };
}

// A copyable block that is not a whole step: same hook, same predicate, same
// highlight. The `model` step needs this because its BODY also carries the
// projection numbers, and a reader copying one of those means that number, not
// the prompt.
function CopyableBlock({
  text,
  className,
  children,
}: {
  text: string;
  className?: string;
  children: ReactNode;
}) {
  const stepCopy = useStepCopy(text);
  return (
    <div className={className} {...stepCopy}>
      {children}
    </div>
  );
}

function NextButton({ onClick, disabled = false, busy = false, label = "Continue" }: { onClick: () => void; disabled?: boolean; busy?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={disabled || busy} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…</> : <>{label} <ArrowRightIcon className="h-4 w-4" /></>}
    </button>
  );
}

// The funnel's steps, rendered under its title. Discreet on purpose: the name is
// what identifies the path, the steps are the reminder of what it means.
function FunnelStepRow({ steps, tone }: { steps: string[]; tone: { iconBg: string; iconText: string } }) {
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
// cover both text rows, the funnel's NAME as the heading, and its steps under it
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
        <FunnelStepRow steps={funnel.steps} tone={funnel.tone} />
      </span>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${radio ? "rounded-full" : "rounded-md"} ${selected ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"}`}
      >
        {selected && <CheckIcon className="h-3 w-3" />}
      </span>
    </button>
  );
}
