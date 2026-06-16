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
  ChartBarIcon,
  CheckIcon,
  ChevronLeftIcon,
  CursorArrowRaysIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import posthog from "posthog-js";
import {
  upsertBrand,
  extractBrandFields,
  SALES_PROFILE_FIELDS,
} from "@/lib/api";
import { extractDomain } from "@/lib/extract-domain";

/**
 * Beta onboarding (allowlist only — see `beta-allowlist.ts`). Ports the stepped
 * flow from the `apps/app` mockup (app.distribute.you) into the real dashboard:
 * welcome → type → URL → an ANIMATED build sequence that runs WHILE the brand is
 * actually created (replacing the dead spinner the default flow showed) → a short
 * strategy review (objective / funnels / conversion rates) → straight into the
 * real `campaigns/new` config (which owns budget, funnel + Edit-with-AI).
 *
 * Scope note (Option 1): objective / funnels / rates are collected for engagement
 * but are NOT yet persisted to the backend — the wired source of truth for those
 * lives in `campaigns/new`. Persisting them (so they prefill the campaign) is the
 * Option-2 follow-up and needs a backend sales-economics save at this step.
 */

type Step =
  | "welcome"
  | "type"
  | "url"
  | "loading"
  | "objective"
  | "funnels"
  | "rates";

type AccountType = "agency" | "company";

type Objective = "signups" | "meetings" | "purchases";
const OBJECTIVES: { key: Objective; label: string; desc: string }[] = [
  { key: "signups", label: "Signups", desc: "Maximize free signups / trial starts on your site." },
  { key: "meetings", label: "Booked Meetings", desc: "Maximize sales meetings booked from outreach." },
  { key: "purchases", label: "Purchases", desc: "Maximize paying customers and revenue." },
];

type Funnel = "website-signups" | "sales-meetings" | "website-purchases";
const FUNNELS: { key: Funnel; label: string; desc: string }[] = [
  { key: "website-signups", label: "Website Signups", desc: "Visitors create an account on your site." },
  { key: "sales-meetings", label: "Sales Meetings", desc: "Replies turn into booked sales meetings." },
  { key: "website-purchases", label: "Website Purchases", desc: "Visitors buy directly on your site." },
];

type RateKey = "ltv" | "v2s" | "s2c" | "r2m" | "m2c";
const RATE_META: Record<RateKey, { label: string; suffix: "$" | "%"; hint: string }> = {
  ltv: { label: "Lifetime revenue / paid client", suffix: "$", hint: "Average revenue a customer brings over their lifetime." },
  v2s: { label: "Website visit → signup", suffix: "%", hint: "Of visitors who land on your site, how many sign up." },
  s2c: { label: "Signup → paid client", suffix: "%", hint: "Of signups, how many become paying customers." },
  r2m: { label: "Positive reply → meeting booked", suffix: "%", hint: "Of positive replies, how many book a meeting." },
  m2c: { label: "Meeting booked → close won", suffix: "%", hint: "Of booked meetings, how many close." },
};

// Ask only the strictly-necessary rates given the objective + active funnels.
function ratesNeeded(objective: Objective, funnels: Set<Funnel>): RateKey[] {
  const out: RateKey[] = [];
  const websiteActive = funnels.has("website-signups") || funnels.has("website-purchases");
  const meetingsActive = funnels.has("sales-meetings");
  if (objective === "signups") {
    if (websiteActive) out.push("v2s");
    return out;
  }
  if (objective === "meetings") {
    if (meetingsActive) out.push("r2m");
    return out;
  }
  out.push("ltv");
  if (websiteActive) out.push("v2s", "s2c");
  if (meetingsActive) out.push("r2m", "m2c");
  return out;
}

const LOADING_STEPS = [
  { id: "ls-1", label: "Reading your product", delay: 1400 },
  { id: "ls-2", label: "Extracting your ICP and objectives", delay: 1600 },
  { id: "ls-3", label: "Selecting outreach strategy", delay: 1400 },
  { id: "ls-4", label: "Drafting your first outreach", delay: 1400 },
];

