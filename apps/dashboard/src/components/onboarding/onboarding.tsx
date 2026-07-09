"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useOrganization,
  useOrganizationList,
  useSession,
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
  TrophyIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import posthog from "posthog-js";
import {
  upsertBrand,
  extractBrandFields,
  SALES_PROFILE_FIELDS,
  getBrandProfile,
  saveBrandProfileVersion,
  getSalesEconomicsEffective,
  saveBrandClickDestination,
  saveBrandSalesEconomics,
  suggestAudiences,
  setAudienceStatus,
  listAudiences,
  suggestBrandIcp,
  type AudienceCandidate,
  getWorkflowProjection,
  getFeature,
  prefillFeatureInputs,
  prefillToStringMap,
  configureAutoTopup,
  createCheckoutSession,
  createCampaignWithoutBrandEnrichment,
  saveBrandDailyBudget,
  salesObjectiveForOptimizationGoal,
  type BrandOptimizationGoal,
  type EffectiveSalesEconomics,
  type WorkflowProjectionResponse,
  type FeatureInput,
  isInsufficientCredit,
} from "@/lib/api";
import {
  selectWorkflowForOptimizationGoal,
  workflowProjectionMatchesOutcomeRates,
  workflowOutcomeUnitCost,
} from "@/lib/workflow-projection-choice";
import { extractDomain, subpageDestinationFromUrl } from "@/lib/extract-domain";
import { displaySetupError } from "@/lib/onboarding-setup-error";
import { BrandLogo } from "@/components/brand-logo";
import { audienceFilterGroups } from "@/lib/audience-filter-groups";
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
const ONBOARDING_STATE_VERSION = 3;
const AUTO_TOPUP_THRESHOLD_CENTS = 500;
// Shown on the pricing step when a user returns from Stripe checkout without paying.
// Reassuring, not an error: the brand/budget setup is intact and they finish from here.
const CHECKOUT_CANCELLED_NOTICE = "Your setup is saved. Finish checkout below to launch your campaign.";
const PRICING_REFRESH_RETRIES = 3;
const PRICING_REFRESH_RETRY_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Step =
  | "welcome"
  | "url"
  | "loading"
  | "services"
  | "destination"
  | "objective"
  | "rates"
  | "audiences"
  | "consent"
  | "pricing"
  | "bonus"
  | "launching";

// The two sales goals (Kevin): Signups or Sales Meetings. Each maps to a
// projection count so the budget cards show the chosen unit, never "closes".
type Outcome = "signups" | "meetings";
const OUTCOMES: { key: Outcome; label: string; unit: string; desc: string }[] = [
  { key: "signups", label: "Signups", unit: "signups", desc: "Maximize free signups / trial starts." },
  { key: "meetings", label: "Sales meetings", unit: "meetings", desc: "Maximize booked sales meetings." },
];

function optimizationGoalForOutcome(outcome: Outcome): BrandOptimizationGoal {
  return outcome === "signups" ? "signups" : "sales_meetings";
}

// Each goal needs exactly ONE conversion rate. Signups → website-visit→signup;
// meetings → positive-reply→meeting.
type RateKey = "ltv" | "v2s" | "s2c" | "v2m" | "r2m" | "m2c";
const RATE_META: Record<RateKey, { label: string; suffix: "$" | "%"; hint: string }> = {
  ltv: { label: "Lifetime revenue / paid client", suffix: "$", hint: "Average revenue a customer brings over their lifetime." },
  v2s: { label: "Website visits to signup rate", suffix: "%", hint: "Of visitors who land on your site, how many sign up." },
  s2c: { label: "Signup → paid client", suffix: "%", hint: "Of signups, how many become paying customers." },
  v2m: { label: "Website visit → sales meeting", suffix: "%", hint: "Only set this above 0 if prospects can book a meeting directly from your website. If every meeting needs a reply first, use 0%." },
  r2m: { label: "Positive reply → sales meeting", suffix: "%", hint: "Of prospects who reply with real buying interest, the share that become a booked meeting after your follow-up or calendar link." },
  m2c: { label: "Meeting booked → close won", suffix: "%", hint: "Of booked meetings, how many close." },
};
// The rate fields each goal asks for.
const RATE_KEYS_FOR_OUTCOME: Record<Outcome, RateKey[]> = { signups: ["v2s"], meetings: ["r2m", "v2m"] };

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

// Outcome-count budget tiers (per month). "Other" is a custom count.
const COUNT_TIERS = [5, 25, 125];


const fmtUsd0 = (n: number) => "$" + formatLocaleInteger(n);
const fmtCount = (n: number) => formatLocaleInteger(n);

// A background pre-warm of the audience step, started during the loading screen.
// Resolves the drafted ICP prompt and the suggested candidates (candidates null
// when the ICP was empty or the suggest call failed — the step then falls back to
// manual). One promise so the step can show a single "generating" state until ready.
type AudiencePrefetch = {
  promise: Promise<{ prompt: string; candidates: AudienceCandidate[] | null }>;
};

