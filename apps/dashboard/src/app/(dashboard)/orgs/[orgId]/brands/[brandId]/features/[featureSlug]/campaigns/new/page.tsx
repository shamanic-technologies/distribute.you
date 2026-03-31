"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { useOrg } from "@/lib/org-context";
import { useFeatures } from "@/lib/features-context";
import {
  listWorkflows,
  fetchFeatureStats,
  createCampaign,
  sendCampaignEmail,
  getBrand,
  listBrands,
  getWorkflowKeyStatus,
  prefillFeatureInputs,
  prefillToStringMap,
  getBillingAccount,
  configureAutoReload,
  ApiError,
  type Brand,
  type Campaign,
  type FeatureInput,
  type SystemStats,
} from "@/lib/api";
import { useBillingGuard } from "@/lib/billing-guard";
import { formatStatValue, sortDirectionForType } from "@/lib/format-stat";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";
import { CampaignPrefillChat } from "@/components/campaigns/campaign-prefill-chat";
import { BrandLogo } from "@/components/brand-logo";
import { Skeleton } from "@/components/skeleton";
import { SparklesIcon, XMarkIcon, EllipsisVerticalIcon, PlusIcon } from "@heroicons/react/20/solid";

type Mode = "autopilot" | "manual";
type BudgetFrequency = "one-off" | "daily" | "weekly" | "monthly";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false, placeholderData: keepPreviousData };

