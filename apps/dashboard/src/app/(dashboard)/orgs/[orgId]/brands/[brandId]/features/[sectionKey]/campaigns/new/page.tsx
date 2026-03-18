"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useOrg } from "@/lib/org-context";
import {
  fetchRankedWorkflows,
  createCampaign,
  sendCampaignEmail,
  getBrand,
  getWorkflowKeyStatus,
  getBrandSalesProfile,
  createBrandSalesProfile,
  ApiError,
  type RankedWorkflowItem,
  type SalesProfile,
} from "@/lib/api";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";
import { BrandLogo } from "@/components/brand-logo";

type Mode = "autopilot" | "manual";
type SortKey = "openRate" | "clickRate" | "replyRate" | "costPerOpenCents" | "costPerClickCents" | "costPerReplyCents";
type MetricOption = { label: string; sortKey: SortKey };
type BudgetFrequency = "one-off" | "daily" | "weekly" | "monthly";

const METRIC_OPTIONS: MetricOption[] = [
  { label: "$/Reply", sortKey: "costPerReplyCents" },
  { label: "$/Click", sortKey: "costPerClickCents" },
  { label: "% Replies", sortKey: "replyRate" },
  { label: "% Clicks", sortKey: "clickRate" },
];

const POLL_INTERVAL = 30_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false, placeholderData: keepPreviousData };

const COST_METRICS: Set<SortKey> = new Set(["costPerOpenCents", "costPerClickCents", "costPerReplyCents"]);
function defaultSortDir(key: SortKey): "asc" | "desc" {
  return COST_METRICS.has(key) ? "asc" : "desc";
}

