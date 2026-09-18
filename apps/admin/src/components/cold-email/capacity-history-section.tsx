"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getInstantlyCapacityHistory, type InstantlyCapacityHistory } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { CapacityHistoryChart } from "@/components/audit/capacity-history-chart";
import { num } from "@/components/cold-email/primitives";

/**
 * In-production fleet capacity, day by day. Moved verbatim from the old
 * `/audit/instantly` page so the Overview keeps the chart that page had — the
 * legacy `capacity-history` read is unchanged and still the only source.
 */
const CAPACITY_WINDOWS = [7, 30, 90] as const;

function fmtDelta(delta: number): string {
  const abs = String(Math.round(Math.abs(delta)));
  if (delta > 0) return `+${abs}`;
  if (delta < 0) return `-${abs}`;
  return "0";
}

export function CapacityHistorySection() {
  const [days, setDays] = useState<number>(30);
  const { data, isPending, isError, error } = useAuthQuery<InstantlyCapacityHistory>(
    ["instantlyCapacityHistory", days],
    () => getInstantlyCapacityHistory(days),
    pollOptionsSlower,
  );

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
            In-production fleet daily send capacity, day by day. The overlaid line is how many
            accounts drove it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {CAPACITY_WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                days === w ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
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