const BUDGET_FREQUENCIES: { value: BudgetFrequency; label: string }[] = [
  { value: "one-off", label: "One-off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** A workflow row combining workflow metadata with feature stats. */
interface WorkflowTableRow {
  id: string;
  name: string;
  slug: string;
  dynastyName: string;
  featureSlug: string | null;
  stats: Record<string, number>;
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

export default function FeatureCreateCampaignPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureDynastySlug = params.featureSlug as string;

  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { org } = useOrg();
  const { showPaymentRequired } = useBillingGuard();

  const { getFeature, isLoading: featuresLoading, registry } = useFeatures();
  const featureDef = getFeature(featureDynastySlug);
  const featureInputs = featureDef?.inputs ?? [];
  const outputs = featureDef?.outputs ?? [];

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
  const [budgetFrequency, setBudgetFrequency] = useState<BudgetFrequency>("monthly");
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
  const { data: allBrandsData } = useAuthQuery(
    ["brands"],
    () => listBrands(),
    pollOptions,
  );
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

  // Build CSV brand ID header for multi-brand campaigns
  const allBrandIds = useMemo(
    () => [brandId, ...additionalBrandIds].join(","),
    [brandId, additionalBrandIds],
  );

  // Fetch workflows filtered by feature dynasty slug
  const { data: workflowsData, isLoading: workflowsLoading } = useAuthQuery(
    ["workflows", featureDynastySlug],
    () => listWorkflows({ featureDynastySlug }),
    pollOptions,
  );

  // Fetch feature stats grouped by dynasty (aggregated across all versions)
  const { data: statsData, isLoading } = useAuthQuery(
    ["featureStats", featureDynastySlug, "byDynasty"],
    () => fetchFeatureStats(featureDynastySlug, { groupBy: "workflowDynastySlug" }),
    { enabled: featureDef?.implemented === true, ...pollOptions },
  );

  // Active workflows grouped by dynastySlug: keep only the latest per dynasty
  const rows = useMemo(() => {
    if (!workflowsData?.workflows) return [];
    const byDynasty = new Map<string, (typeof workflowsData.workflows)[number]>();
    for (const wf of workflowsData.workflows) {
      if (!wf.dynastySlug) continue;
      const existing = byDynasty.get(wf.dynastySlug);
      if (!existing || wf.createdAt > existing.createdAt) {
        byDynasty.set(wf.dynastySlug, wf);
      }
    }

    const statsMap = new Map<string, { stats: Record<string, number>; systemStats?: SystemStats }>();
    for (const g of statsData?.groups ?? []) {
      if (g.workflowDynastySlug) statsMap.set(g.workflowDynastySlug, { stats: g.stats, systemStats: g.systemStats });
    }

    return [...byDynasty.values()].map((wf): WorkflowTableRow => {
      const s = statsMap.get(wf.dynastySlug);
      return {
        id: wf.id,
        name: wf.name,
        slug: wf.slug,
        dynastyName: wf.dynastyName,
        featureSlug: wf.featureSlug ?? null,
        stats: s?.stats ?? {},
      };
    });
  }, [workflowsData, statsData]);

  // Workflow IDs for key status check
  const featureWorkflowIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const { data: keyStatusData } = useAuthQuery(
    ["workflowKeyStatus", featureDynastySlug, featureWorkflowIds],
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

  const sorted = useMemo(() => {
    if (rows.length === 0) return [];
    return [...rows].sort((a, b) => {
      const aRaw = a.stats[metric] ?? null;
      const bRaw = b.stats[metric] ?? null;
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
      const { prefilled } = await prefillFeatureInputs(featureDynastySlug, brandId);
      const fields = prefillToStringMap(prefilled);
      setFormData(prefillToFormData(fields, featureInputs, resolvedBrandUrl));
    } catch {
      setFormData(buildEmptyForm(featureInputs, resolvedBrandUrl));
    } finally {
      setIsLoadingProfile(false);
      setShowForm(true);
    }
  }, [selectedRow, budgetAmount, resolvedBrandUrl, brandId, featureDynastySlug, featureInputs]);

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
      return `${selectedRow.dynastyName} \u2014 ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}.${String(now.getMilliseconds()).padStart(3, "0")}`;
    };
    try {
      // Pass all form input values generically
      const inputValues: Record<string, unknown> = {};
      for (const input of featureInputs) {
        const val = formData[input.key]?.trim();
        if (val) inputValues[input.key] = val;
      }

      const brandHeaders: Record<string, string> = { "x-brand-id": allBrandIds };
      const campaignPayload: Record<string, unknown> = {
        workflowSlug: selectedRow.slug,
        brandUrl: formData.brandUrl,
        featureSlug: featureDynastySlug,
        ...budgetParams,
        featureInputs: inputValues,
        headers: brandHeaders,
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
      await queryClient.invalidateQueries({ queryKey: ["campaigns", { brandId }] });
      router.push(`/orgs/${orgId}/brands/${brandId}/features/${featureDynastySlug}`);
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
  }, [selectedRow, budgetAmount, budgetFrequency, formData, router, orgId, brandId, featureDynastySlug, featureInputs, allBrandIds]);

  /** Save campaign intent to sessionStorage so we can resume after Stripe checkout */
  const saveCampaignIntent = useCallback(() => {
    if (!selectedRow || !budgetAmount) return;
    const budgetParams: Record<string, string> = {};
    if (budgetFrequency === "one-off") budgetParams.maxBudgetTotalUsd = budgetAmount;
    if (budgetFrequency === "daily") budgetParams.maxBudgetDailyUsd = budgetAmount;
    if (budgetFrequency === "weekly") budgetParams.maxBudgetWeeklyUsd = budgetAmount;
    if (budgetFrequency === "monthly") budgetParams.maxBudgetMonthlyUsd = budgetAmount;

    const { brandUrl: intentBrandUrl, ...intentInputFields } = formData;
    sessionStorage.setItem("pendingCampaign", JSON.stringify({
      workflowSlug: selectedRow.slug,
      displayLabel: selectedRow.dynastyName,
      brandUrl: intentBrandUrl,
      ...budgetParams,
      featureInputs: intentInputFields,
    }));
  }, [selectedRow, budgetAmount, budgetFrequency, formData]);

  /** Proactive credit check: if budget may exceed balance and no auto-reload, show the modal.
   *  If the user already has a saved payment method, silently configure auto-reload and proceed. */
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
      const willExceed = budgetCents > account.creditBalanceCents;
      const isRecurring = budgetFrequency !== "one-off";

      if ((willExceed || isRecurring) && !account.hasAutoReload) {
        if (account.hasPaymentMethod) {
          // Saved card exists — silently enable auto-reload and proceed.
          // The backend will charge the card automatically during deduction.
          const reloadCents = Math.max(1000, budgetCents);
          await configureAutoReload(reloadCents, 500).catch(() => {});
          doCreateCampaign();
          return;
        }
        // No payment method — show modal so user can add a card
        saveCampaignIntent();
        // Reset loader — modal will handle the flow
        isCreatingRef.current = false;
        setIsCreating(false);
        showPaymentRequired({
          balance_cents: account.creditBalanceCents,
          required_cents: budgetCents,
          proactive: true,
          onAutoReloadConfigured: () => {
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

    // Clean URL params
    const url = new URL(window.location.href);
    url.searchParams.delete("success");
    url.searchParams.delete("pending_campaign");
    url.searchParams.delete("pending_reload");
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
          let result: { campaign: Campaign };
          const payload = { name: generateName(), workflowSlug, featureSlug: featureDynastySlug, ...rest } as unknown as Parameters<typeof createCampaign>[0];
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
          router.push(`/orgs/${orgId}/brands/${brandId}/features/${featureDynastySlug}`);
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
  }, [searchParams, router, orgId, brandId, featureDynastySlug]);

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
            No active feature matches <code className="bg-red-100 px-1.5 py-0.5 rounded">{featureDynastySlug}</code>.
            It may have been deprecated or renamed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Create Campaign</h1>
        <p className="text-gray-600">Select a workflow and configure your campaign.</p>
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
              <span className="ml-auto text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">Locked</span>
              <div className="relative" ref={brandPickerRef}>
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
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Add a brand</span>
                    </div>
                    {availableBrands.length === 0 ? (
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

      {/* Campaign creation form + AI chat panel */}
      {showForm && !isLoadingProfile && (
        <div className={`mb-4 ${showChat ? "flex gap-4" : ""}`}>
          {/* Form card */}
          <div className={`bg-white rounded-xl border border-gray-200 p-5 ${showChat ? "flex-1 min-w-0" : ""}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-medium text-gray-700">Campaign Details</h3>
                <span className="text-xs text-gray-400 truncate max-w-[300px]">{formData.brandUrl}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChat((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  showChat
                    ? "bg-brand-50 text-brand-700 border border-brand-200"
                    : "text-gray-500 hover:text-brand-600 hover:bg-brand-50 border border-gray-200"
                }`}
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

          {/* AI Chat panel */}
          {showChat && (
            <div className="w-[420px] flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: "calc(100vh - 320px)", minHeight: 400 }}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 text-brand-500" />
                  <span className="text-sm font-medium text-gray-700">Edit with AI</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChat(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              <CampaignPrefillChat
                chatId={`${brandId}-${featureDynastySlug}`}
                campaignContext={{
                  brandId,
                  brandUrl: resolvedBrandUrl,
                  brandName: brand?.name ?? brand?.domain ?? undefined,
                  featureSlug: featureDynastySlug,
                  featureName: featureDef?.name ?? featureDynastySlug,
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
                onFieldsUpdate={(fields) => {
                  setFormData((prev) => {
                    const next = { ...prev };
                    for (const [key, value] of Object.entries(fields)) {
                      if (key in next) next[key] = value;
                    }
                    return next;
                  });
                }}
              />
            </div>
          )}
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
  registry: Record<string, { type: "count" | "rate" | "currency"; label: string }>;
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
            {wf.dynastyName}
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
