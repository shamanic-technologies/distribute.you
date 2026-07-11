"use client";

import { useMemo, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getInstantlySendingForecast,
  getInstantlyReconcile,
  getInstantlyAccountHealth,
  getInstantlyCapacityHistory,
  getSendForecast,
  type InstantlySendingForecast,
  type InstantlyReconcile,
  type InstantlyAccountHealth,
  type InstantlyAccountHealthRow,
  type InstantlyAccountInboxPlacement,
  type InstantlyAccountLifecycleStatus,
  type InstantlyCapacityHistory,
  type SendForecast,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { SendForecastChart } from "@/components/audit/send-forecast-chart";
import { CapacityHistoryChart } from "@/components/audit/capacity-history-chart";
import {
  QueueDistributionChart,
  type QueueDistributionBin,
} from "@/components/audit/queue-distribution-chart";
import { ProviderLogo, InstantlyLogo } from "@/components/audit/provider-logo";

function StatCard({
  label,
  value,
  sub,
  pending,
}: {
  label: string;
  value: string;
  sub?: string;
  pending: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {pending ? (
        <Skeleton className="mt-2 h-8 w-24 rounded" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      )}
      {sub && !pending && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function fmtDelta(delta: number): string {
  const abs = String(Math.round(Math.abs(delta)));
  if (delta > 0) return `+${abs}`;
  if (delta < 0) return `-${abs}`;
  return "0";
}

// Human labels for the auto-derived lifecycle states. Sending eligibility is
// 100% auto now — no manual override exists.
const LIFECYCLE_LABEL: Record<string, string> = {
  in_production: "In production",
  in_recovery: "In recovery",
  deactivated_by_instantly: "Deactivated by Instantly",
  deactivated_by_user: "Deactivated by user",
  unclassified: "Unclassified",
};

// Only `in_production` accounts send; every other lifecycle state is held out.
const LIFECYCLE_BADGE: Record<string, string> = {
  in_production: "bg-emerald-100 text-emerald-800",
  in_recovery: "bg-amber-100 text-amber-800",
  deactivated_by_instantly: "bg-red-100 text-red-800",
  deactivated_by_user: "bg-gray-200 text-gray-700",
  unclassified: "bg-gray-100 text-gray-500",
};

// Tab / grouping key = the account's lifecycle state (which IS the send gate).
// Falls back to `blockReason` (which the backend sets to the lifecycle_status
// when blocked, or "unclassified") when lifecycleStatus is absent.
function statusKey(row: InstantlyAccountHealthRow): string {
  if (row.lifecycleStatus) return row.lifecycleStatus;
  if (!row.blocked) return "in_production";
  return row.blockReason ?? "unclassified";
}

function statusLabel(key: string): string {
  return LIFECYCLE_LABEL[key] ?? key;
}

function LifecycleBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
        LIFECYCLE_BADGE[status] ?? "bg-gray-100 text-gray-500"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}

// Sortable columns. `queueSize`/`sentToday`/`dailyLimit`/`warmupScore` are numeric
// (nulls sort last regardless of direction); the rest are string.
// Merged layout: Account carries the provider logo (Type folded in); Lifecycle
// absorbs the active/inactive Status; Health merges the Health Score + Inbox
// placement (sorts by inbox-placement % first, Health Score as tiebreak). Domain
// is dropped as a column (still searchable).
const COLUMNS = [
  { key: "email", label: "Account", numeric: false, align: "left" },
  { key: "lifecycleStatus", label: "Lifecycle", numeric: false, align: "left" },
  { key: "warmupScore", label: "Health", numeric: true, align: "left" },
  { key: "dailyLimit", label: "Daily max send", numeric: true, align: "right" },
  { key: "sentToday", label: "Sent today", numeric: true, align: "right" },
  { key: "queueSize", label: "Queued", numeric: true, align: "right" },
] as const;

type SortKey = (typeof COLUMNS)[number]["key"];

function compareRows(
  a: InstantlyAccountHealthRow,
  b: InstantlyAccountHealthRow,
  key: SortKey,
  dir: "asc" | "desc",
): number {
  // Lifecycle sorts by the derived status key (matches the tab / badge), so a
  // null lifecycleStatus doesn't sort separately from its "in_production" default.
  if (key === "lifecycleStatus") {
    const r = statusKey(a).localeCompare(statusKey(b));
    return dir === "asc" ? r : -r;
  }
  // Health is a composite: primary = inbox-placement (test-deliver) inbox %,
  // secondary tiebreak = Health Score. Nulls sort last on each level regardless
  // of direction.
  if (key === "warmupScore") {
    const level = (av: number | null, bv: number | null): number => {
      const aN = av === null;
      const bN = bv === null;
      if (aN && bN) return 0;
      if (aN) return 1; // nulls always last
      if (bN) return -1;
      return dir === "asc" ? av! - bv! : bv! - av!;
    };
    const byInbox = level(a.inboxPlacement?.inboxPct ?? null, b.inboxPlacement?.inboxPct ?? null);
    if (byInbox !== 0) return byInbox;
    return level(a.warmupScore, b.warmupScore);
  }
  const av = a[key];
  const bv = b[key];
  const aNull = av === null || av === undefined || av === "";
  const bNull = bv === null || bv === undefined || bv === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1; // nulls always last
  if (bNull) return -1;
  let r: number;
  if (typeof av === "number" && typeof bv === "number") r = av - bv;
  else r = String(av).localeCompare(String(bv));
  return dir === "asc" ? r : -r;
}

// Queue-size histogram bins for the Allowed distribution. `0` is standalone so
// an empty queue reads distinctly from a small one.
const QUEUE_BINS: { label: string; lo: number; hi: number }[] = [
  { label: "0", lo: 0, hi: 0 },
  { label: "1–40", lo: 1, hi: 40 },
  { label: "41–80", lo: 41, hi: 80 },
  { label: "81–120", lo: 81, hi: 120 },
  { label: "121–160", lo: 121, hi: 160 },
  { label: "161+", lo: 161, hi: Infinity },
];

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400">—</span>;
  const cls =
    score >= 90
      ? "bg-emerald-100 text-emerald-800"
      : score >= 70
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {score}
    </span>
  );
}

function InboxPlacementCell({
  placement,
}: {
  placement: InstantlyAccountInboxPlacement | null;
}) {
  if (placement === null) return <span className="text-gray-400">—</span>;
  const inbox = Math.round(placement.inboxPct);
  const cls =
    inbox >= 80
      ? "bg-emerald-100 text-emerald-800"
      : inbox >= 50
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  const tested = new Date(placement.testedAt).toLocaleString("en-US", {
    timeZone: "UTC",
  });
  return (
    <span
      className="inline-flex flex-col items-start gap-0.5"
      title={`Inbox placement test as of ${tested} UTC`}
    >
      <span
        className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}
      >
        {inbox}% inbox
      </span>
      <span className="text-[10px] tabular-nums text-gray-400">
        {Math.round(placement.spamPct)}% spam · {Math.round(placement.missingPct)}% missing
      </span>
    </span>
  );
}

