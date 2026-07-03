"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getInstantlySendingForecast,
  getInstantlyReconcile,
  getInstantlyAccountHealth,
  getSendForecast,
  type InstantlySendingForecast,
  type InstantlyReconcile,
  type InstantlyAccountHealth,
  type InstantlyAccountHealthRow,
  type SendForecast,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { SendForecastChart } from "@/components/audit/send-forecast-chart";

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

const BLOCK_REASON_LABEL: Record<string, string> = {
  inactive: "Inactive",
  "under-warmed": "Under-warmed",
  "blacklisted-domain": "Blacklisted domain",
};

function AllowedBadge({ row }: { row: InstantlyAccountHealthRow }) {
  if (!row.blocked) {
    return (
      <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Allowed
      </span>
    );
  }
  return (
    <span className="inline-block rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      {row.blockReason ? BLOCK_REASON_LABEL[row.blockReason] ?? row.blockReason : "Blocked"}
    </span>
  );
}

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

function AccountHealthSection() {
  const { data, isPending, isError, error } = useAuthQuery<InstantlyAccountHealth>(
    ["instantlyAccountHealth"],
    () => getInstantlyAccountHealth(),
    pollOptionsSlower,
  );

  const num = (n: number) => n.toLocaleString("en-US");
  // Blocked accounts float to the top (the ones staff act on), then by email.
  const rows = data
    ? [...data.accounts].sort(
        (a, b) =>
          Number(b.blocked) - Number(a.blocked) || a.email.localeCompare(b.email),
      )
    : [];
  const blockedCount = rows.filter((r) => r.blocked).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Sending accounts</h2>
          <p className="mt-1 text-xs text-gray-500">
            Every account in the shared Instantly workspace with its Health Score, daily
            send limit, and send-eligibility (from the same gate the live send path uses).
            Blocked accounts are listed first.
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
            {num(rows.length)} account{rows.length === 1 ? "" : "s"}
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
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No sending accounts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4 font-medium">Account</th>
                  <th className="py-2 px-4 font-medium">Domain</th>
                  <th className="py-2 px-4 font-medium">Status</th>
                  <th className="py-2 px-4 text-right font-medium">Health score</th>
                  <th className="py-2 px-4 text-right font-medium">Daily max send</th>
                  <th className="py-2 pl-4 font-medium">Allowed to send</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.email}
                    className={`border-b border-gray-100 last:border-0 ${
                      r.blocked ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{r.email}</td>
                    <td className="py-2.5 px-4 text-gray-700">{r.domain ?? "—"}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                          r.status === "active"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <ScoreBadge score={r.warmupScore} />
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                      {r.dailyLimit === null ? "—" : num(r.dailyLimit)}
                    </td>
                    <td className="py-2.5 pl-4">
                      <AllowedBadge row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-400">
              As of {new Date(data.asOf).toLocaleString("en-US", { timeZone: "UTC" })} UTC.
              Sent-today, queue size, and account type aren&apos;t shown — Instantly&apos;s API
              exposes no per-account property for them yet (backend request pending).
            </p>
          </div>
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
          current available daily capacity (healthy, warmed, non-blacklisted accounts only).
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
          sub="excluded via blacklist / warmup"
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
