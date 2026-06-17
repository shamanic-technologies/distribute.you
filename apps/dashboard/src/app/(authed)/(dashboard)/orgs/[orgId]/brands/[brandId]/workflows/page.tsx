"use client";

import { useSoleFeatureSlug } from "@/lib/sole-feature";

import { useMemo, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  fetchGlobalRankedWorkflows,
  getWorkflowProjection,
  keepLastGoodWorkflowProjection,
  listWorkflows,
  type WorkflowProjectionResponse,
} from "@/lib/api";
import { useFeatures } from "@/lib/features-context";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useFeatureFlag } from "@/lib/use-feature-flag";
import { FEATURE_GATES } from "@/lib/feature-gates";
import { MaturityBadge } from "@/components/maturity-badge";
import { formatStatValue, sortDirectionForType } from "@/lib/format-stat";
import { PlusIcon } from "@heroicons/react/20/solid";
import { Skeleton } from "@/components/skeleton";
import { DashboardPage } from "@/components/dashboard-page";

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
      {label} {active ? (currentDir === "desc" ? "↓" : "↑") : ""}
    </th>
  );
}

function formatRoi(roi: number | null | undefined): string {
  return roi == null ? "—" : `${roi.toFixed(1)}×`;
}

export default function FeatureWorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = useSoleFeatureSlug();

  // Workflows is alpha (staff-only). Default-hidden until PostHog resolves, so
  // it never flashes for a non-staff viewer who lands on the URL directly.
  const ok = useFeatureFlag(FEATURE_GATES["workflows"].flag);

  const { getFeature, isLoading: featuresLoading, registry } = useFeatures();
  const wfDef = getFeature(featureSlug);
  const outputs = wfDef?.outputs ?? [];

  // Determine default sort from outputs
  const defaultSortOutput = outputs.find((o) => o.defaultSort);
  const defaultSortKey = defaultSortOutput?.key ?? outputs[0]?.key ?? "";
  const defaultSortDir = defaultSortOutput?.sortDirection
    ?? sortDirectionForType(registry[defaultSortKey]?.type)
    ?? "desc";
  const revenueEnabled = isRevenueFeature(featureSlug);

  const [metric, setMetric] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  const handleCreateWorkflow = useCallback(() => {
    router.push(`/orgs/${orgId}/brands/${brandId}/workflows/new`);
  }, [router, orgId, brandId, featureSlug]);

  // Fetch cross-org/brand ranked workflow stats (global leaderboard)
  const { data: rankedData, isLoading } = useAuthQuery(
    ["globalRankedWorkflows", featureSlug, defaultSortKey],
    () => fetchGlobalRankedWorkflows({
      featureSlug,
      objective: defaultSortKey,
      groupBy: "workflow",
      limit: 100,
    }),
    { enabled: wfDef?.implemented === true && defaultSortKey !== "" },
  );

  // Fetch workflows filtered by feature slug
  const { data: workflowsData, isLoading: workflowsLoading } = useAuthQuery(
    ["workflows", featureSlug],
    () => listWorkflows({ featureSlug }),
  );

  // Per-workflow PROJECTED ROI (no realized per-workflow revenue stat exists):
  // features-service workflow-projection × the brand's saved sales-economics.
  // ROI = 100 / cacPct, budget-invariant (budgetUsd:1 just populates `projection`).
  // This is the cold Neon chain, so it is NOT gated into the table barrier below —
  // the table reveals on workflows+ranked and each ROI cell shows its own skeleton
  // while pending. keep-last-good guards a degenerate cold-chain refocus refetch.
  const { data: projection } = useAuthQuery(
    ["workflowProjection", brandId, featureSlug],
    () => getWorkflowProjection({ featureSlug, brandId, objective: "meeting-booked", budgetUsd: 1 }),
    {
      enabled: revenueEnabled && wfDef?.implemented === true,
      structuralSharing: (prev, next) =>
        keepLastGoodWorkflowProjection(
          prev as WorkflowProjectionResponse | undefined,
          next as WorkflowProjectionResponse,
        ),
    },
  );
  const roiPending = revenueEnabled && projection === undefined;

  const roiByDynasty = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of projection?.workflows ?? []) {
      const cacPct = w.projection?.cacPct;
      if (cacPct != null && cacPct > 0) map.set(w.workflowDynastySlug, 100 / cacPct);
    }
    return map;
  }, [projection]);

  // Active workflows grouped by workflowDynastySlug: keep only the latest per dynasty
  const dynastyWorkflows = useMemo(() => {
    if (!workflowsData?.workflows) return [];
    const byDynasty = new Map<string, (typeof workflowsData.workflows)[number]>();
    for (const wf of workflowsData.workflows) {
      if (!wf.workflowDynastySlug) continue;
      const existing = byDynasty.get(wf.workflowDynastySlug);
      if (!existing || wf.createdAt > existing.createdAt) {
        byDynasty.set(wf.workflowDynastySlug, wf);
      }
    }
    return [...byDynasty.values()];
  }, [workflowsData]);

  const rows = useMemo(() => {
    const statsMap = new Map<string, Record<string, number | null>>();
    for (const r of rankedData ?? []) {
      if (r.workflow.workflowDynastySlug) statsMap.set(r.workflow.workflowDynastySlug, r.stats);
    }

    return dynastyWorkflows.map((wf) => ({
      id: wf.id,
      workflowSlug: wf.workflowSlug,
      workflowDynastySlug: wf.workflowDynastySlug,
      workflowDynastyName: wf.workflowDynastyName,
      stats: statsMap.get(wf.workflowDynastySlug) ?? {},
      roi: roiByDynasty.get(wf.workflowDynastySlug) ?? null,
    }));
  }, [rankedData, dynastyWorkflows, roiByDynasty]);

  const handleSort = useCallback((key: string) => {
    setMetric((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        return prev;
      }
      const dir = key === "roi" ? "desc" : sortDirectionForType(registry[key]?.type);
      setSortDir(dir);
      return key;
    });
  }, [registry]);

  const sorted = useMemo(() => {
    if (rows.length === 0) return [];
    return [...rows].sort((a, b) => {
      const aRaw = metric === "roi" ? a.roi : a.stats[metric] ?? null;
      const bRaw = metric === "roi" ? b.roi : b.stats[metric] ?? null;
      const aNull = aRaw === null || aRaw === 0;
      const bNull = bRaw === null || bRaw === 0;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return sortDir === "desc" ? Number(bRaw) - Number(aRaw) : Number(aRaw) - Number(bRaw);
    });
  }, [rows, metric, sortDir]);

  const sortedOutputs = useMemo(
    () => [...outputs].sort((a, b) => a.displayOrder - b.displayOrder),
    [outputs]
  );

  if (!ok) {
    return (
      <DashboardPage width="wide">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage width="wide">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-gray-800">Workflows</h1>
            <MaturityBadge level={FEATURE_GATES["workflows"].maturity} />
          </div>
          <p className="text-gray-600">
            Workflows for {wfDef?.name ?? featureSlug}.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateWorkflow}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Workflow
        </button>
      </div>
      {isLoading || featuresLoading || workflowsLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                {sortedOutputs.map((o) => (
                  <th key={o.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {registry[o.key]?.label ?? o.key}
                  </th>
                ))}
                {revenueEnabled && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ROI</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  {Array.from({ length: sortedOutputs.length + 1 + (revenueEnabled ? 1 : 0) }).map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <Skeleton className={`h-4 ${j === 0 ? "w-32" : "w-16"}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No workflows yet</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Create a workflow to get started.
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
                  {revenueEnabled && (
                    <SortHeader
                      label="ROI"
                      sortKey="roi"
                      currentSort={metric}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sorted.map((wf) => (
                  <tr
                    key={wf.id}
                    className="hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => {
                      router.push(`/orgs/${orgId}/brands/${brandId}/workflows/${wf.id}`);
                    }}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{wf.workflowDynastyName}</span>
                      </div>
                    </td>
                    {sortedOutputs.map((o) => (
                      <td key={o.key} className="px-4 py-4 text-sm text-gray-600">
                        {formatStatValue(wf.stats[o.key], registry[o.key])}
                      </td>
                    ))}
                    {revenueEnabled && (
                      <td className="px-4 py-4 text-sm font-medium text-green-700">
                        {roiPending ? <Skeleton className="h-4 w-12" /> : formatRoi(wf.roi)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardPage>
  );
}
