"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getInstantlySendingForecast, type InstantlySendingForecast } from "@/lib/api";
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
    </div>
  );
}
