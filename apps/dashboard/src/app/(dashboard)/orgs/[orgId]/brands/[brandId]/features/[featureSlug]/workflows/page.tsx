"use client";

import { useMemo, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { keepPreviousData, useMutation } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  fetchFeatureStats,
  generateWorkflow,
  listWorkflows,
  type FeatureOutput,
  type StatsRegistry,
} from "@/lib/api";
import { useFeatures } from "@/lib/features-context";
import { formatStatValue, sortDirectionForType } from "@/lib/format-stat";
import { PlusIcon } from "@heroicons/react/20/solid";
import { Skeleton } from "@/components/skeleton";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false, placeholderData: keepPreviousData };

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

export default function FeatureWorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;

  const { getFeature, isLoading: featuresLoading, registry } = useFeatures();
  const wfDef = getFeature(featureSlug);
  const outputs = wfDef?.outputs ?? [];

  // Determine default sort from outputs
  const defaultSortOutput = outputs.find((o) => o.defaultSort);
  const defaultSortKey = defaultSortOutput?.key ?? outputs[0]?.key ?? "";
  const defaultSortDir = defaultSortOutput?.sortDirection
    ?? sortDirectionForType(registry[defaultSortKey]?.type)
    ?? "desc";

  const [metric, setMetric] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  const createMutation = useMutation({
    mutationFn: () =>
      generateWorkflow({
        description: `Create a ${wfDef?.name ?? featureSlug} workflow: ${wfDef?.description ?? "automated workflow for this feature"}.`,
        hints: {
          services: wfDef ? [wfDef.category] : undefined,
        },
      }),
    onSuccess: (result) => {
      router.push(
        `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/workflows/${result.workflow.id}`,
      );
    },
  });

  // Fetch stats grouped by workflow
  const { data: statsData, isLoading } = useAuthQuery(
    ["featureStats", featureSlug, "byWorkflow"],
    () => fetchFeatureStats(featureSlug, { groupBy: "workflowName" }),
    { enabled: wfDef?.implemented === true, ...pollOptions },
  );

  // Fetch workflow list to resolve name → id
  const { data: workflowsData } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
    pollOptions,
  );

  const workflowNameToId = useMemo(() => {
    const map = new Map<string, string>();
    if (workflowsData?.workflows) {
      for (const wf of workflowsData.workflows) {
        if (!map.has(wf.name)) map.set(wf.name, wf.id);
      }
    }
    return map;
  }, [workflowsData]);

  const rows = useMemo(() => {
    if (!statsData?.groups) return [];
    return statsData.groups.map((g) => ({
      workflowName: g.workflowName ?? "unknown",
      displayLabel: formatWorkflowDisplayName(g.workflowName ?? "unknown"),
      stats: g.stats,
      systemStats: g.systemStats,
    }));
  }, [statsData]);

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

  const sortedOutputs = useMemo(
    () => [...outputs].sort((a, b) => a.displayOrder - b.displayOrder),
    [outputs]
  );

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Workflows</h1>
          <p className="text-gray-600">
            Workflows for {wfDef?.name ?? featureSlug}.
          </p>
        </div>
        <button
          type="button"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createMutation.isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating\u2026
            </>
          ) : (
            <>
              <PlusIcon className="w-4 h-4" />
              New Workflow
            </>
          )}
        </button>
      </div>
      {createMutation.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to create workflow. Please try again.
        </div>
      )}

      {isLoading || featuresLoading ? (
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  {Array.from({ length: sortedOutputs.length + 1 }).map((_, j) => (
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sorted.map((wf) => (
                  <tr
                    key={wf.workflowName}
                    className="hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => {
                      const wfId = workflowNameToId.get(wf.workflowName);
                      if (wfId) {
                        router.push(`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/workflows/${wfId}`);
                      }
                    }}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{wf.displayLabel}</span>
                      </div>
                    </td>
                    {sortedOutputs.map((o) => (
                      <td key={o.key} className="px-4 py-4 text-sm text-gray-600">
                        {formatStatValue(wf.stats[o.key], registry[o.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function formatWorkflowDisplayName(name: string): string {
  const lastDashIdx = name.lastIndexOf("-");
  const suffix = lastDashIdx >= 0 ? name.slice(lastDashIdx + 1) : name;
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
}