const BUDGET_FREQUENCIES: { value: BudgetFrequency; label: string }[] = [
  { value: "one-off", label: "One-off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function formatPercent(rate: number): string {
  if (rate === 0) return "\u2014";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCostCents(cents: number | null): string {
  if (cents === null || cents === 0) return "\u2014";
  return `$${(cents / 100).toFixed(2)}`;
}

/** Extract the family display name from displayName. Strips the sectionKey prefix to show just the codename. */
function formatDisplayName(displayName: string | null, fallbackName: string): string {
  const raw = displayName || fallbackName;
  // Strip sectionKey prefix (e.g. "sales-email-cold-outreach-jasmine" → "jasmine")
  const lastDashIdx = raw.lastIndexOf("-");
  const suffix = lastDashIdx >= 0 ? raw.slice(lastDashIdx + 1) : raw;
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
}

/** Flatten a RankedWorkflowItem into a sortable table row. */
interface WorkflowTableRow {
  id: string;
  name: string;
  displayName: string;
  signatureName: string;
  category: string;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
}

function rankedToRow(item: RankedWorkflowItem): WorkflowTableRow {
  const b = item.stats.email.broadcast;
  const cost = item.stats.totalCostInUsdCents;
  return {
    id: item.workflow.id,
    name: item.workflow.name,
    displayName: item.workflow.displayName ?? item.workflow.name,
    signatureName: item.workflow.signatureName,
    category: item.workflow.category,
    emailsSent: b.emailsSent,
    openRate: b.emailsSent > 0 ? b.emailsOpened / b.emailsSent : 0,
    clickRate: b.emailsSent > 0 ? b.emailsClicked / b.emailsSent : 0,
    replyRate: b.emailsSent > 0 ? b.emailsReplied / b.emailsSent : 0,
    costPerOpenCents: b.emailsOpened > 0 ? cost / b.emailsOpened : null,
    costPerClickCents: b.emailsClicked > 0 ? cost / b.emailsClicked : null,
    costPerReplyCents: b.emailsReplied > 0 ? cost / b.emailsReplied : null,
  };
}

interface CampaignFormData {
  brandUrl: string;
  targetAudience: string;
  targetOutcome: string;
  valueForTarget: string;
  urgency: string;
  scarcity: string;
  riskReversal: string;
  socialProof: string;
}

const EMPTY_FORM: CampaignFormData = {
  brandUrl: "",
  targetAudience: "",
  targetOutcome: "",
  valueForTarget: "",
  urgency: "",
  scarcity: "",
  riskReversal: "",
  socialProof: "",
};

const FORM_FIELDS: { key: keyof CampaignFormData; label: string; placeholder: string }[] = [
  { key: "targetAudience", label: "Target Audience", placeholder: "CTOs at SaaS startups with 10-50 employees" },
  { key: "targetOutcome", label: "Target Outcome", placeholder: "Book sales demos" },
  { key: "valueForTarget", label: "Value for Target", placeholder: "What do they gain from responding?" },
  { key: "urgency", label: "Urgency", placeholder: "Limited-time offer ending March 1st" },
  { key: "scarcity", label: "Scarcity", placeholder: "Only 10 spots available" },
  { key: "riskReversal", label: "Risk Reversal", placeholder: "Free trial, no commitment" },
  { key: "socialProof", label: "Social Proof", placeholder: "500+ companies already onboarded" },
];

function profileToFormData(profile: SalesProfile, brandUrl: string): CampaignFormData {
  const socialParts: string[] = [];
  if (profile.socialProof?.results?.length) socialParts.push(...profile.socialProof.results);
  if (profile.socialProof?.caseStudies?.length) socialParts.push(...profile.socialProof.caseStudies);

  const riskParts: string[] = [];
  if (profile.riskReversal?.trialInfo) riskParts.push(profile.riskReversal.trialInfo);
  if (profile.riskReversal?.guarantees?.length) riskParts.push(...profile.riskReversal.guarantees);
  if (profile.riskReversal?.refundPolicy) riskParts.push(profile.riskReversal.refundPolicy);

  return {
    brandUrl,
    targetAudience: profile.targetAudience ?? "",
    targetOutcome: profile.callToAction ?? "",
    valueForTarget: profile.valueProposition ?? "",
    urgency: profile.urgency?.summary ?? "",
    scarcity: profile.scarcity?.summary ?? "",
    riskReversal: riskParts.join(". ") || "",
    socialProof: socialParts.slice(0, 3).join(". ") || "",
  };
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
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

export default function FeatureCreateCampaignPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const sectionKey = params.sectionKey as string;

  const router = useRouter();
  const { org } = useOrg();

  const featureId = sectionKey;
  const featureDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === featureId);

  // State
  const [mode, setMode] = useState<Mode>("autopilot");
  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);
  const [metric, setMetric] = useState<SortKey>("costPerReplyCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetFrequency, setBudgetFrequency] = useState<BudgetFrequency>("monthly");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CampaignFormData>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Fetch brand info
  const { data: brandData } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
    pollOptions,
  );
  const brand = brandData?.brand ?? null;

  // Fetch ranked workflows (family-aggregated stats from workflow-service)
  const { data: rankedItems, isLoading } = useAuthQuery(
    ["ranked-workflows", featureDef?.category, featureDef?.channel, featureDef?.audienceType],
    () => fetchRankedWorkflows({
      category: featureDef!.category,
      channel: featureDef!.channel,
      audienceType: featureDef!.audienceType,
      limit: 100,
    }),
    { enabled: featureDef?.implemented === true, ...pollOptions },
  );

  // Flatten ranked items into sortable rows
  const rows = useMemo(() => (rankedItems ?? []).map(rankedToRow), [rankedItems]);

  // Workflow IDs for key status check
  const featureWorkflowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const { data: keyStatusData } = useAuthQuery(
    ["workflowKeyStatus", featureId, featureWorkflowIds],
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

  const handleSort = useCallback((key: SortKey) => {
    setMetric((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        return prev;
      }
      setSortDir(defaultSortDir(key));
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (rows.length === 0) return [];
    return [...rows].sort((a, b) => {
      const aRaw = a[metric];
      const bRaw = b[metric];
      const aNull = aRaw === null || aRaw === 0;
      const bNull = bRaw === null || bRaw === 0;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return sortDir === "desc" ? Number(bRaw) - Number(aRaw) : Number(aRaw) - Number(bRaw);
    });
  }, [rows, metric, sortDir]);

  // Selection uses workflow ID as stable key
  const effectiveSelectionId = mode === "autopilot"
    ? sorted[0]?.id ?? null
    : selectedWorkflowId;

  const selectedRow = sorted.find((r) => r.id === effectiveSelectionId) ?? null;

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

  const resolvedBrandUrl = brand?.brandUrl ?? "";

  const handleGo = useCallback(async () => {
    if (!selectedRow || !budgetAmount || !resolvedBrandUrl) return;
    setCreateError(null);
    setIsLoadingProfile(true);
    try {
      // Try GET first — returns null if no profile yet
      const existing = await getBrandSalesProfile(brandId);
      if (existing) {
        setFormData(profileToFormData(existing.profile, resolvedBrandUrl));
      } else {
        // No profile yet — trigger extraction via POST and wait
        const { profile } = await createBrandSalesProfile(brandId);
        setFormData(profileToFormData(profile, resolvedBrandUrl));
      }
    } catch {
      setFormData({ ...EMPTY_FORM, brandUrl: resolvedBrandUrl });
    } finally {
      setIsLoadingProfile(false);
      setShowForm(true);
    }
  }, [selectedRow, budgetAmount, resolvedBrandUrl, brandId]);

  const handleCreateCampaign = useCallback(async () => {
    if (!selectedRow || !budgetAmount) return;

    if (!formData.brandUrl.trim()) {
      setCreateError("Missing: Brand URL");
      return;
    }
    const missing = FORM_FIELDS.filter((f) => !formData[f.key].trim());
    if (missing.length > 0) {
      setCreateError(`Missing: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    const budgetParams: Record<string, string> = {};
    if (budgetFrequency === "one-off") budgetParams.maxBudgetTotalUsd = budgetAmount;
    if (budgetFrequency === "daily") budgetParams.maxBudgetDailyUsd = budgetAmount;
    if (budgetFrequency === "weekly") budgetParams.maxBudgetWeeklyUsd = budgetAmount;
    if (budgetFrequency === "monthly") budgetParams.maxBudgetMonthlyUsd = budgetAmount;

    const displayLabel = formatDisplayName(selectedRow.displayName, selectedRow.name);
    try {
      const { campaign } = await createCampaign({
        name: `${displayLabel} \u2014 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}`,
        workflowName: selectedRow.name,
        ...formData,
        ...budgetParams,
      });
      sendCampaignEmail("campaign_created", campaign).catch(() => {});
      router.push(`/orgs/${orgId}/brands/${brandId}/features/${sectionKey}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCreateError("A campaign with this name already exists. Please try again.");
      } else if (err instanceof ApiError && err.body.error === "missing_keys") {
        const missing = (err.body.missing as string[]) ?? [];
        setCreateError(
          `Missing provider keys: ${missing.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}. Configure them in Provider Keys settings before creating a campaign.`
        );
      } else {
        setCreateError(err instanceof Error ? err.message : "Failed to create campaign");
      }
    } finally {
      setIsCreating(false);
    }
  }, [selectedRow, budgetAmount, budgetFrequency, formData, router, orgId, brandId, sectionKey]);

  if (!featureDef) return null;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Create Campaign</h1>
        <p className="text-gray-600">Select a workflow and configure your campaign.</p>
      </div>

      {/* Brand info (locked) */}
      {brand ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
              <BrandLogo domain={brand.domain} size={24} fallbackClassName="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-800">{brand.name || brand.domain}</span>
              <span className="text-xs text-gray-400 ml-2">{brand.domain}</span>
            </div>
            <span className="ml-auto text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">Brand locked</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="ml-auto h-6 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      )}

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
                const key = e.target.value as SortKey;
                setMetric(key);
                setSortDir(defaultSortDir(key));
              }}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              {METRIC_OPTIONS.map((opt) => (
                <option key={opt.sortKey} value={opt.sortKey}>{opt.label}</option>
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
            disabled={!selectedRow || !budgetAmount || !resolvedBrandUrl}
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
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-gray-700">Campaign Details</h3>
              <span className="text-xs text-gray-400 truncate max-w-[300px]">{formData.brandUrl}</span>
            </div>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FORM_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  type="text"
                  value={formData[field.key]}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
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
              className="px-5 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Start Campaign"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Workflow table */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="animate-pulse p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
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
                  <SortHeader label="% Opens" sortKey="openRate" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="% Clicks" sortKey="clickRate" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="% Replies" sortKey="replyRate" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="$/Open" sortKey="costPerOpenCents" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="$/Click" sortKey="costPerClickCents" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="$/Reply" sortKey="costPerReplyCents" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topRows.map((wf) => (
                  <WorkflowRow
                    key={wf.id}
                    wf={wf}
                    isSelected={true}
                    selectable={false}
                    onSelect={() => {}}
                    onShowDetail={() => setDetailWorkflowId(wf.id)}
                  />
                ))}
                {topRows.length > 0 && restRows.length > 0 && (
                  <tr>
                    <td colSpan={7} className="py-0">
                      <div className="border-t-2 border-brand-200" />
                    </td>
                  </tr>
                )}
                {restRows.map((wf) => (
                  <WorkflowRow
                    key={wf.id}
                    wf={wf}
                    isSelected={wf.id === effectiveSelectionId}
                    selectable={mode === "manual"}
                    onSelect={() => setSelectedWorkflowId(wf.id)}
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
    </div>
  );
}

function WorkflowRow({
  wf,
  isSelected,
  selectable,
  onSelect,
  onShowDetail,
}: {
  wf: WorkflowTableRow;
  isSelected: boolean;
  selectable: boolean;
  onSelect: () => void;
  onShowDetail?: () => void;
}) {
  const label = formatDisplayName(wf.displayName, wf.name);

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
            {label}
          </span>
          {wf.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {wf.category}
            </span>
          )}
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
      <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.openRate) : "\u2014"}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.clickRate) : "\u2014"}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.replyRate) : "\u2014"}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerOpenCents)}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerClickCents)}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerReplyCents)}</td>
    </tr>
  );
}
