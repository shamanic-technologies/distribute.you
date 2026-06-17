"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useOrganization,
  useOrganizationList,
  useSession,
} from "@clerk/nextjs";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  CreditCardIcon,
  CursorArrowRaysIcon,
  GiftIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrophyIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/20/solid";
import posthog from "posthog-js";
import {
  upsertBrand,
  extractBrandFields,
  SALES_PROFILE_FIELDS,
  getBrandProfile,
  saveBrandProfileVersion,
  getSalesEconomicsEffective,
  saveBrandSalesEconomics,
  suggestPersonas,
  createPersona,
  listPersonas,
  getWorkflowProjection,
  getFeature,
  prefillFeatureInputs,
  prefillToStringMap,
  createCheckoutSession,
  setupBillingWallet,
  createCampaignWithoutBrandEnrichment,
  saveBrandDailyBudget,
  type EffectiveSalesEconomics,
  type WorkflowProjectionResponse,
  type PersonaDraft,
  type FeatureInput,
  regeneratePersonaAvatar,
} from "@/lib/api";
import { extractDomain } from "@/lib/extract-domain";
import { useAuthQuery } from "@/lib/use-auth-query";
import { type Filters, type Persona } from "@/lib/mock-personas";
import { PersonaCard, capWords } from "@/components/personas/persona-card";
import { EditWithAIChat } from "@/components/ai-edit/edit-with-ai-chat";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Beta onboarding (allowlist only — see `beta-allowlist.ts`). A guided flow ported
 * from the app.distribute.you mockup: welcome → URL → an ANIMATED build sequence that
 * runs WHILE the brand is created AND its profile / services / personas / economics /
 * pricing projection are fetched for real → services to promote → sales goal →
 * conversion rates → review the AI-proposed persona (server-backed, Edit-with-AI)
 * → agency-channel consent → outcome-count budget → launches a real campaign.
 * Everything is wired to live endpoints.
 */

const SALES_FEATURE_SLUG = "sales-cold-email-outreach";
const PROJECTION_REF_BUDGET = 100; // counts come back at this budget; unit costs are budget-invariant
const WALLET_PENDING_KEY = "distribute:onboarding-wallet-launch";
const MIN_INITIAL_LOAD_USD = 10;
const MIN_TOPUP_USD = 10;
const MIN_THRESHOLD_USD = 5;

type Step =
  | "welcome"
  | "url"
  | "loading"
  | "services"
  | "objective"
  | "rates"
  | "personas"
  | "consent"
  | "pricing"
  | "wallet"
  | "launching";

// The two sales goals (Kevin): Signups or Sales Meetings. Each maps to a
// projection count so the budget cards show the chosen unit, never "closes".
type Outcome = "signups" | "meetings";
const OUTCOMES: { key: Outcome; label: string; unit: string; desc: string }[] = [
  { key: "signups", label: "Signups", unit: "signups", desc: "Maximize free signups / trial starts." },
  { key: "meetings", label: "Sales meetings", unit: "meetings", desc: "Maximize booked sales meetings." },
];

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
// thousands separators ("2,500") and allow decimals ("0.5"). User input is
// intentionally not reformatted on each keystroke; normalizing while typing
// breaks ordinary edits like turning "3" into "0.3".
function groupInt(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseRateTextInput(raw: string, key: RateKey): number {
  const label = RATE_META[key].label;
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(`${label} is required.`);

  if (RATE_META[key].suffix === "%") {
    const compact = trimmed.replace(/\s/g, "").replace(",", ".");
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(compact)) {
      throw new Error(`${label} must be a decimal number.`);
    }
    const value = Number(compact);
    if (!Number.isFinite(value)) throw new Error(`${label} must be a decimal number.`);
    if (value < 0 || value > 100) throw new Error(`${label} must be between 0 and 100%.`);
    return value;
  }

  const compact = trimmed.replace(/\s/g, "");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(compact)) {
    throw new Error(`${label} must be a decimal dollar amount.`);
  }
  const value = Number(compact.replace(/,/g, ""));
  if (!Number.isFinite(value)) throw new Error(`${label} must be a decimal dollar amount.`);
  if (value < 0) throw new Error(`${label} must be 0 or more.`);
  return value;
}

function rateToText(n: number): string {
  if (!isFinite(n)) return "";
  const [intPart, decPart] = String(n).split(".");
  const grouped = groupInt(intPart);
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
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
  { id: "workspace", label: "Preparing your workspace" },
  { id: "brand", label: "Adding your brand" },
  { id: "services", label: "Extracting your services" },
];
const LAUNCH_STEPS = [
  { id: "wallet", label: "Confirming wallet payment" },
  { id: "topup", label: "Applying wallet match" },
  { id: "campaign", label: "Launching campaign" },
  { id: "access", label: "Opening dashboard access" },
  { id: "dashboard", label: "Opening your dashboard" },
];

const GENERIC_AI_SETUP_ERROR = "Our AI analysis service had a temporary issue. Your workspace is ready, but some suggestions may need to be filled in manually.";

