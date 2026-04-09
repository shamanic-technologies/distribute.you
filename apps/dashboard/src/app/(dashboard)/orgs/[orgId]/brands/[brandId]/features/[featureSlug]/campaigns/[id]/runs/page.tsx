"use client";

import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignRuns, type BrandRun } from "@/lib/api";

function formatUsdCents(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
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
  if (!iso) return "—";
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

function RunRow({ run, defaultOpen }: { run: BrandRun; defaultOpen?: boolean }) {
  const hasDescendants = run.descendantRuns && run.descendantRuns.length > 0;
  const descendants = (run.descendantRuns ?? []) as Array<{
    serviceName: string;
    taskName: string;
    status: string;
    startedAt?: string | null;
    completedAt?: string | null;
    ownCostInUsdCents?: string;
  }>;

  return (
    <details className="group border border-gray-200 rounded-lg" open={defaultOpen}>
      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition select-none list-none">
        {hasDescendants && (
          <svg
            className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
        {!hasDescendants && <div className="w-4 flex-shrink-0" />}

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

        {formatUsdCents(run.totalCostInUsdCents) && (
          <span className="text-xs font-medium text-gray-600 flex-shrink-0">
            {formatUsdCents(run.totalCostInUsdCents)}
          </span>
        )}
      </summary>

      {/* Error summary */}
      {run.errorSummary && (
        <div className="mx-4 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
          <p className="font-medium text-red-700">{run.errorSummary.rootCause}</p>
          <p className="text-red-600 mt-1 text-xs">Step: {run.errorSummary.failedStep}</p>
          <p className="text-red-500 mt-1 text-xs">{run.errorSummary.message}</p>
        </div>
      )}

      {/* Descendant runs */}
      {descendants.length > 0 && (
        <div className="mx-4 mb-3 border-l-2 border-gray-200 pl-3 space-y-1">
          {descendants.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-1.5 px-2 rounded text-sm hover:bg-gray-50"
            >
              <StatusBadge status={d.status} />
              <span className="text-gray-600 truncate">
                {d.taskName ?? d.serviceName}
              </span>
              {d.serviceName && d.taskName && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {d.serviceName}
                </span>
              )}
              <span className="flex-1" />
              {d.startedAt && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatDuration(d.startedAt, d.completedAt ?? null)}
                </span>
              )}
              {d.ownCostInUsdCents && formatUsdCents(d.ownCostInUsdCents) && (
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatUsdCents(d.ownCostInUsdCents)}
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
          {runs.length} run{runs.length !== 1 ? "s" : ""}
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No runs yet for this campaign.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map((run, i) => (
            <RunRow key={`${run.startedAt}-${i}`} run={run} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