type PendingCheckoutLaunch = {
  version: 1;
  brandId: string;
  orgId: string;
  brandUrl: string;
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
  outcome: Outcome;
  rates: Record<RateKey, number>;
  rateText: Record<RateKey, string>;
  services: string[];
  // User-chosen page outreach clicks land on. "" = the brand domain default.
  clickDestinationUrl: string;
  profile: Record<string, string | string[]>;
  selectedCount: number | null;
  customCount: string;
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

function readPendingCheckoutLaunch(): PendingCheckoutLaunch {
  const raw = window.sessionStorage.getItem(CHECKOUT_PENDING_KEY);
  if (!raw) {
    throw new Error("Checkout returned, but the pending launch state is missing. Campaign was not launched.");
  }
  const parsed = JSON.parse(raw) as Partial<PendingCheckoutLaunch>;
  const onboardingState = parseOnboardingState(parsed.onboardingState);
  if (
    parsed.version !== 1 ||
    typeof parsed.brandId !== "string" ||
    typeof parsed.orgId !== "string" ||
    typeof parsed.brandUrl !== "string" ||
    typeof parsed.hostname !== "string" ||
    (parsed.outcome !== "signups" && parsed.outcome !== "meetings") ||
    typeof parsed.budgetUsd !== "number" ||
    typeof parsed.workflowSlug !== "string" ||
    typeof parsed.checkoutAmountCents !== "number" ||
    typeof parsed.topupAmountCents !== "number" ||
    typeof parsed.topupThresholdCents !== "number" ||
    (parsed.featureInputs !== undefined && !isStringRecord(parsed.featureInputs)) ||
    (parsed.profile !== undefined && !isProfileRecord(parsed.profile)) ||
    (parsed.services !== undefined && !isStringList(parsed.services)) ||
    !onboardingState ||
    typeof parsed.createdAt !== "string"
  ) {
    throw new Error("Checkout returned with an invalid pending launch state. Campaign was not launched.");
  }
  return { ...parsed, onboardingState } as PendingCheckoutLaunch;
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

function isRateRecord(value: unknown): value is Record<RateKey, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys: RateKey[] = ["ltv", "v2s", "s2c", "v2m", "r2m", "m2c"];
  return keys.every((k) => typeof (value as Record<string, unknown>)[k] === "number");
}
function isRateTextRecord(value: unknown): value is Record<RateKey, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys: RateKey[] = ["ltv", "v2s", "s2c", "v2m", "r2m", "m2c"];
  return keys.every((k) => typeof (value as Record<string, unknown>)[k] === "string");
}
const ALL_STEPS: Step[] = [
  "welcome", "url", "loading", "services", "destination", "objective", "rates", "audiences", "consent", "pricing", "bonus", "launching",
];