function displaySetupError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/chat-service|LLM call failed|\/complete/i.test(message)) {
    return "Our AI analysis service had a temporary issue. Please try again in a minute.";
  }
  return err instanceof Error ? err.message : "Setup failed. Please try again.";
}

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

let personaSeq = 0;
const nextPersonaId = () => `ob-persona-${++personaSeq}`;

const fmtUsd0 = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const fmtCount = (n: number) => Math.round(n).toLocaleString("en-US");

type PendingWalletLaunch = {
  version: 1;
  brandId: string;
  orgId: string;
  brandUrl: string;
  hostname: string;
  outcome: Outcome;
  budgetUsd: number;
  workflowSlug: string;
  initialLoadCents: number;
  topupAmountCents: number;
  topupThresholdCents: number;
  featureInputs?: Record<string, string>;
  profile?: Record<string, string | string[]>;
  services?: string[];
  createdAt: string;
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

function dollarsToCentsInput(value: string, label: string, minUsd: number): number {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  const dollars = Number(trimmed);
  if (!Number.isFinite(dollars)) throw new Error(`${label} must be a valid dollar amount.`);
  if (dollars < minUsd) throw new Error(`${label} must be at least ${fmtUsd0(minUsd)}.`);
  return Math.round(dollars * 100);
}

function readPendingWalletLaunch(): PendingWalletLaunch {
  const raw = window.sessionStorage.getItem(WALLET_PENDING_KEY);
  if (!raw) {
    throw new Error("Wallet checkout returned, but the pending launch state is missing. Campaign was not launched.");
  }
  const parsed = JSON.parse(raw) as Partial<PendingWalletLaunch>;
  if (
    parsed.version !== 1 ||
    typeof parsed.brandId !== "string" ||
    typeof parsed.orgId !== "string" ||
    typeof parsed.brandUrl !== "string" ||
    typeof parsed.hostname !== "string" ||
    (parsed.outcome !== "signups" && parsed.outcome !== "meetings") ||
    typeof parsed.budgetUsd !== "number" ||
    typeof parsed.workflowSlug !== "string" ||
    typeof parsed.initialLoadCents !== "number" ||
    typeof parsed.topupAmountCents !== "number" ||
    typeof parsed.topupThresholdCents !== "number" ||
    (parsed.featureInputs !== undefined && !isStringRecord(parsed.featureInputs)) ||
    (parsed.profile !== undefined && !isProfileRecord(parsed.profile)) ||
    (parsed.services !== undefined && !isStringList(parsed.services)) ||
    typeof parsed.createdAt !== "string"
  ) {
    throw new Error("Wallet checkout returned with an invalid pending launch state. Campaign was not launched.");
  }
  return parsed as PendingWalletLaunch;
}

function readPendingWalletLaunchOrNull(): PendingWalletLaunch | null {
  if (!window.sessionStorage.getItem(WALLET_PENDING_KEY)) return null;
  return readPendingWalletLaunch();
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

export function BetaOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const { createOrganization, setActive } = useOrganizationList();
  const { session } = useSession();
  const forceNew = searchParams.get("new") === "1";

  const [step, setStep] = useState<Step>("welcome");
  const [url, setUrl] = useState(searchParams.get("url")?.trim() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [setupIssues, setSetupIssues] = useState({ extraction: false, persona: false });
  const [busy, setBusy] = useState(false);

  const [outcome, setOutcome] = useState<Outcome>("signups");
  const [rates, setRates] = useState<Record<RateKey, number>>({ ltv: 2500, v2s: 5, s2c: 10, v2m: 3, r2m: 30, m2c: 25 });
  const [rateText, setRateText] = useState<Record<RateKey, string>>(() => ({ ltv: "2,500", v2s: "5", s2c: "10", v2m: "3", r2m: "30", m2c: "25" }));
  const [services, setServices] = useState<string[]>([]);
  const [serviceDraft, setServiceDraft] = useState("");
  const [profile, setProfile] = useState<Record<string, string | string[]>>({});
  // Outcome-count budget selection. selectedCount drives the derived $/day; budget
  // is the $/day value sent to the campaign. Tiers are derived from a STABLE base
  // (the projection unit cost), never from the selection — so clicking a card never
  // reshuffles the cards (the old $/day-tier bug).
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [customCount, setCustomCount] = useState("");
  const [walletBudgetUsd, setWalletBudgetUsd] = useState<number | null>(null);
  const [initialLoadUsd, setInitialLoadUsd] = useState("25");
  const [walletTopupAmountUsd, setWalletTopupAmountUsd] = useState("25");
  const [walletTopupThresholdUsd, setWalletTopupThresholdUsd] = useState("5");
  const [personaSeeding, setPersonaSeeding] = useState(false);
  const [launchStep, setLaunchStep] = useState(0);
  const [launchingBrand, setLaunchingBrand] = useState<{ domain: string | null; hostname: string } | null>(null);

  // Loading-sequence + real fetch coordination. The visible checks follow real
  // client milestones: org ready, brand upserted, then service extraction.
  const [loadStep, setLoadStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const brandIdRef = useRef<string | null>(null);
  const orgIdRef = useRef<string | null>(null);
  const fetchDoneRef = useRef(false);
  const loadingStartedAtRef = useRef<number | null>(null);
  const walletResumeStartedRef = useRef(false);

  const projectionRef = useRef<WorkflowProjectionResponse | null>(null);
  const econRef = useRef<EffectiveSalesEconomics | null>(null);
  const launchFeatureInputsRef = useRef<Record<string, string> | null>(null);
  const hydrationPromiseRef = useRef<Promise<void> | null>(null);
  const servicesEditedRef = useRef(false);
  const ratesEditedRef = useRef(false);
  // The sales feature's declared input definitions — needed to build the
  // `featureInputs` map the /campaigns create endpoint requires at launch.
  const salesInputsRef = useRef<FeatureInput[]>([]);

  const domain = extractDomain(url);
  const hostname = domain ?? url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

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

  async function seedOnboardingPersonaFromBrandInfo(id: string): Promise<void> {
    setPersonaSeeding(true);
    try {
      const sug = await suggestPersonas(id, 1);
      const first: PersonaDraft | undefined = sug.personas[0];
      if (first?.name?.trim()) {
        await createPersona(id, { name: capWords(first.name.trim()), filters: first.filters });
        await queryClient.invalidateQueries({ queryKey: ["personas", id] });
      }
    } catch (e) {
      console.error("[dashboard] suggest/create persona (onboarding seed) failed:", e);
      setSetupIssues((prev) => ({ ...prev, persona: true }));
    } finally {
      setPersonaSeeding(false);
    }
  }

  async function hydrateOnboardingInBackground(id: string): Promise<void> {
    setPersonaSeeding(true);
    await extractBrandFields([id], SALES_PROFILE_FIELDS).catch((e) => {
      console.error("[dashboard] extractBrandFields (background) failed:", e);
      setSetupIssues((prev) => ({ ...prev, extraction: true }));
    });
    // Persona drafting is the next latency-sensitive AI task, so start it as
    // soon as brand-profile extraction is done instead of bundling it behind
    // projection/economics hydration.
    const personaSeed = seedOnboardingPersonaFromBrandInfo(id);

    const [prof, econRes, proj, feat] = await Promise.all([
      getBrandProfile(id),
      getSalesEconomicsEffective(id),
      getWorkflowProjection({ featureSlug: SALES_FEATURE_SLUG, brandId: id, objective: "self-serve", budgetUsd: PROJECTION_REF_BUDGET }),
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
      const loaded: Record<RateKey, number> = {
        ltv: e.lifetimeRevenueUsd,
        v2s: e.visitToSignupPct,
        s2c: e.signupToPaidClientPct,
        v2m: e.visitToMeetingPct,
        r2m: e.replyToMeetingPct,
        m2c: e.meetingToClosePct,
      };
      setRates(loaded);
      setRateText(Object.fromEntries((Object.keys(loaded) as RateKey[]).map((k) => [k, rateToText(loaded[k])])) as Record<RateKey, string>);
    }
    projectionRef.current = proj;
    await personaSeed;
  }

  async function waitForOnboardingHydration(): Promise<void> {
    if (!hydrationPromiseRef.current) return;
    await hydrationPromiseRef.current;
  }

  // Create the brand for real, then block only on the services needed by the next step.
  async function createBrandAndFetchServices(): Promise<void> {
    const trimmed = url.trim();
    const brandUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const workspaceStartedAt = performance.now();
    const reuseOrg = !forceNew && !!organization?.id;
    let targetOrgId: string;
    if (reuseOrg) {
      targetOrgId = organization.id;
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
    const { brandId: newBrandId } = await upsertBrand(brandUrl);
    captureSetupMilestone("brand_upserted", brandStartedAt);
    setLoadStep(2);
    // NOTE: onboarding is marked complete only at the END of the flow (in
    // launch(), after the campaign is created) — NOT here. Marking it complete
    // at brand creation set the edge-gate signal 6 steps early, so a mid-flow
    // refresh / manual dashboard-URL nav slipped past proxy.ts onto a half-set-up
    // dashboard (no rates/personas/consent/campaign). See launch(). (#1770)
    // Extract only the service list before moving forward. The heavier profile,
    // persona, economics and projection work continues after the services step is usable.
    const servicesStartedAt = performance.now();
    const serviceFields = await extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS).catch((e) => {
      console.error("[dashboard] extractBrandFields failed:", e);
      captureSetupMilestone("services_extract_failed", servicesStartedAt);
      setSetupIssues((prev) => ({ ...prev, extraction: true }));
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
      } else {
        setSetupIssues((prev) => ({ ...prev, extraction: true }));
      }
    } else {
      setSetupIssues((prev) => ({ ...prev, extraction: true }));
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
    setError(null);
    setSetupIssues({ extraction: false, persona: false });
    setStep("loading");
    resetLoadingProgress();
    posthog.capture("onboarding_workspace_create_started", { flow: "beta", domain });
    captureSetupMilestone("started");
    try {
      await createBrandAndFetchServices();
      maybeAdvancePastLoading();
    } catch (err) {
      posthog.capture("onboarding_workspace_create_failed", { flow: "beta", domain });
      timers.current.forEach(clearTimeout);
      console.error("[dashboard] onboarding setup failed:", err);
      setError(displaySetupError(err));
      setStep("url");
    }
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
      });
      // Recompute the projection from the rates we just saved (loading-time
      // projection ran on the brand's DEFAULT economics). Best-effort +
      // keep-last-good: only adopt a usable (non-degenerate) refetch.
      try {
        const proj = await getWorkflowProjection({ featureSlug: SALES_FEATURE_SLUG, brandId: id, objective: "self-serve", budgetUsd: PROJECTION_REF_BUDGET });
        const usable = proj.workflows.some(
          (w) => w.costPerCloseUsd != null || (w.projection != null && (w.projection.visits != null || w.projection.closes != null)),
        );
        if (usable) projectionRef.current = proj;
      } catch (e) {
        console.error("[dashboard] onboarding: projection refresh after rates failed:", e);
      }
      setStep("personas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your rates.");
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

  async function completeLaunchAfterWallet(pending: PendingWalletLaunch) {
    if (pending.profile && pending.services) {
      await saveBrandProfileVersion(pending.brandId, {
        ...pending.profile,
        services: pending.services,
        consentedChannels: ["email"],
        agencyConsentAt: new Date().toISOString(),
      });
    }
    await saveBrandDailyBudget(pending.brandId, Math.round(pending.budgetUsd * 100));
    setLaunchStep(2);
    const featureInputs = pending.featureInputs ?? await buildFeatureInputsForLaunch(pending.brandId);
    const { campaign } = await createCampaignWithoutBrandEnrichment({
      name: `${pending.hostname} — ${OUTCOMES.find((o) => o.key === pending.outcome)?.label ?? "Outreach"}`,
      workflowSlug: pending.workflowSlug,
      brandUrls: [pending.brandUrl],
      featureSlug: SALES_FEATURE_SLUG,
      featureInputs,
      maxBudgetDailyUsd: String(pending.budgetUsd),
    });
    setLaunchStep(3);
    posthog.capture("onboarding_completed", {
      flow: "beta",
      outcome: pending.outcome,
      budget: pending.budgetUsd,
      wallet_initial_load_cents: pending.initialLoadCents,
      wallet_topup_amount_cents: pending.topupAmountCents,
      wallet_topup_threshold_cents: pending.topupThresholdCents,
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
    window.sessionStorage.removeItem(WALLET_PENDING_KEY);
    setLaunchStep(4);
    router.push(`/orgs/${pending.orgId}/brands/${pending.brandId}?launched=${campaign.id}`);
  }

  function continueToWallet() {
    const id = brandIdRef.current;
    const orgId = orgIdRef.current;
    const proj = projectionRef.current;
    const budget = derivedBudget();
    if (!id || !orgId || !proj || budget == null) return;
    const workflowSlug = proj.recommendedWorkflowDynastySlug;
    if (!workflowSlug) {
      setError("No outreach workflow is available for this brand yet.");
      return;
    }
    const suggested = String(Math.max(25, budget));
    setWalletBudgetUsd(budget);
    setInitialLoadUsd(suggested);
    setWalletTopupAmountUsd(suggested);
    setWalletTopupThresholdUsd("5");
    setError(null);
    setStep("wallet");
  }

  async function beginWalletCheckout() {
    setBusy(true);
    setError(null);
    try {
      const storedPending = readPendingWalletLaunchOrNull();
      const id = brandIdRef.current ?? storedPending?.brandId ?? null;
      const orgId = orgIdRef.current ?? storedPending?.orgId ?? null;
      const budget = walletBudgetUsd ?? storedPending?.budgetUsd ?? derivedBudget();
      const trimmed = url.trim();
      const normalizedCurrentUrl = trimmed ? (/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`) : null;
      const brandUrl = normalizedCurrentUrl ?? storedPending?.brandUrl ?? null;
      const launchHostname = hostname || storedPending?.hostname || "";
      const launchOutcome = brandIdRef.current ? outcome : storedPending?.outcome ?? outcome;
      if (!id || !orgId || budget == null || !brandUrl || !launchHostname) {
        throw new Error("Wallet setup state is missing. Go back to pricing and try again.");
      }
      const initialLoadCents = dollarsToCentsInput(initialLoadUsd, "Initial load", MIN_INITIAL_LOAD_USD);
      const topupAmountCents = dollarsToCentsInput(walletTopupAmountUsd, "Auto-topup reload amount", MIN_TOPUP_USD);
      const topupThresholdCents = dollarsToCentsInput(walletTopupThresholdUsd, "Auto-topup trigger threshold", MIN_THRESHOLD_USD);
      const workflowSlug = projectionRef.current?.recommendedWorkflowDynastySlug ?? storedPending?.workflowSlug ?? null;
      if (!workflowSlug) {
        throw new Error("Campaign workflow setup is still missing. Please try again.");
      }

      const pending: PendingWalletLaunch = {
        version: 1,
        brandId: id,
        orgId,
        brandUrl,
        hostname: launchHostname,
        outcome: launchOutcome,
        budgetUsd: budget,
        workflowSlug,
        initialLoadCents,
        topupAmountCents,
        topupThresholdCents,
        featureInputs: storedPending?.featureInputs,
        profile: brandIdRef.current === id && normalizedCurrentUrl ? profile : storedPending?.profile,
        services: brandIdRef.current === id && normalizedCurrentUrl ? services : storedPending?.services,
        createdAt: new Date().toISOString(),
      };
      window.sessionStorage.setItem(WALLET_PENDING_KEY, JSON.stringify(pending));

      const successUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      successUrl.searchParams.set("success", "true");
      successUrl.searchParams.set("wallet_setup", "success");
      const cancelUrl = new URL(`${window.location.origin}${window.location.pathname}`);
      cancelUrl.searchParams.set("wallet_setup", "cancelled");

      const session = await createCheckoutSession({
        mode: "setup",
        success_url: successUrl.toString(),
        cancel_url: cancelUrl.toString(),
      });
      window.location.href = session.url;
    } catch (err) {
      posthog.capture("onboarding_launch_failed", { flow: "beta" });
      setError(err instanceof Error ? err.message : "Wallet setup failed. Campaign was not launched.");
      setBusy(false);
    }
  }

  async function resumeWalletCheckout() {
    setBusy(true);
    setError(null);
    try {
      const pending = readPendingWalletLaunch();
      setWalletBudgetUsd(pending.budgetUsd);
      setInitialLoadUsd(String(pending.initialLoadCents / 100));
      setWalletTopupAmountUsd(String(pending.topupAmountCents / 100));
      setWalletTopupThresholdUsd(String(pending.topupThresholdCents / 100));
      setLaunchingBrand({ domain: extractDomain(pending.brandUrl), hostname: pending.hostname });
      setLaunchStep(0);
      setStep("launching");

      setLaunchStep(1);
      await setupBillingWallet({
        initial_load_amount_cents: pending.initialLoadCents,
        topup_amount_cents: pending.topupAmountCents,
        topup_threshold_cents: pending.topupThresholdCents,
      });
      await completeLaunchAfterWallet(pending);
    } catch (err) {
      posthog.capture("onboarding_launch_failed", { flow: "beta", stage: "wallet_return" });
      const detail = err instanceof Error ? err.message : "unknown error";
      setError(`Wallet checkout returned, but setup could not finish: ${detail} Backend support for first-load wallet setup is required; campaign was not launched.`);
      setStep("wallet");
      setBusy(false);
    }
  }

  useEffect(() => {
    const walletSetup = searchParams.get("wallet_setup");
    if (walletResumeStartedRef.current) return;
    if (walletSetup === "success") {
      walletResumeStartedRef.current = true;
      void resumeWalletCheckout();
      return;
    }
    if (walletSetup === "cancelled") {
      walletResumeStartedRef.current = true;
      setBusy(false);
      try {
        const pending = readPendingWalletLaunch();
        setWalletBudgetUsd(pending.budgetUsd);
        setInitialLoadUsd(String(pending.initialLoadCents / 100));
        setWalletTopupAmountUsd(String(pending.topupAmountCents / 100));
        setWalletTopupThresholdUsd(String(pending.topupThresholdCents / 100));
        setStep("wallet");
        setError("Wallet checkout was canceled. Your campaign was not launched; load the org wallet to continue.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Wallet checkout was canceled. Campaign was not launched.");
      }
    }
  }, [searchParams]);

  // ── Per-outcome economics for the budget cards ──────────────────
  // The recommended workflow's funnel projection (counts at PROJECTION_REF_BUDGET).
  function activeProjection() {
    const resp = projectionRef.current;
    if (!resp) return null;
    const rec = resp.recommendedWorkflowDynastySlug
      ? resp.workflows.find((w) => w.workflowDynastySlug === resp.recommendedWorkflowDynastySlug)
      : resp.workflows[0];
    return (rec ?? resp.workflows[0])?.projection ?? null;
  }

  // $ per chosen outcome (budget-invariant): PROJECTION_REF_BUDGET ÷ per-day count.
  function outcomeUnitCost(): number | null {
    const p = activeProjection();
    if (!p) return null;
    const B = PROJECTION_REF_BUDGET;
    if (outcome === "signups") {
      const signupsPerDay = p.visits && p.visits > 0 ? p.visits * (rates.v2s / 100) : 0;
      return signupsPerDay > 0 ? B / signupsPerDay : null;
    }
    return p.meetings && p.meetings > 0 ? B / p.meetings : null;
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

  const card = "min-w-0 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 md:p-12";
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
      <div className={card}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-600">Beta</span>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-gray-950">Pay per outcome,<br />like Google Ads.</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">Drop your product URL and a daily budget. We find your leads, reach out across the best channels on your behalf, and turn them into signups, meetings and sales.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
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
            <div key={f.title} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-100 bg-white text-brand-600">
                <f.Icon className="h-4 w-4" />
              </div>
              <div className="mt-3 text-sm font-semibold text-gray-950">{f.title}</div>
              <div className="mt-1 text-xs leading-5 text-gray-500">{f.desc}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setStep("url")} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
          Get started <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (step === "url") {
    return (
      <div className={card}>
        <h2 className="font-display text-2xl font-bold text-gray-900">What are we promoting?</h2>
        <p className="mt-2 mb-6 text-gray-500">We read your product, find the leads, and run the outreach. Just drop the URL.</p>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <input
          type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="e.g. acme.com" autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && domain) startAnalyze(); }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {url.trim() && !domain && <p className="mt-2 text-sm text-red-500">Please enter a valid URL (e.g. acme.com)</p>}
        <button onClick={startAnalyze} disabled={!domain} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
          Analyze my product <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (step === "loading") {
    const loadingComplete = fetchDoneRef.current || loadStep >= LOADING_STEPS.length;
    return (
      <div className={card}>
        <BrandStepHeader domain={domain} hostname={hostname} />
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
        {!loadingComplete && loadStep >= 2 && <p className="mt-5 text-center text-xs text-gray-400">Service extraction can take a minute for a new domain.</p>}
      </div>
    );
  }

  if (step === "services") {
    return (
      <div className={card}>
        <BrandStepHeader domain={domain} hostname={hostname} />
        <h2 className="font-display text-2xl font-bold text-gray-900">What services do you want to promote with us?</h2>
        <p className="mt-2 mb-6 text-gray-500">We drafted these from <span className="font-medium text-gray-700">{hostname}</span>. Add or remove until the list matches what you sell.</p>
        {setupIssues.extraction && <SetupWarning />}
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
        {services.length === 0 && <p className="mt-2 text-xs text-gray-400">Add at least one service to continue.</p>}
        <NextButton onClick={() => setStep("objective")} disabled={services.length === 0} />
      </div>
    );
  }

  if (step === "objective") {
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("services")} />
        <BrandStepHeader domain={domain} hostname={hostname} />
        <h2 className="font-display text-2xl font-bold text-gray-900">What is your primary sales goal?</h2>
        <p className="mt-2 mb-6 text-gray-500">Pick the one outcome this campaign optimizes for. The budget is shown per this outcome.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {OUTCOMES.map((o) => (
            <ChoiceCard key={o.key} active={outcome === o.key} onClick={() => setOutcome(o.key)} title={o.label} desc={o.desc} />
          ))}
        </div>
        <NextButton onClick={() => setStep("rates")} />
      </div>
    );
  }

  if (step === "rates") {
    const rateKeys = RATE_KEYS_FOR_OUTCOME[outcome];
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("objective")} />
        <BrandStepHeader domain={domain} hostname={hostname} />
        <h2 className="font-display text-2xl font-bold text-gray-900">Your conversion rates.</h2>
        <p className="mt-2 mb-6 text-gray-500">We pre-filled this from your profile. An estimate is fine — tweak anytime.</p>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="space-y-3">
          {rateKeys.map((k) => (
            <div key={k} className="flex flex-col items-stretch gap-4 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{RATE_META[k].label}</div>
                <div className="mt-0.5 text-xs leading-5 text-gray-500">{RATE_META[k].hint}</div>
              </div>
              <div className="flex w-full items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 sm:w-auto sm:shrink-0">
                {RATE_META[k].suffix === "$" && <span className="text-sm text-gray-400">$</span>}
                <input
                  type="text"
                  inputMode="decimal"
                  value={rateText[k]}
                  onChange={(e) => {
                    ratesEditedRef.current = true;
                    launchFeatureInputsRef.current = null;
                    setRateText((t) => ({ ...t, [k]: e.target.value }));
                  }}
                  className="w-full bg-transparent text-right text-sm text-gray-900 focus:outline-none sm:w-20"
                />
                {RATE_META[k].suffix === "%" && <span className="text-sm text-gray-400">%</span>}
              </div>
            </div>
          ))}
        </div>
        <NextButton onClick={saveRatesAndContinue} busy={busy} label="Continue" />
      </div>
    );
  }

  if (step === "personas") {
    return (
      <OnboardingPersonas
        brandId={brandId}
        brandDomain={domain}
        hostname={hostname}
        personaSuggestionFailed={setupIssues.persona}
        personaSeeding={personaSeeding}
        onBack={() => setStep("rates")}
        onContinue={() => setStep("consent")}
      />
    );
  }

  if (step === "consent") {
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("personas")} />
        <BrandStepHeader domain={domain} hostname={hostname} />
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
        <NextButton onClick={() => setStep("pricing")} label="Continue" />
      </div>
    );
  }

  if (step === "launching") {
    const brand = launchingBrand ?? { domain, hostname };
    return (
      <div className={card}>
        <BrandStepHeader domain={brand.domain} hostname={brand.hostname} />
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
      </div>
    );
  }

  if (step === "wallet") {
    const activeBudget = walletBudgetUsd ?? derivedBudget();
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("pricing")} />
        <div className="mb-4 flex items-start gap-2">
          <CreditCardIcon className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-2xl font-bold text-gray-900">Set up your org wallet.</h2>
        </div>
        <p className="text-sm leading-6 text-gray-500">
          Credits live at the organization level and can fund work across brands. The{" "}
          <strong className="font-semibold text-gray-800">
            {activeBudget != null ? `${fmtUsd0(activeBudget)} / day` : "selected"} brand daily budget
          </strong>{" "}
          is only this brand&apos;s daily spend cap.
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <GiftIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <p className="text-sm leading-6 text-brand-800">
            <strong>Your first load is matched dollar-for-dollar up to $25 free.</strong> Load the
            org wallet now, then auto-topup keeps the campaign from stopping when the balance runs low.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">Initial load amount</label>
            <div className="mt-1 flex items-center rounded-xl border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-brand-300">
              <span className="text-sm text-gray-400">$</span>
              <input
                type="number"
                min={MIN_INITIAL_LOAD_USD}
                step="1"
                value={initialLoadUsd}
                onChange={(e) => setInitialLoadUsd(e.target.value)}
                className="w-full bg-transparent px-2 text-sm text-gray-900 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              Stripe securely saves your card first, then the org wallet is loaded and matched after checkout.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-900">Auto-topup trigger threshold</label>
              <div className="mt-1 flex items-center rounded-xl border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-brand-300">
                <span className="text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min={MIN_THRESHOLD_USD}
                  step="1"
                  value={walletTopupThresholdUsd}
                  onChange={(e) => setWalletTopupThresholdUsd(e.target.value)}
                  className="w-full bg-transparent px-2 text-sm text-gray-900 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900">Auto-topup reload amount</label>
              <div className="mt-1 flex items-center rounded-xl border border-gray-200 px-3 py-2 focus-within:ring-2 focus-within:ring-brand-300">
                <span className="text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min={MIN_TOPUP_USD}
                  step="1"
                  value={walletTopupAmountUsd}
                  onChange={(e) => setWalletTopupAmountUsd(e.target.value)}
                  className="w-full bg-transparent px-2 text-sm text-gray-900 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
          Auto-topup is required for the campaign to continue running. You can pause the campaign at any time.
        </p>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <button
          onClick={beginWalletCheckout}
          disabled={busy || activeBudget == null}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Finishing wallet setup…
            </>
          ) : (
            <>
              Load wallet & launch campaign <CursorArrowRaysIcon className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    );
  }

  // pricing — outcome-count budget
  const unitCost = outcomeUnitCost();
  const selectedBudget = derivedBudget();
  return (
    <div className={card}>
      <BackButton onClick={() => setStep("consent")} />
      <BrandStepHeader domain={domain} hostname={hostname} />
      <h2 className="font-display text-2xl font-bold text-gray-900">Your monthly target.</h2>
      <p className="mt-2 mb-5 text-gray-500">Pick how many <strong>{outcomeMeta.unit}</strong> you want each month — we set the daily budget to hit it.</p>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <CreditCardIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <p className="text-sm leading-6 text-brand-800">
          This is the <strong>brand daily budget cap</strong>. Next you&apos;ll load the org wallet
          and set auto-topup so the campaign can keep running.
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
          const customN = Number(customCount);
          const isCustom = customCount !== "" && customN > 0;
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
                type="number"
                min={1}
                value={customCount}
                onChange={(e) => {
                  setCustomCount(e.target.value);
                  const v = Number(e.target.value);
                  setSelectedCount(v > 0 ? v : null);
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

      <button onClick={continueToWallet} disabled={busy || selectedBudget == null} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
        Continue to wallet setup <ArrowRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Personas step — server-backed (mirrors the Customer Personas page) ──────
// The brand exists by now (created during loading) and the AI-suggested persona
// was already persisted, so this reads/writes live personas: PersonaCard with the
// save lifecycle + an Edit-with-AI chat.
let obDraftSeq = 0;
const nextDraftId = () => `ob-draft-${++obDraftSeq}`;

function OnboardingPersonas({
  brandId,
  brandDomain,
  hostname,
  personaSuggestionFailed,
  personaSeeding,
  onBack,
  onContinue,
}: {
  brandId: string | null;
  brandDomain: string | null;
  hostname: string;
  personaSuggestionFailed: boolean;
  personaSeeding: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Persona[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const requestedAvatarIds = useRef<Set<string>>(new Set());

  const { data, isPending } = useAuthQuery(
    ["personas", brandId ?? ""],
    () => listPersonas(brandId as string),
    { enabled: !!brandId },
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["personas", brandId ?? ""] });
  const createMut = useMutation({
    mutationFn: (i: { name: string; filters: Filters }) =>
      createPersona(brandId as string, { name: i.name, filters: i.filters as Record<string, string[]> }),
    onSuccess: invalidate,
  });
  const {
    mutate: regenerateAvatar,
    isPending: avatarRegenerating,
    variables: regeneratingAvatarId,
  } = useMutation({
    mutationFn: (personaId: string) => regeneratePersonaAvatar(brandId as string, personaId),
    onSuccess: invalidate,
  });

  const serverPersonas: Persona[] = (data?.personas ?? [])
    .filter((p) => p.status !== "archived")
    .map((p) => ({ id: p.id, name: p.name, filters: p.filters, status: p.status, avatarUrl: p.avatarUrl ?? null }));
  const personas: Persona[] = [...drafts, ...serverPersonas];
  const missingAvatarId = serverPersonas.find((p) => !p.avatarUrl && !requestedAvatarIds.current.has(p.id))?.id;

  useEffect(() => {
    if (!missingAvatarId || avatarRegenerating) return;
    requestedAvatarIds.current.add(missingAvatarId);
    regenerateAvatar(missingAvatarId);
  }, [missingAvatarId, avatarRegenerating, regenerateAvatar]);

  const isNameTaken = (name: string, exceptId?: string) => {
    const needle = name.trim().toLowerCase();
    return personas.some((p) => p.id !== exceptId && p.name.trim().toLowerCase() === needle);
  };
  const uniqueName = (base: string) => {
    const trimmed = base.trim() || "Persona";
    if (!isNameTaken(trimmed)) return trimmed;
    for (let i = 2; ; i++) {
      const candidate = `${trimmed} ${i}`;
      if (!isNameTaken(candidate)) return candidate;
    }
  };
  const addPersona = () => setDrafts((prev) => [{ id: nextDraftId(), name: uniqueName("New Persona"), filters: {}, status: "active", unsaved: true }, ...prev]);
  const removeDraft = (id: string) => setDrafts((prev) => prev.filter((p) => p.id !== id));
  const commitNew = (id: string, name: string, filters: Filters) =>
    createMut.mutate({ name: capWords(name), filters }, { onSuccess: () => removeDraft(id) });
  const saveAsNew = (name: string, filters: Filters) => createMut.mutate({ name: capWords(name), filters });
  const card = "min-w-0 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 md:p-12";
  return (
    <div className={card}>
      <BackButton onClick={onBack} />
      <BrandStepHeader domain={brandDomain} hostname={hostname} />
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-gray-900">Who do you want to sell to?</h2>
          <p className="mt-2 text-gray-500">We drafted your main persona. Edit the targeting filters, add another, or ask AI.</p>
        </div>
        <button
          type="button"
          onClick={() => brandId && setAiOpen(true)}
          disabled={!brandId}
          className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700 transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50 sm:w-auto"
        >
          <SparklesIcon className="h-4 w-4" /> Edit with AI
        </button>
      </div>
      {personaSuggestionFailed && <SetupWarning className="mt-4" />}

      <div className="mt-6 space-y-3">
        {(isPending || personaSeeding) && personas.length === 0 ? (
          <div className="flex h-56 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-400">
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            Drafting your first persona...
          </div>
        ) : personas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">No personas yet.</div>
        ) : (
          personas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onSaveAsNew={(name, filters) => saveAsNew(name, filters)}
              onCommitNew={(name, filters) => commitNew(persona.id, name, filters)}
              onCancelNew={() => removeDraft(persona.id)}
              showLifecycleActions={false}
              onRegenerateAvatar={!persona.unsaved ? () => regenerateAvatar(persona.id) : undefined}
              regeneratingAvatar={avatarRegenerating && regeneratingAvatarId === persona.id}
              checkNameTaken={(n) => isNameTaken(n, persona.unsaved ? persona.id : undefined)}
            />
          ))
        )}
      </div>

      <button onClick={addPersona} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <PlusIcon className="h-4 w-4" /> Add a persona
      </button>
      <NextButton onClick={onContinue} label="Continue" />

      {brandId && (
        <EditWithAIChat
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          title="Edit personas with AI"
          intro="Hi — I can create, duplicate and refine your personas. What would you like to change?"
          suggestions={["Add a persona for mid-market RevOps leaders", "Narrow the main persona to Series A+ SaaS", "Add fintech founders in the US"]}
          configKey="persona-editor"
          brandId={brandId}
          sessionVersion="live-context-v1"
          context={{
            personaCount: personas.length,
            activePersonaCount: personas.filter((p) => p.status !== "archived").length,
            personas: personas.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
              filters: p.filters,
              persisted: !p.unsaved,
            })),
          }}
          invalidateKeys={[["personas", brandId]]}
        />
      )}
    </div>
  );
}

function BrandStepHeader({ domain, hostname }: { domain: string | null; hostname: string }) {
  const label = domain ?? hostname;
  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
        <BrandLogo
          domain={label}
          size={28}
          className="h-7 w-7 rounded-md object-contain"
          fallbackClassName="h-5 w-5 text-gray-400"
        />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Brand</div>
        <div className="truncate text-sm font-semibold text-gray-900">{label}</div>
      </div>
    </div>
  );
}

function SetupWarning({ className = "mb-4" }: { className?: string }) {
  return (
    <div className={`${className} rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800`}>
      {GENERIC_AI_SETUP_ERROR}
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
