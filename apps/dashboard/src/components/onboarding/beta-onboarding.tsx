"use client";

import { useEffect, useRef, useState } from "react";
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
  CursorArrowRaysIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  DevicePhoneMobileIcon,
  UserGroupIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
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
  getWorkflowProjection,
  getFeature,
  prefillFeatureInputs,
  prefillToStringMap,
  createCampaign,
  type EffectiveSalesEconomics,
  type WorkflowProjectionResponse,
  type PersonaDraft,
  type FeatureInput,
} from "@/lib/api";
import { extractDomain } from "@/lib/extract-domain";
import { type Filters } from "@/lib/mock-personas";
import { PersonaCard } from "@/components/personas/persona-card";
import { SECTIONS, FieldEditor, type ProfileFields } from "@/components/brand-profile/field-editor";

/**
 * Beta onboarding (allowlist only — see `beta-allowlist.ts`). A guided flow ported
 * from the app.distribute.you mockup: welcome → URL → an ANIMATED build sequence that
 * runs WHILE the brand is created AND its profile / personas / economics / pricing
 * projection are fetched for real → objective → funnels → conversion rates → review
 * AI-proposed personas → review brand profile → agency-channel consent → per-outcome
 * pricing → launches a real campaign. Everything is wired to live endpoints; the only
 * client-only concept is the "Coming soon" channels (only cold email delivers today).
 */

const SALES_FEATURE_SLUG = "sales-cold-email-outreach";
const PROJECTION_REF_BUDGET = 100; // counts come back at this budget; unit costs are budget-invariant

type Step =
  | "welcome"
  | "url"
  | "loading"
  | "objective"
  | "rates"
  | "personas"
  | "profile"
  | "consent"
  | "pricing";

// The six outcomes the user can maximize (Kevin's list). Each maps to a projection
// count so the pricing cards show the chosen unit, never "closes".
type Outcome =
  | "page-visits"
  | "signups"
  | "purchases"
  | "conversations"
  | "meetings"
  | "sales-revenue";
const OUTCOMES: { key: Outcome; label: string; unit: string; desc: string }[] = [
  { key: "page-visits", label: "Page visits", unit: "visits", desc: "Maximize qualified traffic to your site." },
  { key: "signups", label: "Signups", unit: "signups", desc: "Maximize free signups / trial starts." },
  { key: "purchases", label: "Purchases", unit: "purchases", desc: "Maximize paying customers." },
  { key: "conversations", label: "Conversations", unit: "conversations", desc: "Maximize replies from interested prospects." },
  { key: "meetings", label: "Sales meetings", unit: "meetings", desc: "Maximize booked sales meetings." },
  { key: "sales-revenue", label: "Overall $ of sales", unit: "revenue", desc: "Maximize total sales revenue." },
];

// Only two funnels are offered (Kevin): Website Purchase + Sales Meeting.
type Funnel = "website-purchases" | "sales-meetings";
const FUNNELS: { key: Funnel; label: string; desc: string }[] = [
  { key: "website-purchases", label: "Website Purchase", desc: "Visitors buy directly on your site." },
  { key: "sales-meetings", label: "Sales Meeting", desc: "Replies turn into booked sales meetings." },
];

type RateKey = "ltv" | "v2s" | "s2c" | "v2m" | "r2m" | "m2c";
const RATE_META: Record<RateKey, { label: string; suffix: "$" | "%"; hint: string }> = {
  ltv: { label: "Lifetime revenue / paid client", suffix: "$", hint: "Average revenue a customer brings over their lifetime." },
  v2s: { label: "Website visit → signup", suffix: "%", hint: "Of visitors who land on your site, how many sign up." },
  s2c: { label: "Signup → paid client", suffix: "%", hint: "Of signups, how many become paying customers." },
  v2m: { label: "Website visit → meeting", suffix: "%", hint: "Of visitors, how many book a meeting." },
  r2m: { label: "Positive reply → meeting booked", suffix: "%", hint: "Of positive replies, how many book a meeting." },
  m2c: { label: "Meeting booked → close won", suffix: "%", hint: "Of booked meetings, how many close." },
};