export function BetaOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organization } = useOrganization();
  const { createOrganization, setActive } = useOrganizationList();
  const { session } = useSession();
  const forceNew = searchParams.get("new") === "1";

  const [step, setStep] = useState<Step>("welcome");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [objective, setObjective] = useState<Objective>("purchases");
  const [funnels, setFunnels] = useState<Set<Funnel>>(
    () => new Set<Funnel>(["website-signups", "sales-meetings", "website-purchases"]),
  );
  const [rates, setRates] = useState<Record<RateKey, number>>({ ltv: 2500, v2s: 5, s2c: 10, r2m: 30, m2c: 25 });

  // Loading-sequence + real brand-create coordination.
  const [loadStep, setLoadStep] = useState(0);
  const [loadDone, setLoadDone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Brand id from the real create; we only advance past the loader once BOTH the
  // animation finished AND the brand actually exists.
  const brandIdRef = useRef<string | null>(null);
  const animDoneRef = useRef(false);

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

  // Both the animation and the real create must finish before leaving the loader.
  function maybeAdvancePastLoading() {
    if (animDoneRef.current && brandIdRef.current) {
      setStep("objective");
    }
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

  async function createBrand(): Promise<void> {
    const trimmed = url.trim();
    const brandUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    // Reuse the active org (signup auto-creates one) unless ?new=1 forces a brand-new
    // org — same rule as the default flow.
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
    // Mark onboarding complete (edge-gate signal — proxy.ts / DIS-111). Idempotent.
    await fetch("/api/onboarding/complete", { method: "POST" }).catch((e) =>
      console.error("[dashboard] failed to mark onboarding complete:", e),
    );
    // Re-mint the session token so the fresh `orgMeta.onboardingComplete` claim is
    // in the cookie the edge gate reads — else the stale JWT loops back to /onboarding.
    await session?.getToken({ skipCache: true }).catch(() => {});
    // Kick brand-field extraction in the background (fire-and-forget, same as default).
    extractBrandFields([brandId], SALES_PROFILE_FIELDS).catch(() => {});
    brandIdRef.current = brandId;
    posthog.capture("onboarding_brand_created", { flow: "beta", org_id: targetOrgId, brand_id: brandId });
    setTargetOrgId(targetOrgId);
  }

  const [orgIdForCampaign, setTargetOrgId] = useState<string | null>(null);

  async function startAnalyze() {
    if (!domain) return;
    setError(null);
    setStep("loading");
    runLoadingAnimation();
    posthog.capture("onboarding_workspace_create_started", { flow: "beta", domain });
    try {
      await createBrand();
      maybeAdvancePastLoading();
    } catch (err) {
      posthog.capture("onboarding_workspace_create_failed", { flow: "beta", domain });
      timers.current.forEach(clearTimeout);
      setError(err instanceof Error ? err.message : "Setup failed. Please try again.");
      setStep("url");
    }
  }

  function finish() {
    const brandId = brandIdRef.current;
    if (!brandId || !orgIdForCampaign) return;
    posthog.capture("onboarding_completed", { flow: "beta", objective });
    router.push(`/orgs/${orgIdForCampaign}/brands/${brandId}/campaigns/new`);
  }

  const neededRates = ratesNeeded(objective, funnels);
  const card = "bg-white rounded-2xl border border-gray-200 p-8 md:p-12";

  // Step: Welcome
  if (step === "welcome") {
    return (
      <div className={card}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-600">
          Beta
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-gray-950">
          You set the goal.<br />We deliver the outcome.
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Drop your product URL and a daily budget. We find your leads, reach out across the
          best channels, and turn them into signups, meetings and sales.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            { icon: SparklesIcon, title: "Pick your goal", desc: "Maximize signups, meetings, or sales" },
            { icon: CheckIcon, title: "Best ROI", desc: "Best return on the market, measured per outcome" },
            { icon: ChartBarIcon, title: "Pay per outcome", desc: "$15 / signup · $90 / meeting · $120 / sale" },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                <f.icon className="h-4 w-4" />
              </div>
              <div className="mt-3 text-sm font-semibold text-gray-900">{f.title}</div>
              <div className="mt-1 text-xs leading-5 text-gray-500">{f.desc}</div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setStep("type")}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Get started
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Step: Account type
  if (step === "type") {
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("welcome")} />
        <h2 className="font-display text-2xl font-bold text-gray-900">How will you use Distribute?</h2>
        <p className="mt-2 mb-8 text-gray-500">This helps us set up your workspace correctly.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {([
            { key: "agency" as const, title: "Agency", desc: "Manage distribution for multiple client brands from one dashboard" },
            { key: "company" as const, title: "Company", desc: "Automate distribution for your own brand" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                posthog.capture("onboarding_account_type_selected", { flow: "beta", account_type: t.key });
                setAccountType(t.key);
                setStep("url");
              }}
              className="group rounded-xl border-2 border-gray-200 bg-white p-6 text-left transition hover:border-brand-400 hover:shadow-md"
            >
              <h3 className="mb-1 text-lg font-semibold text-gray-900">{t.title}</h3>
              <p className="text-sm text-gray-500">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step: URL
  if (step === "url") {
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("type")} />
        <h2 className="font-display text-2xl font-bold text-gray-900">What are we promoting?</h2>
        <p className="mt-2 mb-6 text-gray-500">
          We read your product, find the leads, and run the outreach. Just drop the URL.
        </p>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={accountType === "agency" ? "e.g. your-agency.com" : "e.g. acme.com"}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && domain) startAnalyze();
          }}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {url.trim() && !domain && (
          <p className="mt-2 text-sm text-red-500">Please enter a valid URL (e.g. acme.com)</p>
        )}
        <button
          onClick={startAnalyze}
          disabled={!domain}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Analyze my product
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Step: Loading (animation runs while the brand is created for real)
  if (step === "loading") {
    return (
      <div className={card}>
        <div className="mb-2 text-center text-lg font-semibold text-gray-950">
          {loadDone ? "Your strategy is ready." : "Building your strategy…"}
        </div>
        <p className="mb-6 text-center text-sm text-gray-500">
          Reading <span className="font-medium text-gray-700">{hostname}</span>
        </p>
        <div className="space-y-2">
          {LOADING_STEPS.map((s, i) => {
            const isDone = loadDone || i < loadStep;
            const isActive = !loadDone && i === loadStep;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                  isActive ? "border-brand-200 bg-brand-50" : "border-gray-100 bg-white"
                } ${isDone || isActive ? "opacity-100" : "opacity-40"}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {isDone ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                  ) : isActive ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  )}
                </span>
                <span className={`text-sm ${isActive ? "font-medium text-gray-900" : "text-gray-600"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        {loadDone && !brandIdRef.current && (
          <p className="mt-5 text-center text-xs text-gray-400">Finishing setup…</p>
        )}
      </div>
    );
  }

  // Step: Objective
  if (step === "objective") {
    return (
      <div className={card}>
        <h2 className="font-display text-2xl font-bold text-gray-900">What do you want to maximize?</h2>
        <p className="mt-2 mb-6 text-gray-500">
          Pick the one growth metric this campaign optimizes for. We tune budget and targeting around it.
        </p>
        <div className="space-y-3">
          {OBJECTIVES.map((o) => (
            <ChoiceCard
              key={o.key}
              active={objective === o.key}
              onClick={() => setObjective(o.key)}
              title={o.label}
              desc={o.desc}
            />
          ))}
        </div>
        <button
          onClick={() => setStep("funnels")}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Continue
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Step: Funnels (multi-select)
  if (step === "funnels") {
    return (
      <div className={card}>
        <BackButton onClick={() => setStep("objective")} />
        <h2 className="font-display text-2xl font-bold text-gray-900">Which sales funnels do you use?</h2>
        <p className="mt-2 mb-6 text-gray-500">
          Select every path a prospect can take to become a customer. We only ask for the conversion
          rates these funnels need.
        </p>
        <div className="space-y-3">
          {FUNNELS.map((f) => (
            <ChoiceCard
              key={f.key}
              active={funnels.has(f.key)}
              onClick={() => toggleFunnel(f.key)}
              title={f.label}
              desc={f.desc}
              check
            />
          ))}
        </div>
        <button
          onClick={() => setStep("rates")}
          disabled={funnels.size === 0}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Step: Conversion rates (gated by objective + funnels)
  return (
    <div className={card}>
      <BackButton onClick={() => setStep("funnels")} />
      <h2 className="font-display text-2xl font-bold text-gray-900">Your conversion rates.</h2>
      <p className="mt-2 mb-6 text-gray-500">
        Just the numbers we need to project results for{" "}
        <strong>{OBJECTIVES.find((o) => o.key === objective)?.label}</strong>. Estimates are fine —
        tweak anytime.
      </p>
      {neededRates.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
          No conversion rates needed for this funnel selection.
        </div>
      ) : (
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
                  type="number"
                  min={0}
                  value={rates[k]}
                  onChange={(e) => setRates((r) => ({ ...r, [k]: Number(e.target.value) }))}
                  className="w-16 bg-transparent text-right text-sm text-gray-900 focus:outline-none"
                />
                {RATE_META[k].suffix === "%" && <span className="text-sm text-gray-400">%</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={finish}
        disabled={!brandIdRef.current}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Configure my campaign
        <CursorArrowRaysIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-6 flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-gray-600"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      Back
    </button>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  desc,
  check = false,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  check?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
        active ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
          check ? "rounded-md" : "rounded-full"
        } ${active ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"}`}
      >
        {active && <CheckIcon className="h-3 w-3" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-gray-500">{desc}</span>
      </span>
    </button>
  );
}