const CAPACITY_WINDOWS = [7, 30, 90] as const;

function CapacityHistorySection() {
  const [days, setDays] = useState<number>(30);
  const { data, isPending, isError, error } = useAuthQuery<InstantlyCapacityHistory>(
    ["instantlyCapacityHistory", days],
    () => getInstantlyCapacityHistory(days),
    pollOptionsSlower,
  );

  const num = (n: number) => n.toLocaleString("en-US");
  const series = data?.series ?? [];
  const latest = series.length ? series[series.length - 1] : null;
  const first = series.length ? series[0] : null;
  const delta = latest && first ? latest.dailyCapacity - first.dailyCapacity : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Capacity over time</h3>
          <p className="mt-1 text-xs text-gray-500">
            In-production fleet daily send capacity, day by day (Σ daily send limit over
            accounts in production that day). Overlaid line is how many accounts drove it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {CAPACITY_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                days === w
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Couldn&apos;t load capacity history.</p>
            <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
          </div>
        ) : isPending ? (
          <Skeleton className="h-[260px] w-full rounded" />
        ) : series.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No capacity history yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-500">Capacity now</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
                  {latest ? `${num(latest.dailyCapacity)}/day` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">In production</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
                  {latest ? num(latest.inProductionCount) : "—"}
                </p>
                <p className="text-xs text-gray-400">accounts today</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Change over {days}d</p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-700" : "text-gray-900"
                  }`}
                >
                  {fmtDelta(delta)}
                </p>
                <p className="text-xs text-gray-400">emails/day capacity</p>
              </div>
            </div>
            <div className="mt-4">
              <CapacityHistoryChart data={series} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AccountHealthSection() {
  const { data, isPending, isError, error } = useAuthQuery<InstantlyAccountHealth>(
    ["instantlyAccountHealth"],
    () => getInstantlyAccountHealth(),
    pollOptionsSlower,
  );

  const num = (n: number) => n.toLocaleString("en-US");
  const accounts = data?.accounts ?? [];

  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of accounts) {
      const k = statusKey(r);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const rest = [...counts.keys()]
      .filter((k) => k !== "in_production")
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    const ordered = counts.has("in_production")
      ? ["in_production", ...rest]
      : rest;
    return ordered.map((k) => ({ key: k, label: statusLabel(k), count: counts.get(k) ?? 0 }));
  }, [accounts]);

  const [tab, setTab] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("warmupScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");

  const activeTab = tab && tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key ?? null;

  // Sending-pool queue stats — computed over the whole in-production set
  // (send-eligible), independent of which tab is active.
  const allowed = useMemo(() => accounts.filter((r) => !r.blocked), [accounts]);
  const pctWithQueue = allowed.length
    ? (allowed.filter((r) => r.queueSize > 0).length / allowed.length) * 100
    : 0;
  const avgQueue = allowed.length
    ? allowed.reduce((s, r) => s + r.queueSize, 0) / allowed.length
    : 0;
  const queueBins: QueueDistributionBin[] = QUEUE_BINS.map((b) => {
    const count = allowed.filter((r) => r.queueSize >= b.lo && r.queueSize <= b.hi).length;
    return {
      label: b.label,
      count,
      pct: allowed.length ? (count / allowed.length) * 100 : 0,
    };
  });

  // Rows for the active tab: filter by tab → search → sort.
  const q = query.trim().toLowerCase();
  const rows = accounts
    .filter((r) => statusKey(r) === activeTab)
    .filter(
      (r) =>
        !q ||
        r.email.toLowerCase().includes(q) ||
        (r.domain ?? "").toLowerCase().includes(q),
    )
    .sort((a, b) => compareRows(a, b, sortKey, sortDir));

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const blockedCount = accounts.filter((r) => r.blocked).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Sending accounts</h2>
          <p className="mt-1 text-xs text-gray-500">
            Every account in the shared Instantly workspace with its Health Score, daily
            send limit, and auto-derived lifecycle (only in-production accounts send).
            Tabbed by lifecycle; sort any column, filter by email or domain.
          </p>
        </div>
        {!isPending && !isError && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
              blockedCount > 0
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {num(accounts.length)} account{accounts.length === 1 ? "" : "s"}
            {blockedCount > 0 ? ` · ${num(blockedCount)} blocked` : " · all sendable"}
          </span>
        )}
      </div>

      <div className="mt-4">
        {isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Couldn&apos;t load sending accounts.</p>
            <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
          </div>
        ) : isPending ? (
          <Skeleton className="h-64 w-full rounded" />
        ) : accounts.length === 0 ? (
          <p className="text-sm text-gray-500">No sending accounts found.</p>
        ) : (
          <>
            {/* In-production queue health: % with a queue, avg queue, distribution. */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  In-production accounts — queue health
                </h3>
                <span className="text-xs text-gray-400">
                  {num(allowed.length)} in production
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">With a queue</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
                    {pctWithQueue.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-400">have queue &gt; 0</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Avg in queue</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
                    {avgQueue.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-400">emails per allowed account</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500">
                  Queue-size distribution (% of in-production accounts)
                </p>
                <div className="mt-2">
                  {allowed.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">
                      No in-production accounts.
                    </p>
                  ) : (
                    <QueueDistributionChart data={queueBins} />
                  )}
                </div>
              </div>
            </div>

            {/* Lifecycle tabs (In production first, then other states by count). */}
            <div className="mt-5 flex flex-wrap gap-1 border-b border-gray-200">
              {tabs.map((t) => {
                const active = t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTab(t.key);
                      setQuery("");
                    }}
                    className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
                      active
                        ? "border-indigo-500 text-indigo-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                        active ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {num(t.count)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Filter */}
            <div className="mt-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by email or domain…"
                className="w-full max-w-xs rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Table */}
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={`py-2 px-3 font-medium ${c.align === "right" ? "text-right" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSort(c.key)}
                          className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-700"
                        >
                          {c.label}
                          <span className="text-[10px] text-gray-400">
                            {sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={COLUMNS.length}
                        className="py-6 text-center text-sm text-gray-400"
                      >
                        No accounts match.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.email} className="border-b border-gray-100 last:border-0">
                        {/* Account: provider logo + email (Type folded in). */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <ProviderLogo type={r.accountType} />
                            <span className="font-medium text-gray-900">{r.email}</span>
                          </div>
                        </td>
                        {/* Lifecycle: send-state badge + reason + active/inactive Status. */}
                        <td className="py-2.5 px-3">
                          <LifecycleBadge status={statusKey(r)} />
                          <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                            {r.lifecycleReason && <span>{r.lifecycleReason}</span>}
                            {r.lifecycleReason && <span aria-hidden>·</span>}
                            <span>{r.status}</span>
                          </span>
                        </td>
                        {/* Health: Instantly Health Score + inbox placement. */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <InstantlyLogo />
                            <ScoreBadge score={r.warmupScore} />
                          </div>
                          <div className="mt-0.5">
                            <InboxPlacementCell placement={r.inboxPlacement} />
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                          {r.dailyLimit === null ? "—" : num(r.dailyLimit)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                          {num(r.sentToday)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">
                          {num(r.queueSize)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-gray-400">
                As of {new Date(data.asOf).toLocaleString("en-US", { timeZone: "UTC" })} UTC.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReconcileSection() {
  const { data, isPending, isError, error } = useAuthQuery<InstantlyReconcile>(
    ["instantlyReconcile"],
    () => getInstantlyReconcile(),
    pollOptionsSlower,
  );

  const num = (n: number) => String(Math.round(n));
  const driftCount = data?.metrics.filter((m) => m.delta !== 0).length ?? 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Reconciliation vs Instantly</h2>
          <p className="mt-1 text-xs text-gray-500">
            Our local count against Instantly&apos;s count for each fact. Instantly is the
            source of truth, so any non-zero delta is drift to investigate (lost webhook,
            lagging reconcile, missed pause).
          </p>
        </div>
        {!isPending && !isError && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
              driftCount > 0
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {driftCount > 0
              ? `${num(driftCount)} metric${driftCount === 1 ? "" : "s"} drifting`
              : "All in sync"}
          </span>
        )}
      </div>

      <div className="mt-4">
        {isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Couldn&apos;t load reconciliation.</p>
            <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
          </div>
        ) : isPending ? (
          <Skeleton className="h-64 w-full rounded" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[480px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4 font-medium">Metric</th>
                  <th className="py-2 px-4 text-right font-medium">Local</th>
                  <th className="py-2 px-4 text-right font-medium">Instantly</th>
                  <th className="py-2 pl-4 text-right font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.map((m) => {
                  const drift = m.delta !== 0;
                  return (
                    <tr
                      key={m.key}
                      className={`border-b border-gray-100 last:border-0 ${
                        drift ? "bg-amber-50" : ""
                      }`}
                    >
                      <td className="py-2.5 pr-4 font-medium text-gray-900">{m.label}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                        {num(m.local)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                        {num(m.instantly)}
                      </td>
                      <td className="py-2.5 pl-4 text-right">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
                            drift
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {fmtDelta(m.delta)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-400">
              As of {new Date(data.asOf).toLocaleString("en-US", { timeZone: "UTC" })} UTC.
              Delta is local minus Instantly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditInstantlyPage() {
  const { data: iData, isPending: iPending } = useAuthQuery<InstantlySendingForecast>(
    ["instantlySendingForecast"],
    () => getInstantlySendingForecast(),
    pollOptionsSlower,
  );
  const {
    data: fData,
    isPending: fPending,
    isError: fError,
    error: fErrorObj,
  } = useAuthQuery<SendForecast>(
    ["sendForecast"],
    () => getSendForecast(),
    pollOptionsSlower,
  );

  // Email counts arrive fractional (projected new sends); display as whole emails, no separator.
  const num = (n?: number) => String(Math.round(n ?? 0));
  const usd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const cell = (n: number | null) => (n === null ? "—" : num(n));
  const dateLabel = (iso: string) =>
    new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  const totalScheduled = iData?.days.reduce((sum, d) => sum + d.scheduledCount, 0) ?? 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Instantly — sending forecast</h1>
        <p className="mt-1 text-sm text-gray-500">
          Future email volume scheduled by the cold-email fleet, day by day, against the
          current available daily capacity (in-production accounts only).
        </p>
      </div>

      {/* Merged stat cards: fleet capacity + global send forecast summary. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Available capacity"
          value={`${num(iData?.dailyCapacity)}/day`}
          sub={`${num(iData?.healthyAccountCount)} of ${num(iData?.totalAccountCount)} accounts healthy`}
          pending={iPending}
        />
        <StatCard
          label="Total daily budget"
          value={fData ? usd(fData.summary.totalDailyBudgetUsd) : "—"}
          sub="across active brands"
          pending={fPending}
        />
        <StatCard
          label="Remaining today"
          value={fData ? usd(fData.summary.remainingTodayUsd) : "—"}
          sub="budget left to spend"
          pending={fPending}
        />
        <StatCard
          label="Active brands"
          value={fData ? num(fData.summary.activeBrandCount) : "—"}
          sub="driving the forecast"
          pending={fPending}
        />
        <StatCard
          label="New sequences / day"
          value={fData ? num(fData.summary.totalNewSequencesPerDay) : "—"}
          sub="fleet, at full budget"
          pending={fPending}
        />
        <StatCard
          label="Follow-up model"
          value={fData ? fData.summary.followupModel : "—"}
          sub="send cadence"
          pending={fPending}
        />
        <StatCard
          label="Blocked accounts"
          value={num(iData?.blockedDomainCount)}
          sub="brand / product domains held out of cold"
          pending={iPending}
        />
        <StatCard
          label="Scheduled ahead"
          value={num(totalScheduled)}
          sub={`over ${num(iData?.days.length)} day${iData?.days.length === 1 ? "" : "s"}`}
          pending={iPending}
        />
      </div>

      {fError ? (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <p className="text-sm font-medium text-red-700">Couldn&apos;t load the send forecast.</p>
          <p className="mt-1 text-xs text-red-500">{fErrorObj?.message ?? "Unknown error"}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Emails sent per day</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Sent (actual)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Scheduled follow-ups
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> New (projected)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-sm bg-sky-500" /> Daily capacity
                </span>
              </div>
            </div>
            <div className="mt-4">
              {fPending ? (
                <Skeleton className="h-[300px] w-full rounded" />
              ) : (
                <SendForecastChart days={fData.days} dailyCapacity={iData?.dailyCapacity} />
              )}
            </div>
          </div>

          <CapacityHistorySection />

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900">Day by day</h3>
            <div className="mt-4">
              {fPending ? (
                <Skeleton className="h-64 w-full rounded" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[560px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="py-2 pr-4 font-medium">Day</th>
                        <th className="py-2 px-4 text-right font-medium">Sent (actual)</th>
                        <th className="py-2 px-4 text-right font-medium">Scheduled follow-ups</th>
                        <th className="py-2 px-4 text-right font-medium">New (projected)</th>
                        <th className="py-2 pl-4 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fData.days.map((d) => (
                        <tr
                          key={d.date}
                          className={`border-b border-gray-100 last:border-0 ${
                            d.isToday ? "bg-indigo-50" : ""
                          }`}
                        >
                          <td className="py-2.5 pr-4 font-medium text-gray-900">
                            {dateLabel(d.date)}
                            {d.isToday && (
                              <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                                Today
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                            {cell(d.actualSent)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                            {cell(d.inFlightSent)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                            {cell(d.forecastNew)}
                          </td>
                          <td className="py-2.5 pl-4 text-right tabular-nums font-semibold text-gray-900">
                            {cell(d.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-gray-400">
                    A dash means the series doesn&apos;t apply that day: past days carry no
                    forecast, future days carry no actual sends yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <AccountHealthSection />

      <ReconcileSection />
    </div>
  );
}