// Ask only the rates the chosen funnels need (+ ltv for revenue).
function ratesNeeded(funnels: Set<Funnel>): RateKey[] {
  const out: RateKey[] = ["ltv"];
  if (funnels.has("website-purchases")) out.push("v2s", "s2c");
  if (funnels.has("sales-meetings")) out.push("r2m", "m2c");
  return out;
}

// ── Rate-input formatting ────────────────────────────────────────────
// Number fields render as TEXT (not <input type="number">) so we can show
// thousands separators ("2,500"), allow decimals ("0.5"), and reformat each
// keystroke — which also kills the leading-zero bug (typing over "0" → "1",
// never "01"). The numeric value is parsed back out for persistence.
function groupInt(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Sanitize a raw input string → { display text, numeric value }.
function formatRateInput(raw: string): { text: string; value: number } {
  let s = raw.replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    // keep only the first dot
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  if (s === "") return { text: "", value: 0 };
  const [intPart, decPart] = s.split(".");
  let intClean = intPart.replace(/^0+(?=\d)/, ""); // strip leading zeros (keep one)
  if (intClean === "") intClean = "0";
  const grouped = groupInt(intClean);
  const text = decPart !== undefined ? `${grouped}.${decPart}` : grouped;
  const value = parseFloat(`${intClean}.${decPart ?? ""}`.replace(/\.$/, "")) || 0;
  return { text, value };
}

// Format a stored numeric rate as the initial display text (comma-grouped).
function rateToText(n: number): string {
  if (!isFinite(n)) return "";
  const [intPart, decPart] = String(n).split(".");
  const grouped = groupInt(intPart);
  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
}
function ratesToText(r: Record<RateKey, number>): Record<RateKey, string> {
  return Object.fromEntries(
    (Object.keys(r) as RateKey[]).map((k) => [k, rateToText(r[k])]),
  ) as Record<RateKey, string>;
}

// Outreach channels. Cold email is the only one that delivers today; the rest are
// captured as intent (badged "Coming soon"). Email is locked ON.
type Channel = "email" | "linkedin" | "whatsapp" | "telegram" | "sms" | "referral";
const CHANNELS: { key: Channel; label: string; icon: typeof EnvelopeIcon; live: boolean }[] = [
  { key: "email", label: "Cold email", icon: EnvelopeIcon, live: true },
  { key: "linkedin", label: "LinkedIn DM", icon: UserGroupIcon, live: false },
  { key: "whatsapp", label: "WhatsApp messages", icon: ChatBubbleLeftRightIcon, live: false },
  { key: "telegram", label: "Telegram messages", icon: PaperAirplaneIcon, live: false },
  { key: "sms", label: "SMS", icon: DevicePhoneMobileIcon, live: false },
  { key: "referral", label: "Referral agent", icon: UserGroupIcon, live: false },
];

// The five agency-model benefits (landing how-it-works "Sent on your behalf").
const AGENCY_BENEFITS = [
  "Zero reputation risk — your domain never touches cold outreach.",
  "Zero setup — no DNS, SPF/DKIM, warming or mailboxes on your side.",
  "Zero inbox to babysit — we screen replies and forward the positive ones.",
  "Full CRM visibility — you keep the whole view, nothing hidden.",
  "Test demand before revealing your brand on niche markets.",
];

const LOADING_STEPS = [
  { id: "ls-1", label: "Reading your product", delay: 1400 },
  { id: "ls-2", label: "Extracting your ICP and personas", delay: 1600 },
  { id: "ls-3", label: "Selecting outreach strategy", delay: 1400 },
  { id: "ls-4", label: "Projecting your economics", delay: 1400 },
];

type EditablePersona = { id: string; name: string; filters: Filters };
let personaSeq = 0;
const nextPersonaId = () => `ob-persona-${++personaSeq}`;

const fmtUsd0 = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const fmtCount = (n: number) => Math.round(n).toLocaleString("en-US");

export function BetaOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const { createOrganization, setActive } = useOrganizationList();
  const { session } = useSession();
  const forceNew = searchParams.get("new") === "1";

  const [step, setStep] = useState<Step>("welcome");
  const [url, setUrl] = useState(searchParams.get("url")?.trim() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [outcome, setOutcome] = useState<Outcome>("purchases");
  const [funnels, setFunnels] = useState<Set<Funnel>>(
    () => new Set<Funnel>(["website-purchases", "sales-meetings"]),
  );
  const [rates, setRates] = useState<Record<RateKey, number>>({ ltv: 2500, v2s: 5, s2c: 10, v2m: 3, r2m: 30, m2c: 25 });
  // Display strings for the rate inputs (comma-grouped, decimals preserved).
  const [rateText, setRateText] = useState<Record<RateKey, string>>(() =>
    ratesToText({ ltv: 2500, v2s: 5, s2c: 10, v2m: 3, r2m: 30, m2c: 25 }),
  );
  const [personas, setPersonas] = useState<EditablePersona[]>([]);
  const [profile, setProfile] = useState<Record<string, string | string[]>>({});
  const [channels, setChannels] = useState<Set<Channel>>(() => new Set<Channel>(["email"]));
  const [budget, setBudget] = useState<number | null>(null);

  // Loading-sequence + real fetch coordination. We only advance past the loader once
  // BOTH the animation finished AND the brand exists + its data is fetched.
  const [loadStep, setLoadStep] = useState(0);
  const [loadDone, setLoadDone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const brandIdRef = useRef<string | null>(null);
  const orgIdRef = useRef<string | null>(null);
  const fetchDoneRef = useRef(false);
  const animDoneRef = useRef(false);

  const projectionRef = useRef<WorkflowProjectionResponse | null>(null);
  const econRef = useRef<EffectiveSalesEconomics | null>(null);
  // The sales feature's declared input definitions — needed to build the
  // `featureInputs` map the /campaigns create endpoint requires at launch.
  const salesInputsRef = useRef<FeatureInput[]>([]);

  const domain = extractDomain(url);
  const hostname = domain ?? url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  useEffect(() => {
    posthog.capture("onboarding_step_viewed", { step, flow: "beta" });
  }, [step]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function toggleFunnel(key: Funnel) {
    setFunnels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleChannel(key: Channel) {
    if (key === "email") return; // locked on
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function maybeAdvancePastLoading() {
    if (animDoneRef.current && fetchDoneRef.current) setStep("objective");
  }

  function runLoadingAnimation() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLoadDone(false);
    setLoadStep(0);
    animDoneRef.current = false;
    let elapsed = 0;
    LOADING_STEPS.forEach((s, i) => {
      const t = setTimeout(() => setLoadStep(i), elapsed);
      timers.current.push(t);
      elapsed += s.delay;
    });
    const last = setTimeout(() => {
      setLoadStep(LOADING_STEPS.length - 1);
      setLoadDone(true);
      animDoneRef.current = true;
      maybeAdvancePastLoading();
    }, elapsed);
    timers.current.push(last);
  }

  // Create the brand for real, then fetch everything the later steps render.
  async function createBrandAndFetch(): Promise<void> {
    const trimmed = url.trim();
    const brandUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
    const { brandId } = await upsertBrand(brandUrl);
    await fetch("/api/onboarding/complete", { method: "POST" }).catch((e) =>
      console.error("[dashboard] failed to mark onboarding complete:", e),
    );
    await session?.getToken({ skipCache: true }).catch(() => {});
    // Extract brand fields (populates the brand profile), then fetch everything.
    await extractBrandFields([brandId], SALES_PROFILE_FIELDS).catch((e) =>
      console.error("[dashboard] extractBrandFields failed:", e),
    );
    brandIdRef.current = brandId;
    orgIdRef.current = targetOrgId;
    posthog.capture("onboarding_brand_created", { flow: "beta", org_id: targetOrgId, brand_id: brandId });

    const [prof, econRes, sug, proj, feat] = await Promise.all([
      getBrandProfile(brandId),
      getSalesEconomicsEffective(brandId),
      suggestPersonas(brandId, 3),
      getWorkflowProjection({ featureSlug: SALES_FEATURE_SLUG, brandId, objective: "self-serve", budgetUsd: PROJECTION_REF_BUDGET }),
      getFeature(SALES_FEATURE_SLUG),
    ]);

    salesInputsRef.current = feat.feature.inputs ?? [];
    if (prof.current) setProfile(prof.current.fields);
    if (econRes.economics) {
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
      setRateText(ratesToText(loaded));
    }
    setPersonas(sug.personas.map((p: PersonaDraft) => ({ id: nextPersonaId(), name: p.name, filters: p.filters as Filters })));
    projectionRef.current = proj;
    if (proj.recommendedBudgetUsd && proj.recommendedBudgetUsd > 0) {
      setBudget(Math.round(proj.recommendedBudgetUsd));
    }
    fetchDoneRef.current = true;
  }

  async function startAnalyze() {
    if (!domain) return;
    setError(null);
    setStep("loading");
    runLoadingAnimation();
    posthog.capture("onboarding_workspace_create_started", { flow: "beta", domain });
    try {
      await createBrandAndFetch();
      maybeAdvancePastLoading();
    } catch (err) {
      posthog.capture("onboarding_workspace_create_failed", { flow: "beta", domain });
      timers.current.forEach(clearTimeout);
      setError(err instanceof Error ? err.message : "Setup failed. Please try again.");
      setStep("url");
    }
  }

  // ── Step transitions that persist ────────────────────────────────
  async function saveRatesAndContinue() {
    const brandId = brandIdRef.current;
    if (!brandId) return;
    setBusy(true);
    try {
      await saveBrandSalesEconomics(brandId, {
        lifetimeRevenueUsd: rates.ltv,
        replyToMeetingPct: rates.r2m,
        visitToMeetingPct: rates.v2m,
        meetingToClosePct: rates.m2c,
        visitToSignupPct: rates.v2s,
        signupToPaidClientPct: rates.s2c,
      });
      // Recompute the projection from the rates we just saved. The loading-time
      // projection ran on the brand's DEFAULT economics (this step comes after
      // loading), which left the pricing recommended budget + per-outcome counts
      // stale ($1/day, ~0 signups). Server reads econ from saved sales-economics,
      // so refetch now. Best-effort: a failure must not block the flow (econ is
      // already persisted; pricing falls back to the prior projection).
      try {
        const proj = await getWorkflowProjection({ featureSlug: SALES_FEATURE_SLUG, brandId, objective: "self-serve", budgetUsd: PROJECTION_REF_BUDGET });
        // Keep-last-good: only adopt the refreshed projection if it's usable — the
        // cold Neon chain can return a valid-but-degenerate 200 (null unit costs /
        // counts). Don't let a double-cold refetch overwrite a usable loading value.
        const usable = proj.workflows.some(
          (w) => w.costPerCloseUsd != null || (w.projection != null && (w.projection.visits != null || w.projection.closes != null)),
        );
        if (usable) {
          projectionRef.current = proj;
          if (proj.recommendedBudgetUsd && proj.recommendedBudgetUsd > 0) setBudget(Math.round(proj.recommendedBudgetUsd));
        }
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

  async function savePersonasAndContinue() {
    const brandId = brandIdRef.current;
    if (!brandId) return;
    setBusy(true);
    try {
      // Persist each kept persona draft. Names are unique per brand; a 409 on an
      // accidental dup is non-fatal here (skip it, keep going).
      for (const p of personas) {
        if (!p.name.trim()) continue;
        await createPersona(brandId, { name: p.name.trim(), filters: p.filters as Record<string, string[]> }).catch((e) =>
          console.error("[dashboard] createPersona (onboarding) failed:", e),
        );
      }
      setStep("profile");
    } finally {
      setBusy(false);
    }
  }

  async function launch() {
    const brandId = brandIdRef.current;
    const orgId = orgIdRef.current;
    const proj = projectionRef.current;
    if (!brandId || !orgId || !proj || budget == null) return;
    const workflowSlug = proj.recommendedWorkflowDynastySlug;
    if (!workflowSlug) {
      setError("No outreach workflow is available for this brand yet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Persist the brand profile edits + the channel consent in one version.
      const trimmed = url.trim();
      const brandUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      await saveBrandProfileVersion(brandId, {
        ...profile,
        consentedChannels: Array.from(channels),
        agencyConsentAt: new Date().toISOString(),
      });
      // The /campaigns endpoint requires `featureInputs` — the feature's declared
      // inputs filled from the (now-saved) brand profile. Mirror campaigns/new:
      // prefill the values, then map them onto the feature's declared input keys.
      const prefilled = prefillToStringMap(
        (await prefillFeatureInputs(SALES_FEATURE_SLUG, [brandId])).prefilled,
      );
      const featureInputs: Record<string, string> = {};
      for (const input of salesInputsRef.current) {
        const val = prefilled[input.key]?.trim();
        if (val) featureInputs[input.key] = val;
      }
      const { campaign } = await createCampaign({
        name: `${hostname} — ${OUTCOMES.find((o) => o.key === outcome)?.label ?? "Outreach"}`,
        workflowSlug,
        brandUrls: [brandUrl],
        featureSlug: SALES_FEATURE_SLUG,
        featureInputs,
        maxBudgetDailyUsd: String(budget),
      });
      posthog.capture("onboarding_completed", { flow: "beta", outcome, budget });
      router.push(`/orgs/${orgId}/brands/${brandId}/campaigns/${campaign.id}`);
    } catch (err) {
      posthog.capture("onboarding_launch_failed", { flow: "beta" });
      setError(err instanceof Error ? err.message : "Launch failed. Please try again.");
      setBusy(false);
    }
  }

  // ── Per-outcome economics for the pricing cards ──────────────────
  // All counts are objective-agnostic; we derive each outcome's cost-per-unit from
  // the ONE projection fetched at PROJECTION_REF_BUDGET (budget-invariant), exactly
  // like campaigns/new. signups are derived from visits × visit→signup rate.
  // The recommended workflow's funnel projection (counts at PROJECTION_REF_BUDGET).
  function activeProjection() {
    const resp = projectionRef.current;
    if (!resp) return null;
    const rec = resp.recommendedWorkflowDynastySlug
      ? resp.workflows.find((w) => w.workflowDynastySlug === resp.recommendedWorkflowDynastySlug)
      : resp.workflows[0];
    return (rec ?? resp.workflows[0])?.projection ?? null;
  }

  function outcomeUnitCost(): number | null {
    const p = activeProjection();
    if (!p) return null;
    const B = PROJECTION_REF_BUDGET;
    const per = (count: number | null | undefined) =>
      count && count > 0 ? B / count : null;
    switch (outcome) {
      case "page-visits": return per(p.visits);
      case "signups": return p.visits && p.visits > 0 ? B / (p.visits * (rates.v2s / 100)) : null;
      case "purchases": return per(p.closes);
      case "conversations": return per(p.replies);
      case "meetings": return per(p.meetings);
      case "sales-revenue": return null; // revenue shows ROI instead of a unit cost
    }
  }
  function revenuePerDollar(): number | null {
    const p = activeProjection();
    if (!p?.revenue || p.revenue <= 0) return null;
    return p.revenue / PROJECTION_REF_BUDGET;
  }

  const neededRates = ratesNeeded(funnels);
  const card = "bg-white rounded-2xl border border-gray-200 p-8 md:p-12";
  const outcomeMeta = OUTCOMES.find((o) => o.key === outcome)!;

  // ── Step renders ─────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <div className={card}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-600">Beta</span>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-gray-950">Pay per outcome,<br />like Google Ads.</h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">Drop your product URL and a daily budget. We find your leads, reach out across the best channels on your behalf, and turn them into signups, meetings and sales.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            { v: "~$15", l: "/ signup" },
            { v: "~$90", l: "/ meeting" },
            { v: "~$120", l: "/ purchase" },
          ].map((f) => (
            <div key={f.l} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-2xl font-bold text-gray-950">{f.v}</div>
              <div className="mt-1 text-xs text-gray-500">{f.l}</div>
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
    return (
      <div className={card}>
        <div className="mb-2 text-center text-lg font-semibold text-gray-950">{loadDone ? "Your strategy is ready." : "Building your strategy…"}</div>
        <p className="mb-6 text-center text-sm text-gray-500">Reading <span className="font-medium text-gray-700">{hostname}</span></p>
        <div className="space-y-2">
          {LOADING_STEPS.map((s, i) => {
            const isDone = (loadDone && fetchDoneRef.current) || i < loadStep;
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
        {loadDone && !fetchDoneRef.current && <p className="mt-5 text-center text-xs text-gray-400">Finishing setup…</p>}
      </div>
    );
  }

  if (step === "objective") {
    return (
      <div className={card}>
        <h2 className="font-display text-2xl font-bold text-gray-900">What do you want to maximize?</h2>
        <p className="mt-2 mb-6 text-gray-500">Pick the one outcome this campaign optimizes for. The pricing is shown per this outcome.</p>
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
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("objective")} />
        <h2 className="font-display text-2xl font-bold text-gray-900">Your conversion rates.</h2>
        <p className="mt-2 mb-6 text-gray-500">We pre-filled these from your profile. Estimates are fine — tweak anytime.</p>
        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Sales funnels — drives which rates we ask for below. */}
        <div className="mb-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Which sales funnels do you use?</div>
          <div className="space-y-2">
            {FUNNELS.map((f) => (
              <ChoiceCard key={f.key} active={funnels.has(f.key)} onClick={() => toggleFunnel(f.key)} title={f.label} desc={f.desc} check />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {neededRates.map((k) => (
            <div key={k} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{RATE_META[k].label}</div>
                <div className="mt-0.5 text-xs text-gray-500">{RATE_META[k].hint}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2 py-1">
                {RATE_META[k].suffix === "$" && <span className="text-sm text-gray-400">$</span>}
                <input
                  type="text"
                  inputMode="decimal"
                  value={rateText[k]}
                  onChange={(e) => {
                    const { text, value } = formatRateInput(e.target.value);
                    setRateText((t) => ({ ...t, [k]: text }));
                    setRates((r) => ({ ...r, [k]: value }));
                  }}
                  className="w-20 bg-transparent text-right text-sm text-gray-900 focus:outline-none"
                />
                {RATE_META[k].suffix === "%" && <span className="text-sm text-gray-400">%</span>}
              </div>
            </div>
          ))}
        </div>
        <NextButton onClick={saveRatesAndContinue} busy={busy} disabled={funnels.size === 0} label="Continue" />
      </div>
    );
  }

  if (step === "personas") {
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("rates")} />
        <h2 className="font-display text-2xl font-bold text-gray-900">Your target personas.</h2>
        <p className="mt-2 mb-6 text-gray-500">We drafted these from your product. Edit the name and targeting filters — or add another.</p>
        <div className="space-y-3">
          {personas.map((p) => (
            <PersonaCard
              key={p.id}
              persona={{ id: p.id, name: p.name, filters: p.filters, status: "active", unsaved: true }}
              onChange={(name, filters) => setPersonas((ps) => ps.map((x) => x.id === p.id ? { ...x, name, filters } : x))}
              onRemove={() => setPersonas((ps) => ps.filter((x) => x.id !== p.id))}
            />
          ))}
        </div>
        <button onClick={() => setPersonas((ps) => [...ps, { id: nextPersonaId(), name: "", filters: {} }])} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
          <PlusIcon className="h-4 w-4" /> Add a persona
        </button>
        <NextButton onClick={savePersonasAndContinue} busy={busy} label="Continue" />
      </div>
    );
  }

  if (step === "profile") {
    // Same inline-edit UX as the Brand Profile page: text shows as read view,
    // click to edit; list fields are chip editors. Edits write back to `profile`,
    // persisted at launch via saveBrandProfileVersion.
    const setText = (key: string, value: string) =>
      setProfile((pr) => ({ ...pr, [key]: value }));
    const addItem = (key: string, raw: string) => {
      const value = raw.trim();
      if (!value) return;
      setProfile((pr) => {
        const arr = Array.isArray(pr[key]) ? (pr[key] as string[]) : [];
        if (arr.some((v) => v.toLowerCase() === value.toLowerCase())) return pr;
        return { ...pr, [key]: [...arr, value] };
      });
    };
    const removeItem = (key: string, value: string) =>
      setProfile((pr) => {
        const arr = Array.isArray(pr[key]) ? (pr[key] as string[]) : [];
        return { ...pr, [key]: arr.filter((v) => v !== value) };
      });
    const fields = profile as ProfileFields;
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("personas")} />
        <h2 className="font-display text-2xl font-bold text-gray-900">Your brand profile.</h2>
        <p className="mt-2 mb-6 text-gray-500">We read <span className="font-medium text-gray-700">{hostname}</span> and drafted this. Click any field to edit before we write your outreach.</p>
        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">{section.title}</h3>
              <div className="space-y-5">
                {section.fields.map((field) => (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    value={fields[field.key]}
                    onText={(v) => setText(field.key, v)}
                    onAdd={(v) => addItem(field.key, v)}
                    onRemove={(v) => removeItem(field.key, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <NextButton onClick={() => setStep("consent")} label="Continue" />
      </div>
    );
  }

  if (step === "consent") {
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("profile")} />
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-brand-600" />
          <h2 className="font-display text-2xl font-bold text-gray-900">We reach out on your behalf.</h2>
        </div>
        <p className="mb-4 text-sm leading-6 text-gray-500">distribute is a marketing agency. All outreach goes out from inboxes and domains <strong>we own and warm</strong> — never from yours, like a PR firm pitching from its own contacts.</p>
        <ul className="mb-6 space-y-1.5">
          {AGENCY_BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-xs leading-5 text-gray-600"><CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{b}</li>
          ))}
        </ul>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Channels we may use on your behalf</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((c) => {
            const on = channels.has(c.key);
            return (
              <button key={c.key} onClick={() => toggleChannel(c.key)} disabled={c.key === "email"}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition ${on ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"} ${c.key === "email" ? "cursor-default" : ""}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${on ? "bg-brand-100 text-brand-600" : "bg-gray-100 text-gray-400"}`}><c.icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-900">{c.label}</span>
                  {c.key === "email" ? <span className="text-[11px] text-gray-400">Always on</span> : !c.live && <span className="text-[11px] text-amber-600">Coming soon</span>}
                </span>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"}`}>{on && <CheckIcon className="h-3 w-3" />}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] leading-5 text-gray-400">By continuing you authorize distribute to contact prospects on your behalf, representing your brand, per our <a href="https://distribute.you/terms" target="_blank" rel="noreferrer" className="underline">Terms</a>.</p>
        <NextButton onClick={() => setStep("pricing")} label="Continue" />
      </div>
    );
  }

  // pricing
  const unitCost = outcomeUnitCost();
  const rpd = revenuePerDollar();
  const recommended = budget ?? (projectionRef.current?.recommendedBudgetUsd ? Math.round(projectionRef.current.recommendedBudgetUsd) : 30);
  const tiers = [Math.max(5, Math.round(recommended * 0.5)), recommended, recommended * 2];
  const tierLabels = ["Starter", "Recommended", "Growth"];
  return (
    <div className={card}>
      <BackButton onClick={() => setStep("consent")} />
      <h2 className="font-display text-2xl font-bold text-gray-900">Your daily budget.</h2>
      <p className="mt-2 mb-6 text-gray-500">Maximizing <strong>{outcomeMeta.label}</strong>. Pick a daily budget — we project {outcomeMeta.unit} per month.</p>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        {tiers.map((b, i) => {
          const perMonth = outcome === "sales-revenue"
            ? (rpd != null ? rpd * b * 30 : null)
            : (unitCost != null ? (b * 30) / unitCost : null);
          return (
            <button key={i} onClick={() => setBudget(b)} className={`rounded-xl border-2 p-4 text-left transition ${budget === b ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
              {i === 1 ? <div className="mb-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">Recommended ★</div> : <div className="mb-1 text-xs font-semibold text-gray-500">{tierLabels[i]}</div>}
              <div className="text-xl font-bold text-gray-950">{fmtUsd0(b)} <span className="text-xs font-normal text-gray-400">/ day</span></div>
              <div className="mt-1 text-xs text-gray-500">
                {perMonth != null
                  ? (outcome === "sales-revenue" ? `~${fmtUsd0(perMonth)} sales / mo` : `~${fmtCount(perMonth)} ${outcomeMeta.unit} / mo`)
                  : "—"}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 p-3">
        <span className="text-sm text-gray-400">$</span>
        <input type="number" min={1} value={budget ?? ""} onChange={(e) => setBudget(Number(e.target.value))} placeholder="Custom daily budget" className="flex-1 bg-transparent text-sm text-gray-900 focus:outline-none" />
        <span className="text-xs text-gray-400">/ day</span>
      </div>
      <button onClick={launch} disabled={busy || budget == null || budget <= 0} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Launching…</> : <>Launch campaign <CursorArrowRaysIcon className="h-4 w-4" /></>}
      </button>
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
