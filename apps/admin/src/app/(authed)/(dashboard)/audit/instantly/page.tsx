"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getInstantlySendingForecast,
  getInstantlyReconcile,
  type InstantlySendingForecast,
  type InstantlyReconcile,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InstantlyForecastChart } from "@/components/audit/instantly-forecast-chart";

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
  const abs = Math.abs(delta).toLocaleString("en-US");
  if (delta > 0) return `+${abs}`;
  if (delta < 0) return `-${abs}`;
  return "0";
}

function ReconcileSection() {
  const { data, isPending, isError, error } = useAuthQuery<InstantlyReconcile>(
    ["instantlyReconcile"],
    () => getInstantlyReconcile(),
    pollOptionsSlower,
  );

  const num = (n: number) => n.toLocaleString("en-US");
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
  const { data, isPending, isError, error } = useAuthQuery<InstantlySendingForecast>(
    ["instantlySendingForecast"],
    () => getInstantlySendingForecast(),
    pollOptionsSlower,
  );

  const num = (n?: number) => (n ?? 0).toLocaleString("en-US");
  const totalScheduled = data?.days.reduce((sum, d) => sum + d.scheduledCount, 0) ?? 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Instantly — sending forecast</h1>
        <p className="mt-1 text-sm text-gray-500">
          Future email volume scheduled by the cold-email fleet, day by day, against the
          current available daily capacity (healthy, warmed, non-blacklisted accounts only).
        </p>
      </div>

      {isError ? (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <p className="text-sm font-medium text-red-700">Couldn&apos;t load the forecast.</p>
          <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Available capacity"
              value={`${num(data?.dailyCapacity)}/day`}
              sub={`${num(data?.healthyAccountCount)} of ${num(data?.totalAccountCount)} accounts healthy`}
              pending={isPending}
            />
            <StatCard
              label="Blocked accounts"
              value={num(data?.blockedDomainCount)}
              sub="excluded via blacklist / warmup"
              pending={isPending}
            />
            <StatCard
              label="Scheduled ahead"
              value={num(totalScheduled)}
              sub={`over ${num(data?.days.length)} day${data?.days.length === 1 ? "" : "s"}`}
              pending={isPending}
            />
            <StatCard
              label="As of"
              value={data ? new Date(data.asOf).toLocaleString("en-US", { timeZone: "UTC" }) : "—"}
              sub="UTC"
              pending={isPending}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Scheduled volume vs capacity</h2>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Within capacity
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Over capacity
                </span>
              </div>
            </div>
            <div className="mt-4">
              {isPending ? (
                <Skeleton className="h-[300px] w-full rounded" />
              ) : (
                <InstantlyForecastChart days={data.days} dailyCapacity={data.dailyCapacity} />
              )}
            </div>
          </div>
        </>
      )}

      <ReconcileSection />
    </div>
  );
}
