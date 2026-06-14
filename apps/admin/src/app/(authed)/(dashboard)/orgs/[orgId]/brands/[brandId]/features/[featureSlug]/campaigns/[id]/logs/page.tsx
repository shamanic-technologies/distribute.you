"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignEvents, type RunEvent, type EventLevel } from "@/lib/api";

const PAGE_SIZE = 100;

const LEVEL_STYLES: Record<EventLevel, string> = {
  info: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  warn: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const LEVEL_FILTERS: Array<{ id: "all" | EventLevel; label: string }> = [
  { id: "all", label: "All" },
  { id: "info", label: "Info" },
  { id: "warn", label: "Warn" },
  { id: "error", label: "Error" },
];

const ALL_SERVICES = "__all__";

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
    <div className="flex items-start gap-3 py-2 px-3 border-t border-gray-100 dark:border-gray-700 first:border-t-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/60">
      <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono flex-shrink-0 mt-0.5 w-32">
        {formatTime(event.createdAt)}
      </span>
      <span className="flex-shrink-0 mt-0.5">
        <LevelBadge level={event.level} />
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5 w-28 truncate" title={event.service}>
        {event.service}
      </span>
      <span className="text-xs text-gray-700 dark:text-gray-200 font-medium flex-shrink-0 mt-0.5 w-40 truncate" title={event.event}>
        {event.event}
      </span>
      <div className="flex-1 min-w-0">
        {event.detail && (
          <span className="text-xs text-gray-600 dark:text-gray-300 break-words">{event.detail}</span>
        )}
        {hasData && (
          <details className="mt-1">
            <summary className="text-[11px] text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">payload</summary>
            <pre className="mt-1 text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded p-2 overflow-x-auto">
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

  groups.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  return groups;
}

function RunGroupCard({ group }: { group: RunGroup }) {
  return (
    <details className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none list-none">
        <svg
          className="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform group-open:rotate-90 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <LevelBadge level={group.highestLevel} />
        <span className="text-sm text-gray-700 dark:text-gray-200 font-medium flex-shrink-0">{group.service}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate" title={group.runId}>
          {group.runId.slice(0, 8)}
        </span>
        <span className="flex-1" />
        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
          {group.events.length} event{group.events.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono flex-shrink-0">
          {formatTime(group.firstAt)}
        </span>
      </summary>
      <div className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
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
  const [serviceFilter, setServiceFilter] = useState<string>(ALL_SERVICES);
  const [keyword, setKeyword] = useState<string>("");
  const [offset, setOffset] = useState<number>(0);

  const { data, isPending, error } = useAuthQuery(
    ["campaignEvents", campaignId, levelFilter, offset],
    () =>
      listCampaignEvents(campaignId, {
        level: levelFilter === "all" ? undefined : levelFilter,
        limit: 100,
        offset,
      }),
    { refetchInterval: 5_000, placeholderData: keepPreviousData },
  );

  const events = data?.events ?? [];

  const services = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) set.add(ev.service);
    return Array.from(set).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return events.filter((ev) => {
      if (serviceFilter !== ALL_SERVICES && ev.service !== serviceFilter) return false;
      if (kw.length > 0) {
        const haystack = [ev.event, ev.detail ?? "", ev.service, ev.runId]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(kw)) return false;
      }
      return true;
    });
  }, [events, serviceFilter, keyword]);

  const groups = useMemo(() => groupByRun(filteredEvents), [filteredEvents]);

  const hasNextPage = events.length === PAGE_SIZE;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  function resetToFirstPage(next: () => void) {
    next();
    setOffset(0);
  }

  if (isPending && !data) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    console.error("[dashboard] CampaignLogsPage failed to load events", error);
    return (
      <div className="p-4 md:p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">Failed to load logs</h2>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
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
          <h1 className="font-display text-2xl font-bold text-gray-800 dark:text-gray-100">Logs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            page {currentPage} · {events.length.toLocaleString("en-US")} loaded
            {filteredEvents.length !== events.length
              ? ` · ${filteredEvents.length.toLocaleString("en-US")} after filters`
              : ""}
            {" · "}
            {groups.length.toLocaleString("en-US")} run{groups.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {LEVEL_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => resetToFirstPage(() => setLevelFilter(f.id))}
              className={`px-3 py-1 text-xs font-medium rounded transition ${
                levelFilter === f.id
                  ? "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
        >
          <option value={ALL_SERVICES}>All services</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search keyword (event, detail, service, runId)"
          className="flex-1 min-w-[200px] text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-2.5 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={!hasNextPage}
            className="px-2.5 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Next
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">No logs yet for this campaign.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <RunGroupCard key={group.runId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
