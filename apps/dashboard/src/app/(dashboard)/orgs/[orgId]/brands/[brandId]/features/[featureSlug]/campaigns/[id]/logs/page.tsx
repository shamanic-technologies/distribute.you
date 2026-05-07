"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignEvents, type RunEvent, type EventLevel } from "@/lib/api";

const LEVEL_STYLES: Record<EventLevel, string> = {
  info: "bg-gray-100 text-gray-700",
  warn: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
};

const LEVEL_FILTERS: Array<{ id: "all" | EventLevel; label: string }> = [
  { id: "all", label: "All" },
  { id: "info", label: "Info" },
  { id: "warn", label: "Warn" },
  { id: "error", label: "Error" },
];

function formatTime(iso: string): string {
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

function LevelBadge({ level }: { level: EventLevel }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${LEVEL_STYLES[level]}`}>
      {level}
    </span>
  );
}

function EventRow({ event }: { event: RunEvent }) {
  const hasData = event.data != null;
  return (
    <div className="flex items-start gap-3 py-2 px-3 border-t border-gray-100 first:border-t-0 hover:bg-gray-50/60">
      <span className="text-[11px] text-gray-400 font-mono flex-shrink-0 mt-0.5 w-32">
        {formatTime(event.createdAt)}
      </span>
      <span className="flex-shrink-0 mt-0.5">
        <LevelBadge level={event.level} />
      </span>
      <span className="text-xs text-gray-500 flex-shrink-0 mt-0.5 w-28 truncate" title={event.service}>
        {event.service}
      </span>
      <span className="text-xs text-gray-700 font-medium flex-shrink-0 mt-0.5 w-40 truncate" title={event.event}>
        {event.event}
      </span>
      <div className="flex-1 min-w-0">
        {event.detail && (
          <span className="text-xs text-gray-600 break-words">{event.detail}</span>
        )}
        {hasData && (
          <details className="mt-1">
            <summary className="text-[11px] text-gray-400 cursor-pointer hover:text-gray-600">payload</summary>
            <pre className="mt-1 text-[11px] bg-gray-50 border border-gray-100 rounded p-2 overflow-x-auto">
              {JSON.stringify(event.data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

interface RunGroup {
  runId: string;
  firstAt: string;
  lastAt: string;
  events: RunEvent[];
  service: string;
  highestLevel: EventLevel;
}

const LEVEL_RANK: Record<EventLevel, number> = { info: 0, warn: 1, error: 2 };

function groupByRun(events: RunEvent[]): RunGroup[] {
  const byRun = new Map<string, RunEvent[]>();
  for (const ev of events) {
    const list = byRun.get(ev.runId) ?? [];
    list.push(ev);
    byRun.set(ev.runId, list);
  }

  const groups: RunGroup[] = [];
  for (const [runId, list] of byRun) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const highestLevel = sorted.reduce<EventLevel>(
      (acc, ev) => (LEVEL_RANK[ev.level] > LEVEL_RANK[acc] ? ev.level : acc),
      "info"
    );
    groups.push({
      runId,
      firstAt: sorted[0].createdAt,
      lastAt: sorted[sorted.length - 1].createdAt,
      events: sorted,
      service: sorted[0].service,
      highestLevel,
    });
  }

  // Most recent run first (by lastAt DESC)
  groups.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  return groups;
}

function RunGroupCard({ group, defaultOpen }: { group: RunGroup; defaultOpen: boolean }) {
  return (
    <details className="group bg-white border border-gray-200 rounded-lg overflow-hidden" open={defaultOpen}>
      <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 select-none list-none">
        <svg
          className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <LevelBadge level={group.highestLevel} />
        <span className="text-sm text-gray-700 font-medium flex-shrink-0">{group.service}</span>
        <span className="text-xs text-gray-400 font-mono truncate" title={group.runId}>
          {group.runId.slice(0, 8)}
        </span>
        <span className="flex-1" />
        <span className="text-xs text-gray-400 flex-shrink-0">
          {group.events.length} event{group.events.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-gray-400 font-mono flex-shrink-0">
          {formatTime(group.firstAt)}
        </span>
      </summary>
      <div className="border-t border-gray-100 bg-white">
        {group.events.map((ev) => (
          <EventRow key={ev.id} event={ev} />
        ))}
      </div>
    </details>
  );
}

export default function CampaignLogsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [levelFilter, setLevelFilter] = useState<"all" | EventLevel>("all");

  const { data, isLoading, error } = useAuthQuery(
    ["campaignEvents", campaignId, levelFilter],
    () =>
      listCampaignEvents(campaignId, {
        level: levelFilter === "all" ? undefined : levelFilter,
        limit: 500,
      }),
    { refetchInterval: 5_000, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );

  const events = data?.events ?? [];
  const groups = useMemo(() => groupByRun(events), [events]);

  if (isLoading && !data) {
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

  if (error) {
    console.error("[dashboard] CampaignLogsPage failed to load events", error);
    return (
      <div className="p-4 md:p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-red-700">Failed to load logs</h2>
          <p className="text-xs text-red-600 mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {events.length.toLocaleString("en-US")} event{events.length !== 1 ? "s" : ""}
            {" · "}
            {groups.length.toLocaleString("en-US")} run{groups.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setLevelFilter(f.id)}
              className={`px-3 py-1 text-xs font-medium rounded transition ${
                levelFilter === f.id
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">No logs yet for this campaign.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group, i) => (
            <RunGroupCard key={group.runId} group={group} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