function parseOnboardingState(value: unknown): PersistedOnboardingState | null {
  if (!isUnknownRecord(value)) return null;
  const p = value as Partial<PersistedOnboardingState>;
  if (
    p.version !== ONBOARDING_STATE_VERSION ||
    (p.flowKey !== "signup" && p.flowKey !== "add" && p.flowKey !== "new") ||
    typeof p.step !== "string" || !ALL_STEPS.includes(p.step as Step) ||
    typeof p.url !== "string" ||
    (p.outcome !== "signups" && p.outcome !== "meetings") ||
    !isRateRecord(p.rates) || !isRateTextRecord(p.rateText) ||
    !isStringList(p.services) || typeof p.clickDestinationUrl !== "string" || !isProfileRecord(p.profile) ||
    !(p.selectedCount === null || typeof p.selectedCount === "number") ||
    typeof p.customCount !== "string" ||
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
  return step;
}

export function Onboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const { createOrganization, setActive } = useOrganizationList();
  const { session } = useSession();
  const forceNew = searchParams.get("new") === "1";
  // Entered from an in-app "New brand" / "New org" button (vs a fresh signup) —
  // skip the welcome hero and land straight on the URL step. Same flow otherwise.
  const fromAdd = searchParams.get("from") === "add";
  const flowKey: OnboardingFlowKey = fromAdd ? "add" : forceNew ? "new" : "signup";

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
        // (resumeCheckoutLaunch → "launching"); land there on the first paint so the
        // budget step never flashes before that effect runs. A cancelled return still
        // resolves to its snapshot step (pricing).
        searchParams.get("launch_checkout") === "success"
        ? "launching"
        : resolveResumeStep(restored.step, restored.brandId)
      : fromAdd
        ? "url"
        : "welcome",
  );
  const [url, setUrl] = useState(() => restored?.url ?? searchParams.get("url")?.trim() ?? "");
  const [error, setError] = useState<string | null>(null);
  // Reassuring (non-error) note shown on the pricing step after a cancelled checkout
  // return — the setup is saved and the user can finish payment from the same screen.
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [outcome, setOutcome] = useState<Outcome>(() => restored?.outcome ?? "signups");
  const [rates, setRates] = useState<Record<RateKey, number>>(() => restored?.rates ?? { ltv: 2500, v2s: 5, s2c: 10, v2m: 3, r2m: 30, m2c: 25 });
  const [rateText, setRateText] = useState<Record<RateKey, string>>(() => restored?.rateText ?? { ltv: "2,500", v2s: "5", s2c: "10", v2m: "3", r2m: "30", m2c: "25" });
  const [services, setServices] = useState<string[]>(() => restored?.services ?? []);
  const [serviceDraft, setServiceDraft] = useState("");
  // Page outreach clicks land on. "" means "use the brand domain" (the default
  // selection); a non-empty value is a custom page. Seeded from a sub-page in the
  // incoming brand URL (landing pricing prefill or ?url=) so arriving with e.g.
  // "acme.com/pricing" pre-selects that page instead of the homepage default.
  const [clickDestinationUrl, setClickDestinationUrl] = useState<string>(
    () => restored?.clickDestinationUrl ?? subpageDestinationFromUrl(restored?.url ?? searchParams.get("url")?.trim() ?? ""),
  );
  // Which destination radio is active: "home" (brand domain) or "custom" (a
  // specific sub-page). Kept as its OWN flag — an empty custom input would
  // otherwise be indistinguishable from "home". Seeded to "custom" when a
  // sub-page arrives in the incoming URL (so it pre-selects, matching the seed
  // above), else "home".
  const [destinationMode, setDestinationMode] = useState<"home" | "custom">(
    () =>
      (restored?.clickDestinationUrl ??
        subpageDestinationFromUrl(restored?.url ?? searchParams.get("url")?.trim() ?? ""))
        ? "custom"
        : "home",
  );
  const [profile, setProfile] = useState<Record<string, string | string[]>>(() => restored?.profile ?? {});
  // Outcome-count budget selection. selectedCount drives the derived $/day; budget
  // is the $/day value sent to the campaign. Tiers are derived from a STABLE base
  // (the projection unit cost), never from the selection — so clicking a card never
  // reshuffles the cards (the old $/day-tier bug).
  const [selectedCount, setSelectedCount] = useState<number | null>(() => restored?.selectedCount ?? null);
  const [customCount, setCustomCount] = useState(() => restored?.customCount ?? "");
  const [checkoutBudgetUsd, setCheckoutBudgetUsd] = useState<number | null>(() => restored?.checkoutBudgetUsd ?? null);
  const [audiencePrompt, setAudiencePrompt] = useState(() => restored?.audiencePrompt ?? "");
  const [audienceCandidates, setAudienceCandidates] = useState<AudienceCandidate[] | null>(() => restored?.audienceCandidates ?? null);
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<string[]>(() => restored?.selectedAudienceIds ?? []);
  // Pre-warmed audience step. During the loading screen we draft the ICP prompt
  // AND fire the audience suggest in the background, so the audience step opens
  // with candidates already (or nearly) ready — zero wait, zero click. Stashed in
  // state (not a ref) so a late-resolving prewarm still flows into the step as a prop.
  const [audiencePrefetch, setAudiencePrefetch] = useState<AudiencePrefetch | null>(null);
  const [launchStep, setLaunchStep] = useState(0);
  const [launchingBrand, setLaunchingBrand] = useState<{ domain: string | null; hostname: string } | null>(null);

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
  // The sales feature's declared input definitions — needed to build the
  // `featureInputs` map the /campaigns create endpoint requires at launch.
  const salesInputsRef = useRef<FeatureInput[]>(restored?.salesInputs ?? []);

  const domain = extractDomain(url);
  const hostname = domain ?? url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
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
      outcome,
      rates,
      rateText,
      services,
      clickDestinationUrl,
      profile,
      selectedCount,
      customCount,
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
  }, [step, url, outcome, rates, rateText, services, clickDestinationUrl, profile, selectedCount, customCount, checkoutBudgetUsd, audiencePrompt, audienceCandidates, selectedAudienceIds, brandId, flowKey, searchParams, pricingHydrationVersion]);

  // Replay the loading screen ONCE to re-fetch the brand-backed data (services,
  // economics, projection, feature inputs) the deeper steps depend on, then land the
  // user back on the exact step they were on. The brand already exists → idempotent.
  async function runResume(target: Step): Promise<void> {
    setStep("loading");
    resetLoadingProgress();
    try {
      await createBrandAndFetchServices({ isResume: true });
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
    await extractBrandFields([id], SALES_PROFILE_FIELDS).catch((e) => {
      console.error("[dashboard] extractBrandFields (background) failed:", e);
    });

    // Pre-warm the audience step: now that the brand profile is extracted, draft
    // the ICP prompt and fire the audience suggest in the background. By the time
    // the user clicks through services/goal/rates to the audience step, candidates
    // are ready. Fail-soft — a failed ICP/suggest resolves candidates:null and the
    // step falls back to its own draft + manual "Suggest audiences".
    const audiencePrewarm = (async (): Promise<{ prompt: string; candidates: AudienceCandidate[] | null }> => {
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
        if (!prompt) return { prompt: "", candidates: null };
        const { candidates } = await suggestAudiences(id, prompt);
        return { prompt, candidates };
      } catch (e) {
        console.error("[dashboard] audience prewarm (ICP + suggest) failed:", e);
        return { prompt, candidates: null };
      }
    })();
    setAudiencePrefetch({ promise: audiencePrewarm });

    const [prof, econRes, proj, feat] = await Promise.all([
      getBrandProfile(id),
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
    if (prof.current) {
      const fields = prof.current.fields;
      const nextServices = normalizeServices(fields.services);
      setProfile((prev) => ({
        ...fields,
        services: servicesEditedRef.current || nextServices.length === 0 ? prev.services ?? nextServices : nextServices,
      }));
      if (!servicesEditedRef.current && nextServices.length > 0) setServices(nextServices);
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

  // Create the brand for real, then block only on the services needed by the next step.
  // On a RESUME (refresh after the brand was already created) the org + brand already
  // exist: force org reuse so we never spin up a duplicate org, and the idempotent
  // upsertBrand below returns the same brandId.
  async function createBrandAndFetchServices(opts?: { isResume?: boolean }): Promise<void> {
    const isResume = opts?.isResume ?? false;
    const trimmed = url.trim();
    const brandUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const workspaceStartedAt = performance.now();
    const reuseOrgId = organization?.id ?? orgIdRef.current ?? null;
    const reuseOrg = (isResume || !forceNew) && !!reuseOrgId;
    let targetOrgId: string;
    if (reuseOrg) {
      targetOrgId = reuseOrgId!;
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
    const { brandId: newBrandId } = await upsertBrand(brandUrl);
    captureSetupMilestone("brand_upserted", brandStartedAt);
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
    const serviceFields = await extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { urlStrategy: "landing" }).catch((e) => {
      console.error("[dashboard] extractBrandFields failed:", e);
      captureSetupMilestone("services_extract_failed", servicesStartedAt);
      return null;
    });
    if (serviceFields) captureSetupMilestone("services_extracted", servicesStartedAt);
    brandIdRef.current = newBrandId;
    orgIdRef.current = targetOrgId;
    setBrandId(newBrandId);
    posthog.capture("onboarding_brand_created", { flow: "beta", org_id: targetOrgId, brand_id: newBrandId });
    const serviceValue = serviceFields?.fields.services?.value;
    if (serviceValue != null) {
      const nextServices = normalizeServices(serviceValue);
      if (nextServices.length > 0) {
        setProfile((prev) => ({ ...prev, services: nextServices }));
        setServices(nextServices);
      }
    }
    fetchDoneRef.current = true;
    setLoadStep(LOADING_STEPS.length);
    const hydration = hydrateOnboardingInBackground(newBrandId).catch((e) => {
      console.error("[dashboard] onboarding background hydrate failed:", e);
    });
    hydrationPromiseRef.current = hydration;
  }

  async function startAnalyze() {
    if (!domain) return;
    // Seed the click destination from a sub-page typed in the "What are we promoting?"
    // step (e.g. acme.com/pricing) — same as the landing ?url= prefill, but for a URL
    // entered inside onboarding rather than carried in at mount. Preserve an
    // already-customized value (|| keeps a user-set destination; a bare domain → "").
    setClickDestinationUrl((prev) => {
      const next = prev || subpageDestinationFromUrl(url);
      if (next) setDestinationMode("custom");
      return next;
    });
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

  async function fetchFreshWorkflowProjectionForRates(
    id: string,
    nextRates: Record<RateKey, number>,
    nextOutcome: Outcome,
  ): Promise<WorkflowProjectionResponse> {
    let lastProjection: WorkflowProjectionResponse | null = null;
    for (let attempt = 1; attempt <= PRICING_REFRESH_RETRIES; attempt += 1) {
      const proj = await getWorkflowProjection({
        featureSlug: SALES_FEATURE_SLUG,
        brandId: id,
        objective: salesObjectiveForOptimizationGoal(optimizationGoalForOutcome(nextOutcome)),
        budgetUsd: PROJECTION_REF_BUDGET,
      });
      lastProjection = proj;
      const goal = optimizationGoalForOutcome(nextOutcome);
      const usable = proj.workflows.some(
        (w) =>
          workflowOutcomeUnitCost(w, goal, {
            visitToSignupPct: nextRates.v2s,
            replyToMeetingPct: nextRates.r2m,
            visitToMeetingPct: nextRates.v2m,
          }) != null,
      );
      const fresh = workflowProjectionMatchesOutcomeRates(proj, goal, {
        visitToSignupPct: nextRates.v2s,
        replyToMeetingPct: nextRates.r2m,
        visitToMeetingPct: nextRates.v2m,
      });
      if (usable && fresh) return proj;
      console.error("[dashboard] onboarding: stale workflow projection after rates save", {
        attempt,
        goal,
        usable,
        fresh,
        recommendedWorkflowDynastySlug: proj.recommendedWorkflowDynastySlug,
      });
      if (attempt < PRICING_REFRESH_RETRIES) await delay(PRICING_REFRESH_RETRY_DELAY_MS);
    }
    // Retries exhausted. The reshaped workflow-projection backend computes projected
    // cost from the brand's EFFECTIVE economics server-side, which the client cannot
    // always reproduce from the raw saved rates within the freshness tolerance — so a
    // persistently "unfresh" projection is NOT a hard failure. Proceed as long as SOME
    // workflow yields a usable unit cost; only block when none does (genuinely no data).
    if (lastProjection) {
      const goal = optimizationGoalForOutcome(nextOutcome);
      const usable = lastProjection.workflows.some(
        (w) =>
          workflowOutcomeUnitCost(w, goal, {
            visitToSignupPct: nextRates.v2s,
            replyToMeetingPct: nextRates.r2m,
            visitToMeetingPct: nextRates.v2m,
          }) != null,
      );
      if (usable) {
        console.warn(
          "[dashboard] onboarding: proceeding with a usable projection that never met the freshness tolerance (server computes cost from effective economics)",
        );
        return lastProjection;
      }
    }
    throw new Error(
      lastProjection
        ? "Pricing is still refreshing from your new rates. Please try again."
        : "Pricing could not be refreshed from your new rates. Please try again.",
    );
  }

  // ── Step transitions that persist ────────────────────────────────
  async function saveRatesAndContinue() {
    const id = brandIdRef.current;
    if (!id) return;
    const rateKeys = RATE_KEYS_FOR_OUTCOME[outcome];
    let nextRates: Record<RateKey, number>;
    try {
      nextRates = { ...rates };
      for (const key of rateKeys) {
        nextRates[key] = parseRateTextInput(rateText[key], key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please enter valid decimal numbers.");
      return;
    }

    setError(null);
    setRates(nextRates);
    setRateText((current) => ({
      ...current,
      ...Object.fromEntries(rateKeys.map((key) => [key, rateToText(nextRates[key])])),
    }));
    setBusy(true);
    try {
      await saveBrandSalesEconomics(id, {
        lifetimeRevenueUsd: nextRates.ltv,
        replyToMeetingPct: nextRates.r2m,
        visitToMeetingPct: nextRates.v2m,
        meetingToClosePct: nextRates.m2c,
        visitToSignupPct: nextRates.v2s,
        signupToPaidClientPct: nextRates.s2c,
        optimizationGoal: optimizationGoalForOutcome(outcome),
      });
      // Refresh the projection BEST-EFFORT — never block the step on it. The
      // projection comes off a cold Neon chain and can return stale/degenerate
      // (no usable workflow cost data) for a given brand; throwing there left
      // Continue a dead button. Keep the last-good projection on failure; the
      // pricing/budget step refreshes it and degrades gracefully
      // (derivedBudget → recommendedBudgetUsd). (#1766)
      try {
        projectionRef.current = await fetchFreshWorkflowProjectionForRates(id, nextRates, outcome);
        setPricingHydrationVersion((value) => value + 1);
      } catch (projErr) {
        if (isInsufficientCredit(projErr)) throw projErr;
        console.error("[dashboard] onboarding: projection refresh after rates non-fatal; advancing", projErr);
      }
      setStep("audiences");
    } catch (err) {
      if (isInsufficientCredit(err)) {
        // Out of credit while pricing the projection — the add-credit modal is open;
        // resume this same step on credit add (no reset, no raw error).
        creditRetryRef.current = () => saveRatesAndContinue();
        return;
      }
      setError(err instanceof Error ? err.message : "Could not save your rates.");
    } finally {
      setBusy(false);
    }
  }

  // Persist the chosen click-destination page to brand-service, then advance.
  // Empty custom field = the domain default. Validated as an http(s) URL.
  async function saveDestinationAndContinue() {
    const id = brandIdRef.current;
    if (!id) {
      setError("Your brand is still being set up — give it a moment, then try again.");
      return;
    }
    const chosen = clickDestinationUrl.trim() || defaultDestinationUrl;
    let normalized: string;
    try {
      normalized = new URL(/^https?:\/\//i.test(chosen) ? chosen : `https://${chosen}`).toString();
    } catch {
      setError("Enter a valid page URL (e.g. https://yoursite.com/pricing).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await saveBrandClickDestination(id, normalized);
      setStep("objective");
    } catch (err) {
      if (isInsufficientCredit(err)) {
        creditRetryRef.current = () => saveDestinationAndContinue();
        return;
      }
      setError(err instanceof Error ? err.message : "Could not save your destination page.");
    } finally {
      setBusy(false);
    }
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

  async function completeLaunchAfterCheckout(pending: PendingCheckoutLaunch) {
    if (pending.profile && pending.services) {
      await saveBrandProfileVersion(pending.brandId, {
        ...pending.profile,
        services: pending.services,
        consentedChannels: ["email"],
        agencyConsentAt: new Date().toISOString(),
      });
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
    await saveBrandDailyBudget(pending.brandId, Math.round(pending.budgetUsd * 100));
    setLaunchStep(2);
    // Audience avatars are generated server-side by human-service the moment an
    // audience flips to `active` (org-billed, fire-and-forget, idempotent), so the
    // onboarding no longer generates them here — that would race the server gen and
    // double-bill. See human-service #144.
    setLaunchStep(3);
    const featureInputs = pending.featureInputs ?? await buildFeatureInputsForLaunch(pending.brandId);
    const { campaign } = await createCampaignWithoutBrandEnrichment({
      name: `${pending.hostname} — ${OUTCOMES.find((o) => o.key === pending.outcome)?.label ?? "Outreach"}`,
      workflowSlug: pending.workflowSlug,
      brandUrls: [pending.brandUrl],
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
    window.sessionStorage.removeItem(CHECKOUT_PENDING_KEY);
    // Flow genuinely finished — drop the resume snapshot so the next onboarding (a new
    // brand/org in the same tab) starts clean instead of resuming this completed one.
    clearOnboardingState();
    setLaunchStep(5);
    router.push(`/orgs/${pending.orgId}/brands/${pending.brandId}?launched=${campaign.id}`);
  }

  async function beginCheckoutAndLaunch() {
    setBusy(true);
    setError(null);
    setCancelNotice(null);
    try {
      const storedPending = readPendingCheckoutLaunchOrNull();
      const id = brandIdRef.current ?? storedPending?.brandId ?? null;
      const orgId = orgIdRef.current ?? storedPending?.orgId ?? null;
      // Live selection wins, matching the display precedence (derivedBudget() ??
      // checkoutBudgetUsd at the bonus/pricing steps). checkoutBudgetUsd is only ever
      // written from a restored/resumed snapshot, so after a checkout cancel it holds
      // the PRIOR budget — putting it first would charge the stale amount even though
      // the user re-picked a different tier.
      const budget = derivedBudget() ?? checkoutBudgetUsd ?? storedPending?.budgetUsd;
      const trimmed = url.trim();
      const normalizedCurrentUrl = trimmed ? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`) : null;
      const brandUrl = normalizedCurrentUrl ?? storedPending?.brandUrl ?? null;
      const launchHostname = hostname || storedPending?.hostname || "";
      const launchOutcome = brandIdRef.current ? outcome : storedPending?.outcome ?? outcome;
      if (!id || !orgId || budget == null || !brandUrl || !launchHostname) {
        throw new Error("Checkout state is missing. Go back to pricing and try again.");
      }
      // Block payment when no audience is picked — outreach can't run without one, so
      // a campaign launched audience-less is a paid-for dead end. Live selection wins,
      // falling back to the resumed snapshot (same precedence as budget above).
      const launchAudienceIds = selectedAudienceIds.length
        ? selectedAudienceIds
        : storedPending?.onboardingState.selectedAudienceIds ?? [];
      if (launchAudienceIds.length === 0) {
        throw new Error("Pick at least one audience before launching — go back to the audience step.");
      }
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
        profile: brandIdRef.current === id && normalizedCurrentUrl ? profile : storedPending?.profile,
        services: brandIdRef.current === id && normalizedCurrentUrl ? services : storedPending?.services,
        onboardingState: checkoutState,
        createdAt: new Date().toISOString(),
      };
      window.sessionStorage.setItem(CHECKOUT_PENDING_KEY, JSON.stringify(pending));

      const successUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      successUrl.searchParams.set("success", "true");
      successUrl.searchParams.set("launch_checkout", "success");
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

  async function resumeCheckoutLaunch() {
    setBusy(true);
    setError(null);
    try {
      const pending = readPendingCheckoutLaunch();
      applyRestoredOnboardingState(pending.onboardingState, { step: "launching" });
      setCheckoutBudgetUsd(pending.budgetUsd);
      setLaunchingBrand({ domain: extractDomain(pending.brandUrl), hostname: pending.hostname });
      setLaunchStep(0);
      setStep("launching");

      await completeLaunchAfterCheckout(pending);
    } catch (err) {
      posthog.capture("onboarding_launch_failed", { flow: "beta", stage: "checkout_return" });
      const detail = err instanceof Error ? err.message : "unknown error";
      setError(`Checkout returned, but launch could not finish: ${detail}`);
      setStep("pricing");
      setBusy(false);
    }
  }

  function applyRestoredOnboardingState(state: PersistedOnboardingState, opts?: { step?: Step }) {
    setUrl(state.url);
    setOutcome(state.outcome);
    setRates(state.rates);
    setRateText(state.rateText);
    setServices(state.services);
    setClickDestinationUrl(state.clickDestinationUrl);
    setDestinationMode(state.clickDestinationUrl.trim() ? "custom" : "home");
    setProfile(state.profile);
    setSelectedCount(state.selectedCount);
    setCustomCount(state.customCount);
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

  // ── Per-outcome economics for the budget cards ──────────────────
  // The outcome-optimized workflow's funnel projection (counts at PROJECTION_REF_BUDGET).
  function activeWorkflow() {
    const resp = projectionRef.current;
    if (!resp) return null;
    return selectWorkflowForOptimizationGoal(resp, optimizationGoalForOutcome(outcome), {
      visitToSignupPct: rates.v2s,
      replyToMeetingPct: rates.r2m,
      visitToMeetingPct: rates.v2m,
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
        })
      : null;
  }

  // Daily budget needed to hit `n` outcomes / month.
  function budgetForCount(n: number): number | null {
    const uc = outcomeUnitCost();
    if (uc == null || uc <= 0) return null;
    return Math.max(1, Math.round((n * uc) / 30));
  }

  // The $/day for the current selection (or null if nothing usable yet).
  function derivedBudget(): number | null {
    if (selectedCount == null) return null;
    const b = budgetForCount(selectedCount);
    if (b != null) return b;
    // Degenerate projection — fall back to the recommended budget so launch works.
    const rec = projectionRef.current?.recommendedBudgetUsd;
    return rec && rec > 0 ? Math.round(rec) : null;
  }

  const outcomeMeta = OUTCOMES.find((o) => o.key === outcome)!;

  // ── Service-tag editor helpers ────────────────────────────────────
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
          <button onClick={() => setStep("url")} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            Get started <ArrowRightIcon className="h-4 w-4" />
          </button>
        }
      >
        <h1 className="font-display text-4xl font-bold leading-tight text-gray-950">Pay per outcome, like Google Ads.</h1>
        <p className="mt-3 text-base leading-7 text-gray-500">Drop your product URL and a daily budget. We find your leads, reach out across the best channels on your behalf, and turn them into signups, meetings and sales.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Drop your URL",
              desc: "We read your product and buyer profile.",
              Icon: MagnifyingGlassIcon,
            },
            {
              title: "We run outreach",
              desc: "Finds leads and contacts buyers across the best channels.",
              Icon: PaperAirplaneIcon,
            },
            {
              title: "You get outcomes",
              desc: "Signups, meetings, and sales land back with you.",
              Icon: TrophyIcon,
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-100 bg-white text-brand-600">
                <f.Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-base font-semibold text-gray-950">{f.title}</div>
              <div className="mt-1.5 text-sm leading-6 text-gray-500">{f.desc}</div>
            </div>
          ))}
        </div>
      </StepShell>
    );
  }

  if (step === "url") {
    return (
      <StepShell
        maxWidth="sm:max-w-md"
        pad="p-5 sm:p-6 md:p-8"
        footer={
          <button onClick={startAnalyze} disabled={!domain} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
            Analyze my product <ArrowRightIcon className="h-4 w-4" />
          </button>
        }
      >
        <h2 className="font-display text-2xl font-bold text-gray-900">What are we promoting?</h2>
        <p className="mt-2 mb-6 text-gray-500">We read your product, find the leads, and run the outreach. Just drop the URL.</p>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <input
          type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="e.g. acme.com" autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && domain) startAnalyze(); }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {url.trim() && !domain && <p className="mt-2 text-sm text-red-500">Please enter a valid URL (e.g. acme.com)</p>}
      </StepShell>
    );
  }

  if (step === "loading") {
    const loadingComplete = fetchDoneRef.current || loadStep >= LOADING_STEPS.length;
    return (
      <StepShell
        maxWidth="sm:max-w-md"
        pad="p-5 sm:p-6 md:p-8"
        header={<BrandStepHeader domain={domain} hostname={hostname} onEdit={() => setStep("url")} />}
      >
          <div className="mb-2 text-center text-lg font-semibold text-gray-950">{loadingComplete ? "Your strategy is ready." : "Building your strategy…"}</div>
          <p className="mb-6 text-center text-sm text-gray-500">Reading <span className="font-medium text-gray-700">{hostname}</span></p>
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
    return (
      <StepShell
        header={<BrandStepHeader domain={domain} hostname={hostname} onEdit={() => setStep("url")} />}
        footer={<NextButton onClick={() => { addService(serviceDraft); setStep("destination"); }} disabled={services.length === 0 && serviceDraft.trim() === ""} />}
      >
        <h2 className="font-display text-2xl font-bold text-gray-900">What services do you want to promote with us?</h2>
        <p className="mt-2 mb-6 text-gray-500">We drafted these from <span className="font-medium text-gray-700">{hostname}</span>. Add or remove until the list matches what you sell.</p>
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
        {services.length === 0 && serviceDraft.trim() === "" && <p className="mt-2 text-xs text-gray-400">Add at least one service to continue.</p>}
      </StepShell>
    );
  }

  if (step === "destination") {
    // Two homogeneous radio cards: "home" (brand domain) vs "custom" (a specific
    // sub-page). Card selection is styled identically; the custom card reveals its
    // URL input inside the same bordered box when active.
    const cardClass = (active: boolean) =>
      `rounded-xl border transition ${active ? "border-brand-300 bg-brand-50 ring-1 ring-brand-300" : "border-gray-200 hover:border-gray-300"}`;
    const radioDot = (active: boolean) =>
      `mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${active ? "border-brand-500 bg-brand-500" : "border-gray-300"}`;
    return (
      <StepShell
        header={<BrandStepHeader domain={domain} hostname={hostname} onEdit={() => setStep("url")} />}
        footer={<NextButton onClick={saveDestinationAndContinue} busy={busy} disabled={busy} />}
      >
          <BackButton onClick={() => setStep("services")} />
          <h2 className="font-display text-2xl font-bold text-gray-900">Where should clicks go?</h2>
          <p className="mt-2 mb-6 text-gray-500">When a prospect clicks the link in your email, this is the page they land on. We use your homepage by default.</p>
          <div className="space-y-3">
            <div className={cardClass(destinationMode === "home")}>
              <button
                type="button"
                onClick={() => { setDestinationMode("home"); setClickDestinationUrl(""); }}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <span className={radioDot(destinationMode === "home")} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">Your homepage</span>
                  <span className="block break-words text-sm text-gray-500">{defaultDestinationUrl || hostname}</span>
                </span>
              </button>
            </div>
            <div className={cardClass(destinationMode === "custom")}>
              <button
                type="button"
                onClick={() => setDestinationMode("custom")}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <span className={radioDot(destinationMode === "custom")} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">A specific page</span>
                  <span className="block text-sm text-gray-500">Send clicks to a sub-page instead of the homepage.</span>
                </span>
              </button>
              {destinationMode === "custom" && (
                <div className="px-4 pb-4">
                  <input
                    id="ob-destination"
                    type="url"
                    inputMode="url"
                    autoFocus
                    value={clickDestinationUrl}
                    onChange={(e) => setClickDestinationUrl(e.target.value)}
                    placeholder="https://yoursite.com/pricing"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              )}
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </StepShell>
    );
  }

  if (step === "objective") {
    return (
      <StepShell
        header={<BrandStepHeader domain={domain} hostname={hostname} onEdit={() => setStep("url")} />}
        footer={<NextButton onClick={() => setStep("rates")} />}
      >
          <BackButton onClick={() => setStep("destination")} />
          <h2 className="font-display text-2xl font-bold text-gray-900">What is your primary sales goal?</h2>
          <p className="mt-2 mb-6 text-gray-500">Pick the one outcome this campaign optimizes for. The budget is shown per this outcome.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {OUTCOMES.map((o) => (
              <ChoiceCard key={o.key} active={outcome === o.key} onClick={() => setOutcome(o.key)} title={o.label} desc={o.desc} />
            ))}
          </div>
      </StepShell>
    );
  }

  if (step === "rates") {
    const rateKeys = RATE_KEYS_FOR_OUTCOME[outcome];
    return (
      <StepShell
        header={<BrandStepHeader domain={domain} hostname={hostname} onEdit={() => setStep("url")} />}
        footer={<NextButton onClick={saveRatesAndContinue} busy={busy} label="Continue" />}
      >
        <BackButton onClick={() => setStep("objective")} />
        <h2 className="font-display text-2xl font-bold text-gray-900">Your conversion rates.</h2>
        <p className="mt-2 mb-6 text-gray-500">We pre-filled this from your profile. An estimate is fine — tweak anytime.</p>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {outcome === "meetings" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {rateKeys.map((k) => (
              <div key={k} className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{RATE_META[k].label}</div>
                  <div className="mt-1 text-xs leading-5 text-gray-500">{RATE_META[k].hint}</div>
                </div>
                <div className="flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-5 focus-within:border-brand-400">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rateText[k]}
                    onChange={(e) => {
                      ratesEditedRef.current = true;
                      launchFeatureInputsRef.current = null;
                      setRateText((t) => ({ ...t, [k]: e.target.value }));
                    }}
                    onBlur={() => {
                      const value = parseLocaleNumberInput(rateText[k]);
                      if (value !== null) {
                        setRateText((t) => ({ ...t, [k]: rateToText(value) }));
                      }
                    }}
                    className="w-full bg-transparent text-center text-5xl font-bold text-gray-900 focus:outline-none"
                  />
                  <span className="text-2xl font-semibold text-gray-400">%</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {rateKeys.map((k) => (
              <div key={k} className="flex flex-col items-stretch gap-4 rounded-xl border border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-gray-900">{RATE_META[k].label}</div>
                  <div className="mt-1 text-sm leading-5 text-gray-500">{RATE_META[k].hint}</div>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-3 focus-within:border-brand-400 sm:w-40 sm:shrink-0">
                  {RATE_META[k].suffix === "$" && <span className="text-2xl font-semibold text-gray-400">$</span>}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rateText[k]}
                    onChange={(e) => {
                      ratesEditedRef.current = true;
                      launchFeatureInputsRef.current = null;
                      setRateText((t) => ({ ...t, [k]: e.target.value }));
                    }}
                    onBlur={() => {
                      const value = parseLocaleNumberInput(rateText[k]);
                      if (value !== null) {
                        setRateText((t) => ({ ...t, [k]: rateToText(value) }));
                      }
                    }}
                    className="w-full bg-transparent text-right text-3xl font-bold text-gray-900 focus:outline-none"
                  />
                  {RATE_META[k].suffix === "%" && <span className="text-2xl font-semibold text-gray-400">%</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </StepShell>
    );
  }

  if (step === "audiences") {
    return (
      <OnboardingAudiences
        brandId={brandId}
        brandDomain={domain}
        hostname={hostname}
        services={services}
        prefetch={audiencePrefetch}
        prompt={audiencePrompt}
        onPromptChange={setAudiencePrompt}
        candidates={audienceCandidates}
        onCandidatesChange={setAudienceCandidates}
        selectedAudienceIds={selectedAudienceIds}
        onSelectedAudienceIdsChange={setSelectedAudienceIds}
        onBack={() => setStep("rates")}
        onContinue={() => setStep("consent")}
        onEdit={() => setStep("url")}
      />
    );
  }

  if (step === "consent") {
    return (
      <StepShell
        header={<BrandStepHeader domain={domain} hostname={hostname} onEdit={() => setStep("url")} />}
        footer={<NextButton onClick={() => setStep("pricing")} label="Continue" />}
      >
          <BackButton onClick={() => setStep("audiences")} />
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

  if (step === "launching") {
    const brand = launchingBrand ?? { domain, hostname };
    return (
      <StepShell header={<BrandStepHeader domain={brand.domain} hostname={brand.hostname} />}>
          <div className="mb-2 text-center text-lg font-semibold text-gray-950">Launching your campaign...</div>
          <p className="mb-6 text-center text-sm text-gray-500">Keep this tab open while we finish setup.</p>
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
    const amount = derivedBudget() ?? checkoutBudgetUsd;
    return (
      <StepShell
        header={<BrandStepHeader domain={domain} hostname={hostname} onEdit={() => setStep("url")} />}
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
            <h2 className="font-display text-2xl font-bold text-gray-900">Your first $25 is on us.</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-gray-600">
              Spend $25 and we match it, $1 for $1. The credits unlock the moment your spend reaches $25.
            </p>
          </div>
      </StepShell>
    );
  }

  // pricing — outcome-count budget
  const unitCost = outcomeUnitCost();
  const selectedBudget = derivedBudget() ?? checkoutBudgetUsd;
  return (
    <StepShell
      header={<BrandStepHeader domain={domain} hostname={hostname} onEdit={() => setStep("url")} />}
      footer={
        <button onClick={() => setStep("bonus")} disabled={selectedBudget == null} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
          Continue <ArrowRightIcon className="h-4 w-4" />
        </button>
      }
    >
      <BackButton onClick={() => setStep("consent")} />
      <h2 className="font-display text-2xl font-bold text-gray-900">Your monthly target.</h2>
      <p className="mt-2 mb-5 text-gray-500">Pick how many <strong>{outcomeMeta.unit}</strong> you want each month — we set the daily budget to hit it.</p>
      {cancelNotice && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{cancelNotice}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <CreditCardIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <p className="text-sm leading-6 text-brand-800">
          This is the <strong>brand daily budget cap</strong>. Checkout loads credits first,
          then auto-topup reloads the same daily amount whenever the balance drops below $5.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COUNT_TIERS.map((n, i) => {
          const b = budgetForCount(n);
          const active = selectedCount === n;
          return (
            <button key={n} onClick={() => setSelectedCount(n)} className={`rounded-xl border-2 p-4 text-left transition ${active ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
              {i === 1 ? <div className="mb-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">Recommended</div> : <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{i === 0 ? "Starter" : "Growth"}</div>}
              <div className="text-xl font-bold text-gray-950">{fmtCount(n)}</div>
              <div className="text-xs text-gray-500">{outcomeMeta.unit} / mo</div>
              <div className="mt-2 text-xs text-gray-400">{b != null ? `~${fmtUsd0(b)} / day` : "—"}</div>
            </button>
          );
        })}
        {/* Other — custom count */}
        {(() => {
          const parsedCustomN = parseLocaleNumberInput(customCount);
          const customN = parsedCustomN === null ? null : Math.round(parsedCustomN);
          const isCustom = customN !== null && customN > 0;
          const active = isCustom && selectedCount === customN;
          const b = isCustom ? budgetForCount(customN) : null;
          const selectCustomCount = () => {
            if (isCustom) setSelectedCount(customN);
          };
          return (
            <div
              onClick={selectCustomCount}
              className={`rounded-xl border-2 p-4 transition ${isCustom ? "cursor-pointer" : ""} ${active ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white"}`}
            >
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Other</div>
              <input
                type="text"
                inputMode="numeric"
                value={customCount}
                onChange={(e) => {
                  setCustomCount(e.target.value);
                  const v = parseLocaleNumberInput(e.target.value);
                  setSelectedCount(v !== null && v > 0 ? Math.round(v) : null);
                }}
                onBlur={() => {
                  const v = parseLocaleNumberInput(customCount);
                  if (v !== null) setCustomCount(formatLocaleInteger(v));
                }}
                placeholder="Custom"
                className="w-full bg-transparent text-xl font-bold text-gray-950 placeholder-gray-300 focus:outline-none"
              />
              <div className="text-xs text-gray-500">{outcomeMeta.unit} / mo</div>
              <div className="mt-2 text-xs text-gray-400">{b != null ? `~${fmtUsd0(b)} / day` : "—"}</div>
            </div>
          );
        })()}
      </div>

      {selectedBudget != null && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Daily budget: <strong className="text-gray-900">{fmtUsd0(selectedBudget)} / day</strong>
          {unitCost != null && <span className="mt-1 block text-gray-400 sm:mt-0 sm:inline"> ~{fmtUsd0(unitCost)} / {outcomeMeta.unit.replace(/s$/, "")}</span>}
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
  const icpFetchedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
        .then(({ prompt: p, candidates: c }) => {
          onPromptChange(prompt.trim() ? prompt : p || fallbackPrompt);
          if (c) {
            onCandidatesChange(c);
            if (c.length === 0) setErr("No audiences matched that description. Try rephrasing.");
          }
        })
        .catch((e) => {
          console.error("[dashboard] audience prefetch adopt failed:", e);
          onPromptChange(prompt.trim() ? prompt : fallbackPrompt);
        })
        .finally(() => {
          setIcpLoading(false);
          setLoading(false);
        });
      return;
    }

    if (!brandId) {
      onPromptChange(prompt.trim() ? prompt : fallbackPrompt);
      setIcpLoading(false);
      return;
    }
    (async () => {
      let nl = fallbackPrompt;
      try {
        const { icp } = await suggestBrandIcp(brandId);
        nl = icp.trim() || fallbackPrompt;
      } catch (e) {
        console.error("[dashboard] suggestBrandIcp (onboarding prefill) failed:", e);
      } finally {
        setIcpLoading(false);
      }
      onPromptChange(prompt.trim() ? prompt : nl);
      if (nl) void runSuggest(nl);
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
      if (res.candidates.length === 0 && keep.length === 0)
        setErr("No audiences matched that description. Try rephrasing.");
    } catch (e) {
      console.error("[dashboard] suggestAudiences failed:", e);
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
      header={<BrandStepHeader domain={brandDomain} hostname={hostname} onEdit={onEdit} />}
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
        <button
          onClick={() => runSuggest()}
          disabled={loading || icpLoading || !prompt.trim()}
          className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-brand-500 px-5 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
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

function BrandStepHeader({ domain, hostname, onEdit }: { domain: string | null; hostname: string; onEdit?: () => void }) {
  const label = domain ?? hostname;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
        <BrandLogo
          domain={label}
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

function NextButton({ onClick, disabled = false, busy = false, label = "Continue" }: { onClick: () => void; disabled?: boolean; busy?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={disabled || busy} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…</> : <>{label} <ArrowRightIcon className="h-4 w-4" /></>}
    </button>
  );
}

function ChoiceCard({ active, onClick, title, desc, check = false }: { active: boolean; onClick: () => void; title: string; desc: string; check?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition ${active ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 ${check ? "rounded-md" : "rounded-full"} ${active ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"}`}>{active && <CheckIcon className="h-3 w-3" />}</span>
      <span>
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-gray-500">{desc}</span>
      </span>
    </button>
  );
}
