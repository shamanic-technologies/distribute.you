"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignRuns, type CampaignRun } from "@/lib/api";

function formatUsdCents(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  running: "bg-blue-100 text-blue-700",
  pending: "bg-yellow-100 text-yellow-700",
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>
      {status}
    </span>
  );
}

/** Build a tree: top-level runs + their children (sub-runs) */
function buildRunTree(runs: CampaignRun[]): Array<CampaignRun & { children: CampaignRun[] }> {
  const byId = new Map(runs.map((r) => [r.id, r]));
  const childrenMap = new Map<string, CampaignRun[]>();

  for (const run of runs) {
    if (run.parentRunId && byId.has(run.parentRunId)) {
      const list = childrenMap.get(run.parentRunId) ?? [];
      list.push(run);
      childrenMap.set(run.parentRunId, list);
    }
  }

  // Top-level = runs whose parent is null or whose parent is not in the list
  const topLevel = runs.filter((r) => !r.parentRunId || !byId.has(r.parentRunId));

  return topLevel.map((r) => ({
    ...r,
    children: childrenMap.get(r.id) ?? [],
  }));
}

function RunRow({ run, children, defaultOpen }: { run: CampaignRun; children: CampaignRun[]; defaultOpen?: boolean }) {
  const hasChildren = children.length > 0;

  return (
    <details className="group border border-gray-200 rounded-lg" open={defaultOpen}>
      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition select-none list-none">
        {hasChildren ? (
          <svg
            className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}

        <StatusBadge status={run.status} />

        <span className="text-sm text-gray-700 font-medium truncate">
          {run.taskName ?? run.serviceName ?? "Run"}
        </span>

        <span className="text-xs text-gray-400 flex-shrink-0">
          {formatTime(run.startedAt)}
        </span>

        {run.status === "running" && (
          <span className="text-xs text-blue-500 flex-shrink-0 animate-pulse">
            {formatDuration(run.startedAt, null)}
          </span>
        )}
        {run.status !== "running" && run.startedAt && run.completedAt && (
          <span className="text-xs text-gray-400 flex-shrink-0">
            {formatDuration(run.startedAt, run.completedAt)}
          </span>
        )}

        <span className="flex-1" />

        {formatUsdCents(run.ownCostInUsdCents) && (
          <span className="text-xs font-medium text-gray-600 flex-shrink-0">
            {formatUsdCents(run.ownCostInUsdCents)}
          </span>
        )}
      </summary>

      {/* Sub-runs */}
      {hasChildren && (
        <div className="mx-4 mb-3 border-l-2 border-gray-200 pl-3 space-y-1">
          {children.map((child) => (
            <div
              key={child.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded text-sm hover:bg-gray-50"
            >
              <StatusBadge status={child.status} />
              <span className="text-gray-600 truncate">
                {child.taskName ?? child.serviceName}
              </span>
              {child.serviceName && child.taskName && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {child.serviceName}
                </span>
              )}
              <span className="flex-1" />
              {child.startedAt && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatDuration(child.startedAt, child.completedAt)}
                </span>
              )}
              {formatUsdCents(child.ownCostInUsdCents) && (
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatUsdCents(child.ownCostInUsdCents)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}

export default function CampaignRunsPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const { data, isLoading } = useAuthQuery(
    ["campaignRuns", campaignId],
    () => listCampaignRuns(campaignId),
    { refetchInterval: 5_000, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );

  const runs = data?.runs ?? [];
  const tree = useMemo(() => buildRunTree(runs), [runs]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-100 rounded-lg" />
          <div className="h-16 bg-gray-100 rounded-lg" />
          <div className="h-16 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Runs</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tree.length.toLocaleString("en-US")} run{tree.length !== 1 ? "s" : ""}
        </p>
      </div>

      {tree.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No runs yet for this campaign.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tree.map((run, i) => (
            <RunRow key={run.id} run={run} children={run.children} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
