"use client";

import { useState, useMemo, useCallback, useRef, useEffect, Fragment } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { useMutation } from "@tanstack/react-query";
import { useOrg } from "@/lib/org-context";
import { useFeatures } from "@/lib/features-context";
import {
  listWorkflows,
  fetchFeatureStats,
  fetchGlobalRankedWorkflows,
  createCampaign,
  sendCampaignEmail,
  getBrand,
  listBrands,
  getSalesEconomicsEffective,
  saveBrandSalesEconomics,
  type SalesEconomicsSource,
  type BrandSalesEconomicsInput,
  getWorkflowKeyStatus,
  prefillFeatureInputs,
  prefillToStringMap,
  getBillingAccount,
  configureAutoTopup,
  ApiError,
  type Brand,
  type Campaign,
  type FeatureInput,
  getCampaign,
  listCampaignEmails,
  type Email,
  type EmailSequenceStep,
  listWorkflowExamples,
  type WorkflowExampleEmail,
  getWorkflowProjection,
  type WorkflowProjectionItem,
  type SalesObjective,
} from "@/lib/api";
import { useBillingGuard } from "@/lib/billing-guard";
import { formatStatValue, sortDirectionForType } from "@/lib/format-stat";
import { pollOptions } from "@/lib/query-options";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";
import { CampaignAIPanel } from "@/components/campaigns/campaign-ai-panel";
import { BrandLogo } from "@/components/brand-logo";
import { Skeleton } from "@/components/skeleton";
import { EmailSignature } from "@/components/email-signature";
import { SparklesIcon, XMarkIcon, EllipsisVerticalIcon, PlusIcon, InformationCircleIcon, ChevronDownIcon } from "@heroicons/react/20/solid";

type Mode = "autopilot" | "manual";
type BudgetFrequency = "one-off" | "daily" | "weekly" | "monthly";

