"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listWorkflows,
  fetchSectionLeaderboard,
  type WorkflowLeaderboardEntry,
} from "@/lib/api";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

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
  const sectionKey = params.sectionKey as string;
  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);
  const [metric, setMetric] = useState<SortKey>("costPerReplyCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const wfDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === sectionKey);

  const { data: workflowsData } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
    { enabled: wfDef?.implemented === true, ...pollOptions },
  );

  const { data: leaderboard, isLoading } = useAuthQuery(
    ["section-leaderboard", sectionKey],
    () => fetchSectionLeaderboard(sectionKey),
    { enabled: wfDef?.implemented === true, ...pollOptions },
  );

  const workflowNameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const wf of workflowsData?.workflows ?? []) {
      map.set(wf.name, wf.id);
    }
    return map;
  }, [workflowsData]);

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
    if (!leaderboard) return [];
    return [...leaderboard].sort((a, b) => {
      const aRaw = a[metric];
      const bRaw = b[metric];
      const aNull = aRaw === null || aRaw === 0;
      const bNull = bRaw === null || bRaw === 0;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return sortDir === "desc" ? Number(bRaw) - Number(aRaw) : Number(aRaw) - Number(bRaw);
    });
  }, [leaderboard, metric, sortDir]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Workflows</h1>
        <p className="text-gray-600">
          Workflows for {wfDef?.label ?? sectionKey}.
        </p>
      </div>

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
                    key={wf.workflowName}
                    wf={wf}
                    onShowDetail={workflowNameToId.get(wf.workflowName) ? () => setDetailWorkflowId(workflowNameToId.get(wf.workflowName)!) : undefined}
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
  onShowDetail,
}: {
  wf: WorkflowLeaderboardEntry;
  onShowDetail?: () => void;
}) {
  const name = wf.signatureName
    ? wf.signatureName.charAt(0).toUpperCase() + wf.signatureName.slice(1)
    : wf.displayName || wf.workflowName;

  return (
    <tr className="hover:bg-gray-50 transition">
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{name}</span>
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
