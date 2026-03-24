"use client";

import { useMemo, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { keepPreviousData, useMutation } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  fetchRankedWorkflows,
  generateWorkflow,
  type RankedWorkflowItem,
} from "@/lib/api";
import { useFeatures } from "@/lib/features-context";
import { PlusIcon } from "@heroicons/react/20/solid";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false, placeholderData: keepPreviousData };

type SortKey = "openRate" | "clickRate" | "replyRate" | "costPerOpenCents" | "costPerClickCents" | "costPerReplyCents";

const COST_METRICS: Set<SortKey> = new Set(["costPerOpenCents", "costPerClickCents", "costPerReplyCents"]);
function defaultSortDir(key: SortKey): "asc" | "desc" {
  return COST_METRICS.has(key) ? "asc" : "desc";
}

function formatPercent(rate: number): string {
  if (rate === 0) return "\u2014";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCostCents(cents: number | null): string {
  if (cents === null || cents === 0) return "\u2014";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDisplayName(displayName: string | null, fallbackName: string): string {
  const raw = displayName || fallbackName;
  const lastDashIdx = raw.lastIndexOf("-");
  const suffix = lastDashIdx >= 0 ? raw.slice(lastDashIdx + 1) : raw;
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
}

interface WorkflowTableRow {
  id: string;
  name: string;
  displayLabel: string;
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
    displayLabel: formatDisplayName(item.workflow.displayName, item.workflow.name),
    category: item.workflow.category,
    emailsSent: b.sent,
    openRate: b.sent > 0 ? b.opened / b.sent : 0,
    clickRate: b.sent > 0 ? b.clicked / b.sent : 0,
    replyRate: b.sent > 0 ? b.replied / b.sent : 0,
    costPerOpenCents: b.opened > 0 ? cost / b.opened : null,
    costPerClickCents: b.clicked > 0 ? cost / b.clicked : null,
    costPerReplyCents: b.replied > 0 ? cost / b.replied : null,
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

export default function FeatureWorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;
  const [metric, setMetric] = useState<SortKey>("costPerReplyCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { getFeature } = useFeatures();
  const wfDef = getFeature(featureSlug);

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

  // Fetch ranked workflows (family-aggregated stats)
  const { data: rankedItems, isLoading } = useAuthQuery(
    ["ranked-workflows", wfDef?.category, wfDef?.channel, wfDef?.audienceType],
    () => fetchRankedWorkflows({
      category: wfDef!.category,
      channel: wfDef!.channel,
      audienceType: wfDef!.audienceType,
      limit: 100,
    }),
    { enabled: wfDef?.implemented === true, ...pollOptions },
  );

  const rows = useMemo(() => (rankedItems ?? []).map(rankedToRow), [rankedItems]);

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

  function navigateToWorkflow(workflowId: string) {
    router.push(`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/workflows/${workflowId}`);
  }

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
              Creating…
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
                {sorted.map((wf) => (
                  <WorkflowRow
                    key={wf.id}
                    wf={wf}
                    onClick={() => navigateToWorkflow(wf.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowRow({
  wf,
  onClick,
}: {
  wf: WorkflowTableRow;
  onClick: () => void;
}) {
  return (
    <tr
      className="hover:bg-gray-50 transition cursor-pointer"
      onClick={onClick}
    >
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{wf.displayLabel}</span>
          {wf.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {wf.category}
            </span>
          )}
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
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