const BUDGET_FREQUENCIES: { value: BudgetFrequency; label: string }[] = [
  { value: "one-off", label: "One-off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

// ── Sales-cold-email funnel redesign (objective → revenue → metrics → budget) ──
// Gated to this one feature; every other feature keeps the workflow-table UI.
// Workflow auto-pick + revenue projection are computed by features-service (the single
// source for the funnel SUM math) and read via getWorkflowProjection: the ROI comparator
// is cost-per-close. meeting-booked SUMS the positive-reply route and the website-visit
// route (the same budget funds both); self-serve is visits-only. The page only scales the
// served per-$ projection by budget for display. SalesObjective is imported from @/lib/api.
type BudgetTier = "starter" | "recommended" | "growth" | "other";

const SALES_FUNNEL_FEATURE_SLUG = "sales-cold-email-outreach";

const SALES_OBJECTIVES: { key: SalesObjective; label: string; desc: string }[] = [
  { key: "meeting-booked", label: "Meeting-booked sales", desc: "You close deals from booked meetings — optimize on positive replies." },
  { key: "self-serve", label: "Self-serve sales", desc: "Customers buy from your site — optimize on clicks." },
];

const BUDGET_TIERS: { key: Exclude<BudgetTier, "other">; label: string; factor: number }[] = [
  { key: "starter", label: "Starter", factor: 0.5 },
  { key: "recommended", label: "Recommended", factor: 1 },
  { key: "growth", label: "Growth", factor: 2 },
];

/** Recommended budget is sized for this many closes per month (Starter ×0.5, Growth ×2). */
const TARGET_CLOSES_PER_MONTH = 10;

/** Conversion-economics defaults shown until the brand's saved set loads (or when none
 *  is saved yet). Persisted per brand in brand-service; see getBrandSalesEconomics. */
const SALES_ECON_DEFAULTS = { ltv: "4000", replyToMeeting: "40", meetingToClose: "25", visitToMeeting: "20", clickToClose: "5" };

const DAYS_PER_MONTH = 30.4;

/** Multiply a budget at a given cadence up to a monthly run-rate (one-off/monthly are
 *  already a single period). Outcomes are always normalized to a month. */
const BUDGET_TO_MONTHLY: Record<BudgetFrequency, number> = { "one-off": 1, daily: DAYS_PER_MONTH, weekly: 4.345, monthly: 1 };

const REVENUE_INTERVAL_LABEL: Record<BudgetFrequency, string> = {
  "one-off": "one-off",
  daily: "day",
  weekly: "week",
  monthly: "month",
};

const fmtUsd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const fmtNum = (n: number, decimals = 0) =>
  decimals ? n.toFixed(decimals) : Math.round(n).toLocaleString("en-US");

/** A workflow row combining workflow metadata with feature stats. */
interface WorkflowTableRow {
  id: string;
  workflowName: string;
  workflowSlug: string;
  workflowDynastySlug: string;
  workflowDynastyName: string;
  featureSlug: string | null;
  stats: Record<string, number>;
  brandLastRunAt: string | null;
  updatedAt: string;
}

/** Funnel projection at a concrete budget — the render shape, scaled client-side from the
 *  server's per-$ projection (pure ×; the route-combining SUM lives in features-service). */
interface SalesProjectionView {
  replies: number | null;
  visits: number | null;
  meetings: number | null;
  closes: number;
  revenue: number;
  cacPct: number | null;
  cacAbs: number | null;
}

/** Build an empty form data map from feature inputs */
function buildEmptyForm(inputs: FeatureInput[], brandUrl: string): Record<string, string> {
  const form: Record<string, string> = { brandUrl };
  for (const input of inputs) form[input.key] = "";
  return form;
}

/** Convert prefill values into form data, keyed by feature input keys */
function prefillToFormData(
  prefilled: Record<string, string>,
  inputs: FeatureInput[],
  brandUrl: string,
): Record<string, string> {
  const form: Record<string, string> = { brandUrl };
  for (const input of inputs) {
    form[input.key] = prefilled[input.key] ?? "";
  }
  return form;
}

/** Format a percentage value: one decimal under 10% (so small cold-email rates like 0.5%
 *  don't round to 0%), whole numbers above. Em dash when there's no value. */
function fmtPct(pct: number | null | undefined): string {
  if (pct == null) return "—";
  return `${pct > 0 && pct < 10 ? pct.toFixed(1) : pct.toFixed(0)}%`;
}

// One email card in the picker's preview panel — used for both this-session test runs and
// pre-filled past examples. Click toggles the full multi-step sequence. A `scope` other than
// "brand" renders a small source tag (the example came from another brand / org).
interface TestEmailCardData {
  id: string;
  subject: string | null;
  bodyText: string | null;
  sequence: EmailSequenceStep[] | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  leadCompany: string | null;
  generationRun?: { status: string } | null;
  scope?: "brand" | "org" | "global";
  brandName?: string | null;
}

function TestEmailCard({ email, expanded, onToggle }: { email: TestEmailCardData; expanded: boolean; onToggle: () => void }) {
  const firstBody = email.sequence?.[0]?.bodyText ?? email.bodyText;
  // Full email = the whole sequence (initial + follow-ups); fall back to a single synthetic step.
  const steps = email.sequence && email.sequence.length > 0
    ? email.sequence
    : (firstBody ? [{ step: 1, bodyText: firstBody, bodyHtml: "", daysSinceLastStep: 0 }] : []);
  const otherSource = email.scope === "org" || email.scope === "global";
  const sourceLabel = email.brandName || (email.scope === "org" ? "another brand" : "another workspace");
  return (
    <button type="button" onClick={onToggle}
      className="w-full text-left bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 transition cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-800 truncate">{[email.leadFirstName, email.leadLastName].filter(Boolean).join(" ") || "Lead"}{email.leadCompany ? ` · ${email.leadCompany}` : ""}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {otherSource && (
            <span title="Example from another brand / organization, shown so you can preview this workflow"
              className="text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              Example · {sourceLabel}
            </span>
          )}
          {email.generationRun?.status && <span className="text-[10px] text-gray-400">{email.generationRun.status}</span>}
          {steps.length > 0 && <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />}
        </span>
      </div>
      {email.subject && <div className="text-xs font-semibold text-gray-700 mt-1 truncate">{email.subject}</div>}
      {!expanded && firstBody && <div className="text-[11px] text-gray-500 mt-1 line-clamp-3 whitespace-pre-wrap">{firstBody}</div>}
      {expanded && (
        <div className="mt-2 space-y-2">
          {steps.map((s) => (
            <div key={s.step} className="border-t border-gray-100 pt-2">
              {steps.length > 1 && (
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  {s.step === 1
                    ? "Initial email"
                    : `Follow-up ${s.step - 1}${s.daysSinceLastStep ? ` · ${s.daysSinceLastStep} day${s.daysSinceLastStep === 1 ? "" : "s"} later` : ""}`}
                </div>
              )}
              <div className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-wrap">{s.bodyText}</div>
              {s.bodyText && <EmailSignature className="text-[11px] text-gray-500" />}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

// Placeholder card shown while the selected workflow's examples fetch — mirrors the
// collapsed TestEmailCard layout (lead row + subject + 3 body lines) for zero shift.
function ExampleEmailSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3.5 w-3.5 shrink-0" />
      </div>
      <Skeleton className="h-3 w-32 mt-1.5" />
      <Skeleton className="h-2.5 w-full mt-1.5" />
      <Skeleton className="h-2.5 w-5/6 mt-1" />
      <Skeleton className="h-2.5 w-2/3 mt-1" />
    </div>
  );
}

// Inline loading spinner (mirrors link-button.tsx) — used on the Launch/Start button
// and the full-screen "Launching…" overlay while the create-campaign POST is in flight.
function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function InfoLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span className="group relative inline-flex align-middle">
        <InformationCircleIcon className="w-3.5 h-3.5 text-gray-400 cursor-help" />
        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20 w-48 rounded-lg bg-gray-900 text-white text-[11px] font-normal normal-case leading-snug px-2 py-1.5 shadow-lg whitespace-normal">
          {tip}
        </span>
      </span>
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-brand-600 select-none"
      onClick={() => onSort(sortKey)}
    >
      {label} {active ? (currentDir === "desc" ? "\u2193" : "\u2191") : ""}
    </th>
  );
}

/**
 * Campaign-service reports a running campaign as "ongoing" and a finished/terminated one as "stopped".
 * A workflow test run is "still running" while its campaign has not yet reached the terminal "stopped"
 * state \u2014 keep polling until then (the 3-lead cap auto-stops the campaign on completion).
 */
function isTestRunning(status: string | undefined): boolean {
  return status != null && status !== "stopped";
}

// A workflow "Run test" creates a REAL campaign capped at 3 leads. campaign-service
// fail-closes its gate-check when no budget is defined ("No budget defined (fail-closed)"),
// which silently blocks the workflow from ever generating emails — the campaign hangs
// "ongoing" and the scheduler re-fires the Windmill flow every tick. maxLeads:3 is the real
// bound (auto-stops after 3 leads); this small total cap satisfies the gate and acts as a
// safety ceiling that a 3-lead run never reaches.
const TEST_RUN_BUDGET_USD = "5";

export default function FeatureCreateCampaignPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;

  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { org } = useOrg();
  const { showPaymentRequired } = useBillingGuard();

  const { getFeature, isLoading: featuresLoading, registry } = useFeatures();
  const featureDef = getFeature(featureSlug);
  const featureInputs = featureDef?.inputs ?? [];
  const outputs = featureDef?.outputs ?? [];
  const isSalesFunnel = featureSlug === SALES_FUNNEL_FEATURE_SLUG;

  // Determine default sort from outputs
  const defaultSortOutput = outputs.find((o) => o.defaultSort);
  const defaultSortKey = defaultSortOutput?.key ?? outputs[0]?.key ?? "";
  const defaultSortDir = defaultSortOutput?.sortDirection
    ?? sortDirectionForType(registry[defaultSortKey]?.type)
    ?? "desc";

  // State
  const [mode, setMode] = useState<Mode>("autopilot");
  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);
  const [metric, setMetric] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetFrequency, setBudgetFrequency] = useState<BudgetFrequency>("daily");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({ brandUrl: "" });
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [additionalBrandIds, setAdditionalBrandIds] = useState<string[]>([]);
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const brandPickerRef = useRef<HTMLDivElement>(null);

  // ── Sales funnel state (sales-cold-email only) ──
  const [salesObjective, setSalesObjective] = useState<SalesObjective>("meeting-booked");
  const [econLtv, setEconLtv] = useState(SALES_ECON_DEFAULTS.ltv);
  const [econReplyToMeeting, setEconReplyToMeeting] = useState(SALES_ECON_DEFAULTS.replyToMeeting);
  const [econMeetingToClose, setEconMeetingToClose] = useState(SALES_ECON_DEFAULTS.meetingToClose);
  const [econVisitToMeeting, setEconVisitToMeeting] = useState(SALES_ECON_DEFAULTS.visitToMeeting);
  const [econClickToClose, setEconClickToClose] = useState(SALES_ECON_DEFAULTS.clickToClose);
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);
  const [salesWorkflowOverrideId, setSalesWorkflowOverrideId] = useState<string | null>(null);
  const [modalSelectedWorkflowId, setModalSelectedWorkflowId] = useState<string | null>(null);
  // Test runs keyed by workflow id — real campaigns capped at 3 leads. Persist across modal open/close.
  const [tests, setTests] = useState<Record<string, { campaignId: string; status: string; emails: Email[]; error?: string }>>({});
  const [testStarting, setTestStarting] = useState<Record<string, boolean>>({});
  const [testError, setTestError] = useState<Record<string, string>>({});
  // Which test-email card is expanded to its full multi-step sequence (null = all collapsed).
  const [expandedTestEmailId, setExpandedTestEmailId] = useState<string | null>(null);
  const [budgetTier, setBudgetTier] = useState<BudgetTier>("recommended");
  const [budgetCustom, setBudgetCustom] = useState("");
  const salesPrefilledRef = useRef(false);
  // Provenance of the prefilled metrics, for the section-2 badge: "user" = brand's own
  // saved set, "cross-brand-average" = estimate borrowed from other brands, null =
  // hard-coded defaults (empty table). Flips to "user" on first manual edit.
  const [econSource, setEconSource] = useState<SalesEconomicsSource | null>(null);

  // ── Prefill the brand's sales economics (auto-upsert per brand, no Save button) ──
  // ONE call: brand-service returns the effective set — the brand's saved values
  // (source "user"), the cross-brand average when nothing is saved
  // (source "cross-brand-average"), or { economics: null } for an empty table
  // (source null → keep the hard-coded SALES_ECON_DEFAULTS). A debounced PUT mirrors
  // every edit back to brand-service.
  const { data: salesEconData } = useAuthQuery(
    ["salesEconomicsEffective", brandId],
    () => getSalesEconomicsEffective(brandId),
    { enabled: isSalesFunnel },
  );
  const econHydrated = useRef(false);
  useEffect(() => {
    if (!isSalesFunnel || econHydrated.current || salesEconData === undefined) return;
    const e = salesEconData.economics;
    if (e) {
      setEconLtv(String(e.lifetimeRevenueUsd));
      setEconReplyToMeeting(String(e.replyToMeetingPct));
      setEconVisitToMeeting(String(e.visitToMeetingPct));
      setEconMeetingToClose(String(e.meetingToClosePct));
      setEconClickToClose(String(e.visitToClosePct));
      setEconSource(salesEconData.source);
    }
    // Mark hydrated even when economics is null (empty table → keep
    // SALES_ECON_DEFAULTS, econSource stays null) so later background refetches
    // never clobber edits.
    econHydrated.current = true;
  }, [isSalesFunnel, salesEconData]);

  const { mutate: mutateSalesEcon } = useMutation({
    mutationFn: (input: BrandSalesEconomicsInput) => saveBrandSalesEconomics(brandId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(["brandSalesEconomics", brandId], data);
      // The workflow projection reads saved econ server-side — refresh it now that the edit
      // persisted, so the budget cards reflect the new metrics without waiting for the poll.
      queryClient.invalidateQueries({ queryKey: ["workflowProjection", featureSlug, brandId] });
    },
    onError: (err) => console.error("[dashboard] saveBrandSalesEconomics failed", err),
  });

  const econSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Update one metric input + schedule a debounced upsert of the full set. Hydration
  // uses the raw setters (not this), so loading saved values never triggers a write.
  const updateEcon = (
    field: "ltv" | "replyToMeeting" | "visitToMeeting" | "meetingToClose" | "clickToClose",
    value: string,
  ) => {
    const next = {
      ltv: econLtv,
      replyToMeeting: econReplyToMeeting,
      visitToMeeting: econVisitToMeeting,
      meetingToClose: econMeetingToClose,
      clickToClose: econClickToClose,
      [field]: value,
    };
    if (field === "ltv") setEconLtv(value);
    else if (field === "replyToMeeting") setEconReplyToMeeting(value);
    else if (field === "visitToMeeting") setEconVisitToMeeting(value);
    else if (field === "meetingToClose") setEconMeetingToClose(value);
    else setEconClickToClose(value);
    // User edited a value → these are now the brand's own numbers, not an estimate.
    if (econSource !== "user") setEconSource("user");

    if (!isSalesFunnel) return;
    if (econSaveTimer.current) clearTimeout(econSaveTimer.current);
    econSaveTimer.current = setTimeout(() => {
      mutateSalesEcon({
        lifetimeRevenueUsd: Math.round(parseFloat(next.ltv) || 0),
        replyToMeetingPct: Math.round(parseFloat(next.replyToMeeting) || 0),
        visitToMeetingPct: Math.round(parseFloat(next.visitToMeeting) || 0),
        meetingToClosePct: Math.round(parseFloat(next.meetingToClose) || 0),
        visitToClosePct: Math.round(parseFloat(next.clickToClose) || 0),
      });
    }, 700);
  };

  const sortedOutputs = useMemo(
    () => [...outputs].sort((a, b) => a.displayOrder - b.displayOrder),
    [outputs]
  );

  // Fetch brand info
  const { data: brandData } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
    pollOptions,
  );
  const brand = brandData?.brand ?? null;

  // Fetch all org brands for the brand picker
  const { data: allBrandsData, error: brandsError } = useAuthQuery(
    ["brands"],
    () => listBrands(),
    pollOptions,
  );
  if (brandsError) {
    console.error("[dashboard] Failed to fetch brands for picker:", brandsError);
  }
  const allBrands = allBrandsData?.brands ?? [];
  // Brands available to add (exclude primary + already added)
  const availableBrands = useMemo(
    () => allBrands.filter((b) => b.id !== brandId && !additionalBrandIds.includes(b.id)),
    [allBrands, brandId, additionalBrandIds],
  );

  // Resolve additional brand details from the already-fetched brands list
  const additionalBrands: Brand[] = useMemo(
    () => additionalBrandIds
      .map((id) => allBrands.find((b) => b.id === id))
      .filter((b): b is Brand => b != null),
    [additionalBrandIds, allBrands],
  );

  // Close brand picker on outside click
  useEffect(() => {
    if (!showBrandPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (brandPickerRef.current && !brandPickerRef.current.contains(e.target as Node)) {
        setShowBrandPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showBrandPicker]);



  // Fetch workflows filtered by feature slug
  const { data: workflowsData, isLoading: workflowsLoading } = useAuthQuery(
    ["workflows", featureSlug],
    () => listWorkflows({ featureSlug }),
    pollOptions,
  );

  // Fetch cross-org/brand ranked workflow stats (global leaderboard)
  const { data: rankedData, isLoading } = useAuthQuery(
    ["globalRankedWorkflows", featureSlug, defaultSortKey],
    () => fetchGlobalRankedWorkflows({
      featureSlug,
      objective: defaultSortKey,
      groupBy: "workflow",
      limit: 100,
    }),
    { enabled: featureDef?.implemented === true && defaultSortKey !== "", ...pollOptions },
  );

  // Fetch brand-specific stats to know when each workflow was last used by this brand
  const { data: brandStatsData } = useAuthQuery(
    ["featureStats", featureSlug, "byWorkflowDynastySlug", "brand", brandId],
    () => fetchFeatureStats(featureSlug, { groupBy: "workflowDynastySlug", brandId }),
    { enabled: featureDef?.implemented === true, ...pollOptions },
  );

  // Active workflows grouped by workflowDynastySlug: keep only the latest per dynasty
  const rows = useMemo(() => {
    if (!workflowsData?.workflows) return [];
    const byDynasty = new Map<string, (typeof workflowsData.workflows)[number]>();
    for (const wf of workflowsData.workflows) {
      if (!wf.workflowDynastySlug) continue;
      const existing = byDynasty.get(wf.workflowDynastySlug);
      if (!existing || wf.createdAt > existing.createdAt) {
        byDynasty.set(wf.workflowDynastySlug, wf);
      }
    }

    const statsMap = new Map<string, Record<string, number | null>>();
    for (const r of rankedData ?? []) {
      if (r.workflow.workflowDynastySlug) statsMap.set(r.workflow.workflowDynastySlug, r.stats);
    }

    // Brand-specific stats: lastRunAt per workflow dynasty for this brand
    const brandLastRunMap = new Map<string, string | null>();
    for (const g of brandStatsData?.groups ?? []) {
      if (g.workflowDynastySlug) brandLastRunMap.set(g.workflowDynastySlug, g.systemStats.lastRunAt);
    }

    return [...byDynasty.values()].map((wf): WorkflowTableRow => {
      const s = statsMap.get(wf.workflowDynastySlug);
      return {
        id: wf.id,
        workflowName: wf.workflowName,
        workflowSlug: wf.workflowSlug,
        workflowDynastySlug: wf.workflowDynastySlug,
        workflowDynastyName: wf.workflowDynastyName,
        featureSlug: wf.featureSlug ?? null,
        stats: (s ?? {}) as Record<string, number>,
        brandLastRunAt: brandLastRunMap.get(wf.workflowDynastySlug) ?? null,
        updatedAt: wf.updatedAt,
      };
    });
  }, [workflowsData, rankedData, brandStatsData]);

  // features-service is the SINGLE source for the funnel SUM math: per-workflow cost-per-close
  // + funnel projection + the recommended workflow/budget. Conversion economics are read
  // server-side from the brand's SAVED sales-economics. The funnel is LINEAR in budget, so we
  // request the projection at $1 (per-dollar) and scale by budget client-side (pure ×; the
  // route-combining SUM stays server-side). Invalidated when the econ upsert lands (see
  // mutateSalesEcon.onSuccess) so edits reflect once persisted.
  const { data: projData } = useAuthQuery(
    ["workflowProjection", featureSlug, brandId, salesObjective],
    () => getWorkflowProjection({ featureSlug, brandId, objective: salesObjective, budgetUsd: 1 }),
    { enabled: isSalesFunnel && featureDef?.implemented === true, ...pollOptions },
  );

  const projByDynasty = useMemo(() => {
    const m = new Map<string, WorkflowProjectionItem>();
    for (const w of projData?.workflows ?? []) m.set(w.workflowDynastySlug, w);
    return m;
  }, [projData]);

  // Served cost-per-close for a workflow (the ROI comparator; lower = better).
  const cpcFor = useCallback(
    (dynastySlug: string): number | null => projByDynasty.get(dynastySlug)?.costPerCloseUsd ?? null,
    [projByDynasty],
  );

  // CAC as a % of the customer's LTV — budget-invariant, served as projection.cacPct
  // ((budget/revenue)×100 == cost-per-close/LTV×100). Used by the workflow picker.
  const cacPctFor = useCallback(
    (dynastySlug: string): number | null => projByDynasty.get(dynastySlug)?.projection?.cacPct ?? null,
    [projByDynasty],
  );

  // Render the funnel at any budget by scaling the served per-$ projection (computed at
  // budgetUsd=1). Counts scale linearly with budget; cacPct/cacAbs are budget-invariant ratios.
  const projectFor = useCallback(
    (dynastySlug: string, budget: number): SalesProjectionView | null => {
      const base = projByDynasty.get(dynastySlug)?.projection;
      if (!base || budget <= 0) return null;
      const scale = (v: number | null) => (v != null ? v * budget : null);
      return {
        replies: scale(base.replies),
        visits: scale(base.visits),
        meetings: scale(base.meetings),
        closes: base.closes != null ? base.closes * budget : 0,
        revenue: base.revenue != null ? base.revenue * budget : 0,
        cacPct: base.cacPct,
        cacAbs: base.cacAbs,
      };
    },
    [projByDynasty],
  );

  // Auto-pick: the workflow features-service recommends (lowest cost-per-close for this
  // objective); fall back to the lowest served cost-per-close among the listed workflows.
  const salesAutoPick = useMemo(() => {
    if (!isSalesFunnel) return null;
    const recoSlug = projData?.recommendedWorkflowDynastySlug;
    if (recoSlug) {
      const r = rows.find((x) => x.workflowDynastySlug === recoSlug);
      if (r) return r;
    }
    const scored = rows
      .map((r) => ({ r, cpc: cpcFor(r.workflowDynastySlug) }))
      .filter((x): x is { r: WorkflowTableRow; cpc: number } => x.cpc != null && isFinite(x.cpc));
    if (scored.length === 0) return null;
    return scored.sort((a, b) => a.cpc - b.cpc)[0].r;
  }, [isSalesFunnel, rows, projData, cpcFor]);

  // Workflow used for projection + launch: the picker override, else the auto-pick.
  const salesPick = useMemo(() => {
    if (!isSalesFunnel) return null;
    if (salesWorkflowOverrideId) {
      const o = rows.find((r) => r.id === salesWorkflowOverrideId);
      if (o) return o;
    }
    return salesAutoPick;
  }, [isSalesFunnel, salesWorkflowOverrideId, rows, salesAutoPick]);

  // Funnel projection for the picked workflow. recommendedBudget = targetCloses ×
  // cost-per-close (budget per close); project() scales the served per-$ projection.
  const salesPlan = useMemo(() => {
    const cpc = salesPick ? cpcFor(salesPick.workflowDynastySlug) : null;
    const recommendedBudget = cpc != null ? TARGET_CLOSES_PER_MONTH * cpc : null;
    const project = (budget: number) =>
      salesPick ? projectFor(salesPick.workflowDynastySlug, budget) : null;
    return { costPerCloseUsd: cpc, recommendedBudget, project };
  }, [salesPick, cpcFor, projectFor]);

  // Google-Ads-style budget tiers seeded from the 10-closes/mo target, + the chosen amount.
  const budgetPresets = useMemo(() => {
    const rec = salesPlan.recommendedBudget;
    if (rec == null) return null;
    return BUDGET_TIERS.map((t) => {
      const monthly = Math.max(1, Math.round(rec * t.factor));
      return { ...t, monthly, daily: Math.max(1, Math.round(monthly / DAYS_PER_MONTH)) };
    });
  }, [salesPlan.recommendedBudget]);

  const effectiveBudget = useMemo(() => {
    if (budgetTier === "other") return parseFloat(budgetCustom) || 0;
    return budgetPresets?.find((p) => p.key === budgetTier)?.daily ?? 0;
  }, [budgetTier, budgetCustom, budgetPresets]);

  // Static-shell-first: hold the §2 conversion-metric inputs until their effective
  // values resolve, so they don't flash SALES_ECON_DEFAULTS before saved/cross-brand
  // values hydrate.
  const econReady = !isSalesFunnel || salesEconData !== undefined;
  // The budget cards derive from the served projection (cost-per-close → recommendedBudget);
  // hold them only until the projection/workflows resolve so they don't flash the
  // "no cost data" warning. Do not wait for the separate economics badge/input query:
  // the server projection already uses the effective economics, and delaying on the
  // badge makes the budget cards appear seconds late.
  const projReady = !isSalesFunnel || projData !== undefined;
  const budgetReady = projReady && !workflowsLoading;

  // ── Workflow test runs (real campaigns capped at 3 leads) ──
  const runningTestIds = useMemo(
    () => Object.values(tests).filter((t) => isTestRunning(t.status)).map((t) => t.campaignId),
    [tests],
  );

  const { data: testPoll } = useAuthQuery(
    ["salesWorkflowTests", runningTestIds],
    async () => {
      const out: Record<string, { status?: string; emails?: Email[]; error?: string }> = {};
      await Promise.all(
        runningTestIds.map(async (cid) => {
          // Decouple the two reads: getCampaign (status, with brand-url enrichment) and
          // listCampaignEmails are independent. With a single Promise.all, a getCampaign
          // throw dropped the emails too — the poll returned {} every cycle and the modal
          // hung on "Generating emails…" forever though the emails were ready. allSettled
          // lets each succeed on its own; the effect keeps the last-good value for the other.
          const [campaignRes, emailsRes] = await Promise.allSettled([getCampaign(cid), listCampaignEmails(cid)]);
          const entry: { status?: string; emails?: Email[]; error?: string } = {};
          if (campaignRes.status === "fulfilled") entry.status = campaignRes.value.campaign.status;
          else console.error(`[dashboard] workflow-test getCampaign failed for campaign ${cid}:`, campaignRes.reason);
          if (emailsRes.status === "fulfilled") entry.emails = emailsRes.value.emails;
          else console.error(`[dashboard] workflow-test listCampaignEmails failed for campaign ${cid}:`, emailsRes.reason);
          // Surface an error only when BOTH reads fail — a partial success still makes progress.
          if (campaignRes.status === "rejected" && emailsRes.status === "rejected") {
            entry.error = emailsRes.reason instanceof Error ? emailsRes.reason.message : "Failed to load test results.";
          }
          out[cid] = entry;
        }),
      );
      return out;
    },
    { enabled: runningTestIds.length > 0, ...pollOptions },
  );

  useEffect(() => {
    if (!testPoll) return;
    setTests((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [wfId, t] of Object.entries(prev)) {
        const d = testPoll[t.campaignId];
        if (!d) continue;
        // Merge partials: keep the last-good value for whichever read failed this cycle.
        const newStatus = d.status ?? t.status;
        const newEmails = d.emails ?? t.emails;
        const newError = d.error;
        if (newStatus !== t.status || newEmails.length !== t.emails.length || newError !== t.error) {
          next[wfId] = { ...t, status: newStatus, emails: newEmails, error: newError };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [testPoll]);

  // ── Default preview: pre-filled example emails for the SELECTED workflow ──
  // Cascade brand→org→global (api-service /workflow-examples), so a user sees real output
  // without having to run a test. Degrades silently to the Run-test flow if the endpoint
  // isn't reachable yet or there are no examples.
  const modalSelectedWf = useMemo(
    () => rows.find((r) => r.id === modalSelectedWorkflowId),
    [rows, modalSelectedWorkflowId],
  );
  const exampleWfSlug = modalSelectedWf?.workflowSlug ?? null;
  const {
    data: examplesData,
    isPending: examplesPending,
    // keepPreviousData (global) keeps the PREVIOUS workflow's emails in `examplesData`
    // while the newly-selected workflow's examples fetch. `isPlaceholderData` is true
    // exactly in that window — the shown data belongs to a different workflow, so we
    // paint skeletons instead of stale emails. (`isPending` only fires on the first
    // cold load when no previous data exists.)
    isPlaceholderData: examplesIsPlaceholder,
  } = useAuthQuery(
    ["workflowExamples", exampleWfSlug, brandId],
    async () => {
      try {
        return await listWorkflowExamples(exampleWfSlug as string, brandId, 3);
      } catch (err) {
        console.error("[dashboard] workflow examples fetch failed:", err);
        return { examples: [] as WorkflowExampleEmail[] };
      }
    },
    { enabled: showWorkflowPicker && !!exampleWfSlug && !!brandId, staleTime: 60_000 },
  );

  // Prefetch examples for every visible workflow the moment the picker opens, so
  // switching from one workflow to another is INSTANT (cache hit, staleTime 60s)
  // instead of a ~2s cold fetch. Mirrors the on-demand query's key + fail-soft shape.
  useEffect(() => {
    if (!showWorkflowPicker || !brandId) return;
    for (const r of rows) {
      if (!r.workflowSlug) continue;
      const slug = r.workflowSlug;
      queryClient.prefetchQuery({
        queryKey: ["workflowExamples", slug, brandId],
        queryFn: async () => {
          try {
            return await listWorkflowExamples(slug, brandId, 3);
          } catch (err) {
            console.error("[dashboard] workflow examples prefetch failed:", err);
            return { examples: [] as WorkflowExampleEmail[] };
          }
        },
        staleTime: 60_000,
      });
    }
  }, [showWorkflowPicker, brandId, rows, queryClient]);

  const runWorkflowTest = useCallback(async (wf: WorkflowTableRow) => {
    const baseUrl = brand?.url ?? "";
    if (!baseUrl || testStarting[wf.id]) return;
    setTestError((s) => ({ ...s, [wf.id]: "" }));
    setTestStarting((s) => ({ ...s, [wf.id]: true }));
    try {
      const inputValues: Record<string, unknown> = {};
      for (const input of featureInputs) {
        const v = formData[input.key]?.trim();
        if (v) inputValues[input.key] = v;
      }
      const brandUrls = [
        formData.brandUrl || baseUrl,
        ...additionalBrands.map((b) => b.url).filter((u): u is string => u != null),
      ];
      const now = new Date();
      const name = `Test — ${wf.workflowDynastyName} — ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}.${String(now.getMilliseconds()).padStart(3, "0")}`;
      const { campaign } = await createCampaign({
        name,
        workflowSlug: wf.workflowSlug,
        brandUrls,
        featureSlug,
        featureInputs: inputValues,
        maxLeads: 3,
        maxBudgetTotalUsd: TEST_RUN_BUDGET_USD,
      } as unknown as Parameters<typeof createCampaign>[0]);
      setTests((t) => ({ ...t, [wf.id]: { campaignId: campaign.id, status: campaign.status, emails: [] } }));
    } catch (err) {
      setTestError((s) => ({
        ...s,
        [wf.id]: err instanceof ApiError && err.status === 402
          ? "Insufficient credits to run a test."
          : err instanceof Error ? err.message : "Failed to start test.",
      }));
    } finally {
      setTestStarting((s) => ({ ...s, [wf.id]: false }));
    }
  }, [brand, testStarting, featureInputs, formData, additionalBrands, featureSlug]);

  // Workflow IDs for key status check
  const featureWorkflowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const { data: keyStatusData } = useAuthQuery(
    ["workflowKeyStatus", featureSlug, featureWorkflowIds],
    async () => {
      const results = await Promise.all(
        featureWorkflowIds.map((id) => getWorkflowKeyStatus(id))
      );
      const missing = new Set<string>();
      for (const r of results) {
        for (const p of r.missing) missing.add(p);
      }
      return [...missing];
    },
    { enabled: featureWorkflowIds.length > 0, ...pollOptions },
  );

  const missingProviders = keyStatusData ?? [];

  const handleSort = useCallback((key: string) => {
    setMetric((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        return prev;
      }
      const dir = sortDirectionForType(registry[key]?.type);
      setSortDir(dir);
      return key;
    });
  }, [registry]);

  // Tiebreaker: most recently used by this brand, then most recently updated workflow
  const tiebreak = (a: WorkflowTableRow, b: WorkflowTableRow): number => {
    // 1st tiebreak: last workflow used by this brand (most recent first)
    const aLastRun = a.brandLastRunAt ?? "";
    const bLastRun = b.brandLastRunAt ?? "";
    if (aLastRun !== bLastRun) return aLastRun > bLastRun ? -1 : 1;
    // 2nd tiebreak: workflow updatedAt (most recent first)
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1;
    return 0;
  };

  const sorted = useMemo(() => {
    if (rows.length === 0) return [];
    return [...rows].sort((a, b) => {
      const aRaw = a.stats[metric] ?? null;
      const bRaw = b.stats[metric] ?? null;
      const aNull = aRaw === null || aRaw === 0;
      const bNull = bRaw === null || bRaw === 0;
      if (aNull && bNull) return tiebreak(a, b);
      if (aNull) return 1;
      if (bNull) return -1;
      const diff = sortDir === "desc" ? Number(bRaw) - Number(aRaw) : Number(aRaw) - Number(bRaw);
      return diff !== 0 ? diff : tiebreak(a, b);
    });
  }, [rows, metric, sortDir]);

  // Selection uses workflow ID as stable key
  const effectiveSelectionId = mode === "autopilot"
    ? sorted[0]?.id ?? null
    : selectedWorkflowId;

  const selectedRow = isSalesFunnel
    ? salesPick
    : sorted.find((r) => r.id === effectiveSelectionId) ?? null;

  const { topRows, restRows } = useMemo(() => {
    if (mode === "autopilot" || !selectedWorkflowId) {
      return { topRows: [], restRows: sorted };
    }
    const selected = sorted.find((w) => w.id === selectedWorkflowId);
    const rest = sorted.filter((w) => w.id !== selectedWorkflowId);
    return {
      topRows: selected ? [selected] : [],
      restRows: rest,
    };
  }, [mode, selectedWorkflowId, sorted]);

  const resolvedBrandUrl = brand?.url ?? "";

  const handleGo = useCallback(async () => {
    if (!selectedRow || !budgetAmount || !resolvedBrandUrl) return;
    setCreateError(null);

    setIsLoadingProfile(true);
    try {
      const { prefilled } = await prefillFeatureInputs(featureSlug, [brandId, ...additionalBrandIds]);
      const fields = prefillToStringMap(prefilled);
      setFormData(prefillToFormData(fields, featureInputs, resolvedBrandUrl));
    } catch {
      setFormData(buildEmptyForm(featureInputs, resolvedBrandUrl));
    } finally {
      setIsLoadingProfile(false);
      setShowForm(true);
    }
  }, [selectedRow, budgetAmount, resolvedBrandUrl, brandId, additionalBrandIds, featureSlug, featureInputs]);

  // Re-run prefill when brands change while form is already open
  useEffect(() => {
    if (!showForm || !resolvedBrandUrl) return;
    let cancelled = false;
    setIsLoadingProfile(true);
    prefillFeatureInputs(featureSlug, [brandId, ...additionalBrandIds])
      .then(({ prefilled }) => {
        if (cancelled) return;
        const fields = prefillToStringMap(prefilled);
        setFormData(prefillToFormData(fields, featureInputs, resolvedBrandUrl));
      })
      .catch(() => {
        if (!cancelled) setFormData(buildEmptyForm(featureInputs, resolvedBrandUrl));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProfile(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionalBrandIds]);

  // Sales: feed the chosen budget into the existing create flow.
  // Money convention: budgets are USD dollars at cents precision. Round to whole CENTS,
  // never whole dollars — a $1.95 custom budget must stay $1.95 (rounding to $2 would
  // mis-display it, over-charge the campaign, and false-trip the credit guard against
  // a $1.99 balance). budgetAmount (USD string) → maxBudget*Usd + the guard's budgetCents.
  useEffect(() => {
    if (!isSalesFunnel) return;
    setBudgetAmount(effectiveBudget > 0 ? String(Math.round(effectiveBudget * 100) / 100) : "");
  }, [isSalesFunnel, effectiveBudget]);

  // Sales: prefill campaign inputs eagerly once the brand AND feature inputs resolve (no "Go" step).
  // featuresLoading must gate this: the brand query and the ["features"] context load
  // independently, and this effect fires on resolvedBrandUrl. If brand wins the race while
  // featureInputs is still [], prefillToFormData maps only brandUrl, salesPrefilledRef latches,
  // and every other field stays empty forever. Wait for features so featureInputs is populated.
  useEffect(() => {
    if (!isSalesFunnel || featuresLoading || !resolvedBrandUrl || salesPrefilledRef.current) return;
    salesPrefilledRef.current = true;
    setIsLoadingProfile(true);
    prefillFeatureInputs(featureSlug, [brandId, ...additionalBrandIds])
      .then(({ prefilled }) =>
        setFormData(prefillToFormData(prefillToStringMap(prefilled), featureInputs, resolvedBrandUrl)),
      )
      .catch(() => setFormData(buildEmptyForm(featureInputs, resolvedBrandUrl)))
      .finally(() => {
        setIsLoadingProfile(false);
        setShowForm(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSalesFunnel, featuresLoading, resolvedBrandUrl]);

  const doCreateCampaign = useCallback(async () => {
    if (!selectedRow || !budgetAmount) return;

    if (!formData.brandUrl.trim()) {
      setCreateError("Missing: Brand URL");
      isCreatingRef.current = false;
      setIsCreating(false);
      return;
    }
    const missingFields = featureInputs.filter((f) => !formData[f.key]?.trim());
    if (missingFields.length > 0) {
      setCreateError(`Missing: ${missingFields.map((f) => f.label).join(", ")}`);
      isCreatingRef.current = false;
      setIsCreating(false);
      return;
    }

    setCreateError(null);

    const budgetParams: Record<string, string> = {};
    if (budgetFrequency === "one-off") budgetParams.maxBudgetTotalUsd = budgetAmount;
    if (budgetFrequency === "daily") budgetParams.maxBudgetDailyUsd = budgetAmount;
    if (budgetFrequency === "weekly") budgetParams.maxBudgetWeeklyUsd = budgetAmount;
    if (budgetFrequency === "monthly") budgetParams.maxBudgetMonthlyUsd = budgetAmount;

    const generateName = () => {
      const now = new Date();
      return `${selectedRow.workflowDynastyName} \u2014 ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}.${String(now.getMilliseconds()).padStart(3, "0")}`;
    };
    try {
      // Pass all form input values generically
      const inputValues: Record<string, unknown> = {};
      for (const input of featureInputs) {
        const val = formData[input.key]?.trim();
        if (val) inputValues[input.key] = val;
      }

      const brandUrls = [
        formData.brandUrl,
        ...additionalBrands.map((b) => b.url).filter((u): u is string => u != null),
      ];
      const campaignPayload: Record<string, unknown> = {
        workflowSlug: selectedRow.workflowSlug,
        brandUrls,
        featureSlug: featureSlug,
        ...budgetParams,
        featureInputs: inputValues,
      };

      let result: { campaign: Campaign };
      try {
        result = await createCampaign({ name: generateName(), ...campaignPayload } as unknown as Parameters<typeof createCampaign>[0]);
      } catch (firstErr) {
        // Retry once with a fresh timestamp on 409 (duplicate name from race condition)
        if (firstErr instanceof ApiError && firstErr.status === 409) {
          result = await createCampaign({ name: generateName(), ...campaignPayload } as unknown as Parameters<typeof createCampaign>[0]);
        } else {
          throw firstErr;
        }
      }
      sendCampaignEmail("campaign_created", result.campaign).catch(() => {});
      // Seed the campaign-detail cache with the just-created entity so the destination
      // page's ["campaign", id] query is warm — its header/shell paint instantly instead
      // of a cold getCampaign round-trip. The page's poll then refines (brand-url enrichment).
      // (Framework: write the mutation response to the cache, don't just invalidate.)
      queryClient.setQueryData(["campaign", result.campaign.id], { campaign: result.campaign });
      await queryClient.invalidateQueries({ queryKey: ["campaigns", { brandId }] });
      router.push(`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/${result.campaign.id}`);
      // Don't reset isCreating on success — the page is navigating away.
      // Resetting here would briefly flash the button back to its idle state.
    } catch (err) {
      isCreatingRef.current = false;
      setIsCreating(false);
      if (err instanceof ApiError && err.status === 402) {
        // 402 is handled by BillingGuardProvider modal — don't show inline error
      } else if (err instanceof ApiError && err.status === 409) {
        setCreateError("A campaign with this name already exists. Please try again.");
      } else if (err instanceof ApiError && err.body.error === "missing_keys") {
        const mk = (err.body.missing as string[]) ?? [];
        setCreateError(
          `Missing provider keys: ${mk.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}. Configure them in Provider Keys settings before creating a campaign.`
        );
      } else {
        setCreateError(err instanceof Error ? err.message : "Failed to create campaign");
      }
    }
  }, [selectedRow, budgetAmount, budgetFrequency, formData, router, orgId, brandId, featureSlug, featureInputs, additionalBrands]);

  /** Save campaign intent to sessionStorage so we can resume after Stripe checkout */
  const saveCampaignIntent = useCallback(() => {
    if (!selectedRow || !budgetAmount) return;
    const budgetParams: Record<string, string> = {};
    if (budgetFrequency === "one-off") budgetParams.maxBudgetTotalUsd = budgetAmount;
    if (budgetFrequency === "daily") budgetParams.maxBudgetDailyUsd = budgetAmount;
    if (budgetFrequency === "weekly") budgetParams.maxBudgetWeeklyUsd = budgetAmount;
    if (budgetFrequency === "monthly") budgetParams.maxBudgetMonthlyUsd = budgetAmount;

    const { brandUrl: intentBrandUrl, ...intentInputFields } = formData;
    const intentBrandUrls = [
      intentBrandUrl,
      ...additionalBrands.map((b) => b.url).filter((u): u is string => u != null),
    ];
    sessionStorage.setItem("pendingCampaign", JSON.stringify({
      workflowSlug: selectedRow.workflowSlug,
      displayLabel: selectedRow.workflowDynastyName,
      brandUrls: intentBrandUrls,
      ...budgetParams,
      featureInputs: intentInputFields,
    }));
  }, [selectedRow, budgetAmount, budgetFrequency, formData, additionalBrands]);

  /** Proactive credit check: if budget may exceed balance and no auto-topup, show the modal.
   *  If the user already has a saved payment method, silently configure auto-topup and proceed. */
  const handleCreateCampaign = useCallback(async () => {
    if (!selectedRow || !budgetAmount) return;
    if (isCreatingRef.current) return;

    // Show loader immediately on click
    isCreatingRef.current = true;
    setIsCreating(true);

    const budgetCents = Math.round(parseFloat(budgetAmount) * 100);
    if (!budgetCents || budgetCents <= 0) {
      doCreateCampaign();
      return;
    }

    try {
      const account = await getBillingAccount();
      // Match the displayed balance: formatBillingCents ceils to the whole cent, so a
      // $1.996 balance shows "$2.00". Compare against that to avoid a false "exceeds".
      const balanceCents = Math.ceil(parseFloat(account.balance_cents));
      const isRecurring = budgetFrequency !== "one-off";
      const coversFirstPeriod = balanceCents >= budgetCents;

      // Can't even afford the first period → must add credits / set up auto-topup.
      if (!coversFirstPeriod) {
        if (account.has_payment_method) {
          const topupCents = Math.max(1000, budgetCents);
          await configureAutoTopup(topupCents, 500).catch(() => {});
          doCreateCampaign();
          return;
        }
        saveCampaignIntent();
        isCreatingRef.current = false;
        setIsCreating(false);
        showPaymentRequired({
          balance_cents: account.balance_cents,
          required_cents: budgetCents,
          proactive: true,
          onAutoTopupConfigured: () => {
            sessionStorage.removeItem("pendingCampaign");
            doCreateCampaign();
          },
        });
        return;
      }

      // Covers the first period but is recurring without auto-topup → warn how long the
      // credits last, recommend auto-topup, but let the user launch anyway.
      if (isRecurring && !account.has_auto_topup) {
        const periods = Math.max(1, Math.floor(balanceCents / budgetCents));
        saveCampaignIntent();
        isCreatingRef.current = false;
        setIsCreating(false);
        showPaymentRequired({
          balance_cents: account.balance_cents,
          required_cents: budgetCents,
          proactive: true,
          runwayPeriods: periods,
          runwayUnit: REVENUE_INTERVAL_LABEL[budgetFrequency],
          onProceed: () => {
            sessionStorage.removeItem("pendingCampaign");
            doCreateCampaign();
          },
          onAutoTopupConfigured: () => {
            sessionStorage.removeItem("pendingCampaign");
            doCreateCampaign();
          },
        });
        return;
      }
    } catch {
      // If billing check fails, proceed — the API will catch it with a 402 if needed
    }

    doCreateCampaign();
  }, [selectedRow, budgetAmount, budgetFrequency, doCreateCampaign, showPaymentRequired, saveCampaignIntent]);

  // After Stripe checkout return, auto-launch the pending campaign
  const pendingCampaignHandled = useRef(false);
  useEffect(() => {
    if (pendingCampaignHandled.current) return;
    const isSuccess = searchParams.get("success") === "true";
    const hasPending = searchParams.get("pending_campaign") === "true";
    if (!isSuccess || !hasPending) return;

    const raw = sessionStorage.getItem("pendingCampaign");
    if (!raw) return;
    pendingCampaignHandled.current = true;

    // Auto-topup config carried across the Stripe redirect (setup-mode card capture
    // or no-card top-up). Capture before cleaning the URL; the card is now on file so
    // enabling auto-topup below will succeed.
    const pendingTopupRaw = searchParams.get("pending_topup");
    const pendingThresholdRaw = searchParams.get("pending_threshold");

    // Clean URL params
    const url = new URL(window.location.href);
    url.searchParams.delete("success");
    url.searchParams.delete("pending_campaign");
    url.searchParams.delete("pending_topup");
    url.searchParams.delete("pending_threshold");
    window.history.replaceState({}, "", url.toString());

    // Parse and launch
    try {
      const pending = JSON.parse(raw) as Record<string, string>;
      sessionStorage.removeItem("pendingCampaign");

      const { workflowSlug, displayLabel, ...rest } = pending;
      if (!workflowSlug) return;

      const generateName = () => {
        const now = new Date();
        return `${displayLabel || workflowSlug} \u2014 ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}.${String(now.getMilliseconds()).padStart(3, "0")}`;
      };

      setIsCreating(true);
      (async () => {
        try {
          // Enable auto-topup now that the card is captured (no-op if no pending config).
          if (pendingTopupRaw) {
            const topupCents = parseInt(pendingTopupRaw, 10);
            const thresholdCents = pendingThresholdRaw ? parseInt(pendingThresholdRaw, 10) : 500;
            if (Number.isFinite(topupCents)) {
              await configureAutoTopup(topupCents, thresholdCents);
            }
          }
          let result: { campaign: Campaign };
          const payload = { name: generateName(), workflowSlug, featureSlug: featureSlug, ...rest } as unknown as Parameters<typeof createCampaign>[0];
          try {
            result = await createCampaign(payload);
          } catch (firstErr) {
            if (firstErr instanceof ApiError && firstErr.status === 409) {
              result = await createCampaign({ ...payload, name: generateName() });
            } else {
              throw firstErr;
            }
          }
          sendCampaignEmail("campaign_created", result.campaign).catch(() => {});
          await queryClient.invalidateQueries({ queryKey: ["campaigns", { brandId }] });
          router.push(`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/${result.campaign.id}`);
        } catch (err) {
          if (err instanceof ApiError && err.status === 402) {
            // Still insufficient — billing guard will handle
          } else {
            setCreateError(err instanceof Error ? err.message : "Failed to create campaign");
          }
          setIsCreating(false);
        }
      })();
    } catch {
      sessionStorage.removeItem("pendingCampaign");
    }
  }, [searchParams, router, orgId, brandId, featureSlug]);

  if (featuresLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!featureDef) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-medium text-red-800 mb-2">Feature not found</h2>
          <p className="text-sm text-red-600">
            No active feature matches <code className="bg-red-100 px-1.5 py-0.5 rounded">{featureSlug}</code>.
            It may have been deprecated or renamed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Full-screen reassurance while the create-campaign POST is in flight (~3s).
          The new campaign's id doesn't exist until the POST returns, so we can't route
          to its page yet — this overlay tells the user we're working instead of leaving
          the button looking idle. On success, doCreateCampaign navigates (cache pre-seeded
          → the destination paints instantly); isCreating resets only on error. */}
      {isCreating && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <Spinner className="h-8 w-8 text-brand-500" />
          <p className="mt-4 text-sm font-medium text-gray-700">Launching your campaign…</p>
          <p className="mt-1 text-xs text-gray-400">Setting up your workflow and budget. This takes a few seconds.</p>
        </div>
      )}
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Create Campaign</h1>
        <p className="text-gray-600">
          {isSalesFunnel
            ? "Set a revenue goal — we pick the best workflow and size your budget."
            : "Select a workflow and configure your campaign."}
        </p>
      </div>

      {/* Brand info (locked) + additional brands */}
      <div className="space-y-2 mb-4">
        {brand ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                <BrandLogo domain={brand.domain} size={24} fallbackClassName="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-800">{brand.name || brand.domain}</span>
                <span className="text-xs text-gray-400 ml-2">{brand.domain}</span>
              </div>
              <div className="relative ml-auto" ref={brandPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowBrandPicker((v) => !v)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded transition"
                >
                  <EllipsisVerticalIcon className="w-5 h-5" />
                </button>
                {showBrandPicker && (
                  <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg z-50">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Add a co-brand</span>
                    </div>
                    {brandsError ? (
                      <div className="px-3 py-3 text-xs text-red-500">Failed to load brands: {brandsError.message}</div>
                    ) : availableBrands.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-gray-400">No other brands available</div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto py-1">
                        {availableBrands.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setAdditionalBrandIds((prev) => [...prev, b.id]);
                              setShowBrandPicker(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                          >
                            <div className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                              <BrandLogo domain={b.domain} size={18} fallbackClassName="h-4 w-4 text-gray-400" />
                            </div>
                            <span className="truncate">{b.name || b.domain}</span>
                            <PlusIcon className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="ml-auto h-6 w-20" />
            </div>
          </div>
        )}

        {/* Additional brands */}
        {additionalBrands.map((ab) => (
          <div key={ab.id} className="bg-white rounded-xl border border-blue-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                <BrandLogo domain={ab.domain} size={24} fallbackClassName="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-800">{ab.name || ab.domain}</span>
                <span className="text-xs text-gray-400 ml-2">{ab.domain}</span>
              </div>
              <span className="ml-auto text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">Additional</span>
              <button
                type="button"
                onClick={() => setAdditionalBrandIds((prev) => prev.filter((id) => id !== ab.id))}
                className="p-1 text-gray-400 hover:text-red-500 rounded transition"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Missing provider keys warning */}
      {missingProviders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-amber-800">
              <span className="font-medium">Missing provider keys:</span>{" "}
              {missingProviders.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}.
              {" "}Configure them to run campaigns with your own keys.
            </p>
            {org && (
              <Link
                href={`/orgs/${org.id}/provider-keys`}
                className="text-sm text-amber-700 hover:text-amber-900 underline mt-1 inline-block"
              >
                Configure Provider Keys
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ░░ Sales funnel (sales-cold-email) ░░ */}
      {isSalesFunnel && (
        <div className="space-y-4 mb-4">
          {/* 1 · Objective */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="w-5 h-5 inline-flex items-center justify-center text-[11px] font-bold text-white bg-brand-500 rounded-full">1</span>
              <h2 className="font-display font-semibold text-gray-800">How does this campaign sell?</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-4">Pick what this campaign should maximize — we optimize workflow selection for it.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SALES_OBJECTIVES.map((o) => {
                  const active = salesObjective === o.key;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setSalesObjective(o.key)}
                      className={`text-left p-4 rounded-xl border transition ${
                        active ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className={`text-sm font-semibold ${active ? "text-brand-700" : "text-gray-800"}`}>{o.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{o.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2 · Conversion metrics (feature-level, adapts to objective) */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 inline-flex items-center justify-center text-[11px] font-bold text-white bg-brand-500 rounded-full">2</span>
                <h2 className="font-display font-semibold text-gray-800">Your conversion metrics</h2>
              </div>
              {isSalesFunnel && econReady && econSource === "cross-brand-average" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  <SparklesIcon className="w-3 h-3" />
                  Estimated · average of your other brands
                </span>
              )}
              {isSalesFunnel && econReady && econSource === "user" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                  Your saved values
                </span>
              )}
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-4">Reused across every sales campaign for this brand</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1"><InfoLabel label="Customer Lifetime Revenue" tip="Average total revenue (not gross margin) one customer brings over their lifetime." /></label>
                  {econReady ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" min="0" step="100" value={econLtv} onChange={(e) => updateEcon("ltv", e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                  ) : (
                    <Skeleton className="h-9 w-full rounded-lg" />
                  )}
                </div>
                {salesObjective === "meeting-booked" ? (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1"><InfoLabel label="Positive reply → meeting" tip="Of leads who reply positively, the share you turn into a booked meeting." /></label>
                      {econReady ? (
                        <div className="relative">
                          <input type="number" min="0" max="100" step="1" value={econReplyToMeeting} onChange={(e) => updateEcon("replyToMeeting", e.target.value)}
                            className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                        </div>
                      ) : (
                        <Skeleton className="h-9 w-full rounded-lg" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1"><InfoLabel label="Website visit → meeting" tip="Of leads who click through to your website, the share that book a meeting." /></label>
                      {econReady ? (
                        <div className="relative">
                          <input type="number" min="0" max="100" step="1" value={econVisitToMeeting} onChange={(e) => updateEcon("visitToMeeting", e.target.value)}
                            className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                        </div>
                      ) : (
                        <Skeleton className="h-9 w-full rounded-lg" />
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1"><InfoLabel label="Meeting → close" tip="Of booked meetings, the share that become paying customers." /></label>
                      {econReady ? (
                        <div className="relative">
                          <input type="number" min="0" max="100" step="1" value={econMeetingToClose} onChange={(e) => updateEcon("meetingToClose", e.target.value)}
                            className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                        </div>
                      ) : (
                        <Skeleton className="h-9 w-full rounded-lg" />
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1"><InfoLabel label="Website visit → close" tip="Of leads who visit your website, the share that buy without a meeting (self-serve)." /></label>
                    {econReady ? (
                      <div className="relative">
                        <input type="number" min="0" max="100" step="1" value={econClickToClose} onChange={(e) => updateEcon("clickToClose", e.target.value)}
                          className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                    ) : (
                      <Skeleton className="h-9 w-full rounded-lg" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3 · Budget */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="w-5 h-5 inline-flex items-center justify-center text-[11px] font-bold text-white bg-brand-500 rounded-full">3</span>
              <h2 className="font-display font-semibold text-gray-800">Budget</h2>
            </div>
            <div className="p-5">
              {!budgetReady ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-xl" />
                  ))}
                </div>
              ) : (
                <>
              {budgetPresets == null && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-sm text-amber-800">
                  {salesObjective === "self-serve"
                    ? "No workflow has website-visit cost data yet — set a budget below and launch; we optimize on visits as data comes in."
                    : "Fill in your conversion metrics above to see budget recommendations — or set a budget below to launch."}
                </div>
              )}

              {budgetPresets != null ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {budgetPresets.map((p) => {
                    const proj = salesPlan.project(p.monthly);
                    const active = budgetTier === p.key;
                    return (
                      <button key={p.key} type="button" onClick={() => { setBudgetTier(p.key); setBudgetFrequency("daily"); }}
                        className={`text-left p-4 rounded-xl border transition ${active ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-brand-700" : "text-gray-500"}`}>{p.label}</span>
                          {p.key === "recommended" && <span className="text-[10px] text-brand-600">★</span>}
                        </div>
                        <div className="text-xl font-bold text-gray-800 mt-1">{fmtUsd0(p.daily)}<span className="text-xs font-medium text-gray-400"> / day</span></div>
                        <div className="text-[11px] text-gray-400 mt-0.5">targets ~{Math.round(TARGET_CLOSES_PER_MONTH * p.factor)} closes / mo</div>
                        {proj && (
                          <div className="mt-2 text-[11px] leading-relaxed">
                            <div className="text-green-700 font-semibold">~{fmtUsd0(proj.revenue)} revenue / month</div>
                            <div className="text-gray-500"><InfoLabel label="CAC" tip="Customer acquisition cost as a share of the revenue it generates (spend ÷ revenue)." /> {proj.cacPct != null ? `${fmtNum(proj.cacPct)}%` : "—"}</div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => setBudgetTier("other")}
                    className={`text-left p-4 rounded-xl border transition ${budgetTier === "other" ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                    <span className={`text-xs font-semibold uppercase tracking-wide ${budgetTier === "other" ? "text-brand-700" : "text-gray-500"}`}>Other</span>
                    <div className="relative mt-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" min="0" step="50" value={budgetCustom} onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { setBudgetCustom(e.target.value); setBudgetTier("other"); }}
                        placeholder="0" className="w-full pl-6 pr-2 py-1.5 text-lg font-bold text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                    <select value={budgetFrequency} onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { setBudgetFrequency(e.target.value as BudgetFrequency); setBudgetTier("other"); }}
                      className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-300">
                      <option value="one-off">One-off</option>
                      <option value="daily">per day</option>
                      <option value="weekly">per week</option>
                      <option value="monthly">per month</option>
                    </select>
                    {(() => {
                      // Always show expected revenue per MONTH (normalize the custom budget up
                      // to a monthly run-rate), regardless of the chosen cadence — matches the
                      // preset tiles. One-off is shown as-is (single outcome, no "per month").
                      const oneOff = budgetFrequency === "one-off";
                      const cp = salesPlan.project((parseFloat(budgetCustom) || 0) * BUDGET_TO_MONTHLY[budgetFrequency]);
                      return budgetTier === "other" && cp ? (
                        <div className="mt-2 text-[11px] text-green-700 font-semibold">~{fmtUsd0(cp.revenue)} revenue{oneOff ? "" : " / month"}</div>
                      ) : null;
                    })()}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 max-w-sm">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" step="50" value={budgetCustom}
                      onChange={(e) => { setBudgetCustom(e.target.value); setBudgetTier("other"); }}
                      placeholder="0" className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </div>
                  <span className="text-gray-500 text-sm">per</span>
                  <select value={budgetFrequency} onChange={(e) => setBudgetFrequency(e.target.value as BudgetFrequency)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300">
                    <option value="one-off">one-off</option>
                    <option value="daily">day</option>
                    <option value="weekly">week</option>
                    <option value="monthly">month</option>
                  </select>
                </div>
              )}
                </>
              )}

              {(() => {
                // Outcomes are always normalized to a monthly run-rate (multiply the chosen
                // cadence up to a month); the budget chip stays at the chosen cadence. One-off
                // is shown as-is (no normalization, no "per month").
                const oneOff = budgetFrequency === "one-off";
                const proj = salesPlan.project(effectiveBudget * BUDGET_TO_MONTHLY[budgetFrequency]);
                if (!proj) return null;
                const perMonth = oneOff ? "" : " per month";
                const budgetSuffix = oneOff ? "" : ` per ${REVENUE_INTERVAL_LABEL[budgetFrequency]}`;
                const fmtClose = (n: number) => fmtNum(n, n < 2 ? 1 : 0);
                // Each step is a column of one-or-more chips. meeting-booked converges the
                // positive-reply + website-visit routes onto a single combined `meetings` step
                // (the two feeders stack with a "+" and both arrow into meetings).
                const feeders: { v: string; k: string }[] = [];
                if (proj.replies != null) feeders.push({ v: fmtNum(proj.replies), k: `pos. replies${perMonth}` });
                if (proj.visits != null) feeders.push({ v: fmtNum(proj.visits), k: `website visits${perMonth}` });
                const steps: { chips: { v: string; k: string }[]; green?: boolean }[] =
                  salesObjective === "self-serve"
                    ? [
                        { chips: [{ v: fmtUsd0(effectiveBudget), k: `budget${budgetSuffix}` }] },
                        { chips: [{ v: fmtNum(proj.visits ?? 0), k: `website visits${perMonth}` }] },
                        { chips: [{ v: fmtClose(proj.closes), k: `closes${perMonth}` }] },
                        { chips: [{ v: fmtUsd0(proj.revenue), k: `revenue${perMonth}` }], green: true },
                      ]
                    : [
                        { chips: [{ v: fmtUsd0(effectiveBudget), k: `budget${budgetSuffix}` }] },
                        { chips: feeders },
                        { chips: [{ v: fmtClose(proj.meetings ?? 0), k: `meetings${perMonth}` }] },
                        { chips: [{ v: fmtClose(proj.closes), k: `closes${perMonth}` }] },
                        { chips: [{ v: fmtUsd0(proj.revenue), k: `revenue${perMonth}` }], green: true },
                      ];
                return (
                  <div className="mt-4">
                    <p className="text-center text-[11px] uppercase tracking-wide text-gray-400 mb-2">{oneOff ? "Projected outcome" : "Projected per month"}</p>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {steps.map((s, i) => (
                        <Fragment key={s.chips.map((c) => c.k).join("|") || i}>
                          {i > 0 && <span className="text-gray-300">&rarr;</span>}
                          <div className="flex flex-col items-stretch gap-1">
                            {s.chips.map((c, ci) => (
                              <Fragment key={c.k}>
                                {ci > 0 && <span className="text-center text-[10px] text-gray-300 leading-none">+</span>}
                                <div className={`flex flex-col items-center px-3 py-2 rounded-lg border min-w-[84px] ${s.green ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
                                  <span className={`text-base font-semibold ${s.green ? "text-green-700" : "text-gray-800"}`}>{c.v}</span>
                                  <span className="text-[11px] text-gray-500 text-center">{c.k}</span>
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {salesPick && (
                <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500">
                  <SparklesIcon className="w-3.5 h-3.5 text-brand-500" />
                  <span>{salesWorkflowOverrideId ? "selected workflow" : "auto-selected workflow"}</span>
                  <span className="font-medium text-gray-800">{salesPick.workflowDynastyName}</span>
                  <button type="button" onClick={() => { setModalSelectedWorkflowId(salesPick?.id ?? null); setShowWorkflowPicker(true); }}
                    className="ml-1 text-xs font-medium text-brand-600 hover:text-brand-700 underline underline-offset-2 transition">
                    See example emails
                  </button>
                </div>
              )}

              <details className="mt-4 border-t border-gray-100 pt-3">
                <summary className="cursor-pointer text-sm text-gray-500 font-medium select-none">Campaign details</summary>
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={() => setShowChat(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition text-gray-500 hover:text-brand-600 hover:bg-brand-50 border border-gray-200">
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Edit with AI
                  </button>
                </div>
                {isLoadingProfile ? (
                  <p className="mt-3 text-sm text-gray-400">Analyzing brand profile&hellip;</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Brand URL</label>
                      <input type="text" value={formData.brandUrl ?? ""} onChange={(e) => setFormData((p) => ({ ...p, brandUrl: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                    </div>
                    {featureInputs.map((input) => (
                      <div key={input.key}>
                        <label className="block text-xs text-gray-500 mb-1">{input.label}</label>
                        <input type="text" value={formData[input.key] ?? ""} onChange={(e) => setFormData((p) => ({ ...p, [input.key]: e.target.value }))}
                          placeholder={input.placeholder ?? input.description}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300" />
                      </div>
                    ))}
                  </div>
                )}
              </details>

              {createError && <p className="mt-3 text-sm text-red-600">{createError}</p>}

              <button
                onClick={handleCreateCampaign}
                disabled={isCreating || isLoadingProfile || !effectiveBudget || !salesPick}
                className={`mt-4 w-full px-5 py-3 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition flex items-center justify-center gap-2 ${isCreating ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"}`}
              >
                {isCreating && <Spinner />}
                {isCreating ? "Launching…" : "Launch campaign"}
              </button>
            </div>
          </div>

          {showWorkflowPicker && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowWorkflowPicker(false)}>
              <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-gray-800">Choose a workflow</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Ranked by CAC — best ROI for this objective (public cross-org stats). We auto-pick the lowest.</p>
                  </div>
                  <button type="button" onClick={() => setShowWorkflowPicker(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 flex divide-x divide-gray-200">
                  {/* LEFT: workflow list */}
                  <div className="w-1/2 overflow-y-auto p-3 space-y-2">
                    {[...rows].sort((a, b) => {
                      // Rank by the ROI comparator: lowest cost-per-close for this objective.
                      const ca = cpcFor(a.workflowDynastySlug);
                      const cb = cpcFor(b.workflowDynastySlug);
                      return (ca ?? Infinity) - (cb ?? Infinity);
                    }).map((w) => {
                      const isSel = modalSelectedWorkflowId === w.id;
                      const isReco = salesAutoPick?.id === w.id;
                      const isOverride = salesWorkflowOverrideId === w.id;
                      // CAC as % of LTV (lower = better) instead of a scary "$ / close" figure (served).
                      const cacPct = cacPctFor(w.workflowDynastySlug);
                      // Engagement rates as % of volume — drop opens (noise), keep link clicks +
                      // positive replies as conversion rates, not raw counts.
                      const sent = Number(w.stats.recipientsSent) || 0;
                      const clickPct = sent > 0 ? ((Number(w.stats.recipientsClicked) || 0) / sent) * 100 : null;
                      const posReplyPct = sent > 0 ? ((Number(w.stats.recipientsRepliesPositive) || 0) / sent) * 100 : null;
                      const testing = isTestRunning(tests[w.id]?.status) || testStarting[w.id];
                      return (
                        <button key={w.id} type="button"
                          onClick={() => setModalSelectedWorkflowId(w.id)}
                          className={`w-full text-left p-3 rounded-lg border transition flex items-center gap-3 ${isSel ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 truncate">{w.workflowDynastyName}</span>
                              {isReco && <span className="text-[10px] font-semibold text-brand-700 bg-brand-100 rounded px-1.5 py-0.5">Recommended</span>}
                              {isOverride && <span className="text-[10px] font-semibold text-green-700 bg-green-100 rounded px-1.5 py-0.5">In use</span>}
                              {testing && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                                  <span className="w-2.5 h-2.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                  Testing
                                </span>
                              )}
                            </div>
                            <div className="flex gap-3 mt-1 text-[11px] text-gray-500">
                              <span>Sent {fmtNum(sent)}</span>
                              <span>Link clicks {fmtPct(clickPct)}</span>
                              <span>Positive replies {fmtPct(posReplyPct)}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold text-gray-800">{fmtPct(cacPct)}</div>
                            <div className="text-[10px] text-gray-400">
                              <InfoLabel label="CAC" tip="Customer Acquisition Cost — what you spend to win one customer, as a share of their lifetime value (LTV). Lower is better." />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No workflows available.</p>}
                  </div>

                  {/* RIGHT: test emails */}
                  <div className="w-1/2 overflow-y-auto p-4 bg-gray-100">
                    {(() => {
                      const wf = modalSelectedWf;
                      if (!wf) return <p className="text-sm text-gray-500 text-center py-8">Select a workflow to see example emails.</p>;
                      const t = tests[wf.id];
                      const active = isTestRunning(t?.status);
                      const starting = testStarting[wf.id];
                      const testEmails = t?.emails ?? [];
                      const examples = examplesData?.examples ?? [];
                      // A this-session test run takes precedence; otherwise show pre-filled examples.
                      const liveTest = !!t || starting;
                      const showExamples = !liveTest;
                      const cards: TestEmailCardData[] = showExamples ? examples : testEmails;
                      // Loading window = first cold load OR switching workflows (placeholder = the
                      // previous workflow's emails kept by keepPreviousData). Paint skeletons, never
                      // the stale cards. A warm re-click (cache hit < 60s) skips this → instant.
                      const examplesLoading = showExamples && (examplesPending || examplesIsPlaceholder);
                      return (
                        <div>
                          <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-gray-200">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{showExamples && examples.length > 0 ? "Example emails" : "Test emails"}</p>
                              <span className="text-sm font-semibold text-gray-900 truncate block">{wf.workflowDynastyName}</span>
                            </div>
                            <button type="button" disabled={active || starting || !resolvedBrandUrl}
                              onClick={() => runWorkflowTest(wf)}
                              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                              {active || starting ? (
                                <>
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Testing…
                                </>
                              ) : (liveTest || examples.length > 0 ? "Regenerate · 3 leads" : "Run test · 3 leads")}
                            </button>
                          </div>
                          {showExamples && examples.length > 0 ? (
                            <p className="text-[11px] text-gray-500 mb-3">Sample emails this workflow has generated. <span className="text-gray-400">Regenerate to create fresh ones for your brand (sends real emails to 3 leads).</span></p>
                          ) : (
                            <p className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3">⚠ Sends real emails to 3 leads.</p>
                          )}
                          {testError[wf.id] && <p className="text-xs text-red-600 mb-3">{testError[wf.id]}</p>}
                          {t?.error && <p className="text-xs text-red-600 mb-3">{t.error}</p>}
                          {(active || starting) && testEmails.length === 0 && !t?.error && <p className="text-sm text-gray-500 py-6 text-center">Generating emails…</p>}
                          {/* Terminal: the run finished (stopped) but produced no emails — say so instead of an empty panel. */}
                          {!!t && !active && !starting && testEmails.length === 0 && !t.error && <p className="text-sm text-gray-500 py-6 text-center">No emails were generated for this test.</p>}
                          {examplesLoading && (
                            <div className="space-y-2">
                              <ExampleEmailSkeleton />
                              <ExampleEmailSkeleton />
                              <ExampleEmailSkeleton />
                            </div>
                          )}
                          {showExamples && !examplesLoading && examples.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">No examples yet. Run a test to preview real emails for this workflow.</p>}
                          {!examplesLoading && (
                            <div className="space-y-2">
                              {cards.map((e) => (
                                <TestEmailCard key={e.id} email={e}
                                  expanded={expandedTestEmailId === e.id}
                                  onToggle={() => setExpandedTestEmailId((cur) => (cur === e.id ? null : e.id))} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                  {salesWorkflowOverrideId ? (
                    <button type="button" onClick={() => { setSalesWorkflowOverrideId(null); setShowWorkflowPicker(false); }}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700">Reset to recommended</button>
                  ) : <span />}
                  <button type="button" disabled={!modalSelectedWorkflowId}
                    onClick={() => { setSalesWorkflowOverrideId(modalSelectedWorkflowId && modalSelectedWorkflowId !== salesAutoPick?.id ? modalSelectedWorkflowId : null); setShowWorkflowPicker(false); }}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    Use selected workflow
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isSalesFunnel && (<>
      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Mode toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setMode("autopilot")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                mode === "autopilot"
                  ? "bg-brand-50 text-brand-700 border border-brand-200"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent"
              }`}
            >
              Autopilot
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                mode === "manual"
                  ? "bg-brand-50 text-brand-700 border border-brand-200"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent"
              }`}
            >
              Manual
            </button>
          </div>

          {/* Metric dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Metric:</span>
            <select
              value={metric}
              onChange={(e) => {
                const key = e.target.value;
                setMetric(key);
                setSortDir(sortDirectionForType(registry[key]?.type));
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              {sortedOutputs.map((o) => (
                <option key={o.key} value={o.key}>{registry[o.key]?.label ?? o.key}</option>
              ))}
            </select>
          </div>

          <div className="hidden sm:block h-6 w-px bg-gray-200" />

          {/* Budget */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Budget:</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="0"
                className="w-24 pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <select
              value={budgetFrequency}
              onChange={(e) => setBudgetFrequency(e.target.value as BudgetFrequency)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              {BUDGET_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className="hidden sm:block h-6 w-px bg-gray-200" />

          {/* Go button */}
          <button
            onClick={handleGo}
            disabled={!selectedRow || !budgetAmount || !resolvedBrandUrl || isLoadingProfile || showForm}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Go &rarr;
          </button>

        </div>
      </div>

      {/* Loading indicator */}
      {isLoadingProfile && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600">Analyzing brand profile...</span>
          </div>
        </div>
      )}

      {/* Campaign creation form */}
      {showForm && !isLoadingProfile && (
        <div className="mb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-medium text-gray-700">Campaign Details</h3>
                <span className="text-xs text-gray-400 truncate max-w-[300px]">{formData.brandUrl}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChat(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition text-gray-500 hover:text-brand-600 hover:bg-brand-50 border border-gray-200"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                Edit with AI
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {featureInputs.map((input) => (
                <div key={input.key}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {input.label}
                  </label>
                  <input
                    type="text"
                    value={formData[input.key] ?? ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [input.key]: e.target.value }))}
                    placeholder={input.placeholder ?? input.description}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
              ))}
            </div>
            {createError && (
              <p className="mt-3 text-sm text-red-600">{createError}</p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleCreateCampaign}
                disabled={isCreating}
                className={`px-5 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition flex items-center gap-2 ${isCreating ? "cursor-wait" : "disabled:opacity-50"}`}
              >
                {isCreating && <Spinner />}
                {isCreating ? "Creating…" : "Start Campaign"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow table */}
      {isLoading || featuresLoading || workflowsLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No performance data yet</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Performance data will appear here as campaigns run.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Workflow
                  </th>
                  {sortedOutputs.map((o) => (
                    <SortHeader
                      key={o.key}
                      label={registry[o.key]?.label ?? o.key}
                      sortKey={o.key}
                      currentSort={metric}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topRows.map((wf) => (
                  <WorkflowRow
                    key={wf.id}
                    wf={wf}
                    outputs={sortedOutputs}
                    registry={registry}
                    isSelected={true}
                    selectable={false}
                    onSelect={() => {}}
                    onShowDetail={() => setDetailWorkflowId(wf.id)}
                  />
                ))}
                {topRows.length > 0 && restRows.length > 0 && (
                  <tr>
                    <td colSpan={sortedOutputs.length + 1} className="py-0">
                      <div className="border-t-2 border-brand-200" />
                    </td>
                  </tr>
                )}
                {restRows.map((wf) => (
                  <WorkflowRow
                    key={wf.id}
                    wf={wf}
                    outputs={sortedOutputs}
                    registry={registry}
                    isSelected={wf.id === effectiveSelectionId}
                    selectable={true}
                    onSelect={() => { setSelectedWorkflowId(wf.id); setMode("manual"); }}
                    onShowDetail={() => setDetailWorkflowId(wf.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailWorkflowId && (
        <WorkflowDetailPanel
          workflowId={detailWorkflowId}
          onClose={() => setDetailWorkflowId(null)}
        />
      )}
      </>)}

      {/* AI Edit overlay panel (inputs preview + chat) — unconditional: renders for EVERY feature (sales + non-sales) */}
      <CampaignAIPanel
        open={showChat}
        onClose={() => setShowChat(false)}
        chatId={`${brandId}-${featureSlug}`}
        campaignContext={{
          brandId,
          brandUrl: resolvedBrandUrl,
          brandName: brand?.name ?? brand?.domain ?? undefined,
          featureSlug: featureSlug,
          featureName: featureDef?.name ?? featureSlug,
          currentFields: formData,
          fieldDefinitions: featureInputs.map((f) => ({
            key: f.key,
            label: f.label,
            description: f.description,
          })),
          instruction: [
            "You are helping the user refine campaign input fields before launching a campaign.",
            "The current field values are in `currentFields`. The field definitions are in `fieldDefinitions`.",
            "When the user asks to change fields, use the `update_campaign_fields` tool with the updated key-value pairs.",
            "You can also use brand extraction tools to pull information from the brand's website.",
          ].join("\n"),
        }}
        formData={formData}
        featureInputs={featureInputs}
        onFieldsUpdate={(fields) => {
          console.log("[campaign-new] onFieldsUpdate called with:", fields);
          setFormData((prev) => {
            const next = { ...prev };
            const prevKeys = Object.keys(prev);
            console.log("[campaign-new] formData keys:", prevKeys);
            for (const [key, value] of Object.entries(fields)) {
              if (key in next) {
                console.log("[campaign-new] Updating field:", key, "→", value.slice(0, 50));
                next[key] = value;
              } else {
                console.error("[campaign-new] Key not found in formData:", key, "— available keys:", prevKeys);
              }
            }
            return next;
          });
        }}
      />
    </div>
  );
}

function WorkflowRow({
  wf,
  outputs,
  registry,
  isSelected,
  selectable,
  onSelect,
  onShowDetail,
}: {
  wf: WorkflowTableRow;
  outputs: { key: string; displayOrder: number }[];
  registry: Record<string, { type: "count" | "rate" | "currency" | "score"; label: string }>;
  isSelected: boolean;
  selectable: boolean;
  onSelect: () => void;
  onShowDetail?: () => void;
}) {
  return (
    <tr
      className={`${
        isSelected ? "bg-brand-50" : selectable ? "hover:bg-gray-50 cursor-pointer" : "hover:bg-gray-50"
      } transition`}
      onClick={selectable ? onSelect : undefined}
    >
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {isSelected && <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0" />}
          <span className={`text-sm font-medium ${isSelected ? "text-brand-700" : "text-gray-900"}`}>
            {wf.workflowDynastyName}
          </span>
          {onShowDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowDetail(); }}
              className="p-1 text-gray-400 hover:text-brand-600 transition"
              title="View workflow details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      </td>
      {outputs.map((o) => (
        <td key={o.key} className="px-4 py-4 text-sm text-gray-600">
          {formatStatValue(wf.stats[o.key], registry[o.key])}
        </td>
      ))}
    </tr>
  );
}
