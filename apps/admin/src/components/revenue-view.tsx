"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getFleetRevenue,
  getActiveUsersHistory,
  type FleetRevenue,
  type ActiveUsersHistory,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { formatUsd } from "@/lib/format-number";
import type { DailyFunnelPoint } from "@/lib/public-stats";
import {
  revenueBuckets,
  revenueCmgrSummary,
  dailyRevenueLine,
  monthlyRevenueByKey,
  monthlyTimelineTotals,
  monthlyActiveUsersByKey,
  avgPerSeries,
  type AvgSeries,
} from "@/lib/revenue-buckets";
import { RevenuePeriodChart, RevenueAvgChart, RevenueDailyLineChart } from "@/components/revenue-charts";

function money(value: number): string {
  const decimals = Math.abs(value) < 10 ? 2 : 0;
  return formatUsd(value, decimals);
}

function formatGrowth(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function StatCard({
  label,
  value,
  detail,
  accent,
  pending,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  pending: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className={`mb-4 h-1 w-10 rounded-full ${accent}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {pending ? (
        <Skeleton className="mt-2 h-8 w-24 rounded" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
      )}
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
}

/** Compound-growth headline (CMGR/CWGR) for the monthly / weekly revenue charts. */
function CmgrHeadline({ latestPct, avgPct, unit }: { latestPct: number | null; avgPct: number | null; unit: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-gray-950">{formatGrowth(latestPct)}</p>
      <p className="mt-0.5 text-xs text-gray-400">{formatGrowth(avgPct)} average {unit} since inception</p>
    </div>
  );
}

/** Snapshot + "avg of the avg" headline for an average-revenue-per-X card. */
function AvgHeadline({ series }: { series: AvgSeries }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-gray-950">{series.snapshotUsd === null ? "—" : money(series.snapshotUsd)}</p>
      <p className="mt-0.5 text-xs text-gray-400">
        {series.avgOfAvgUsd === null ? "—" : money(series.avgOfAvgUsd)} average of the monthly averages
      </p>
    </div>
  );
}

export function RevenueView({ timeline }: { timeline: DailyFunnelPoint[] }) {
  const { data, isPending, isError, error } = useAuthQuery<FleetRevenue>(
    ["fleetRevenue"],
    () => getFleetRevenue(),
    pollOptionsSlower,
  );

  const {
    data: history,
    isError: historyError,
    error: historyErr,
  } = useAuthQuery<ActiveUsersHistory>(["activeUsersHistory"], () => getActiveUsersHistory(), pollOptionsSlower);

  const derived = useMemo(() => {
    if (!data) return null;
    const monthly = revenueBuckets(data.monthly, "month");
    const weekly = revenueBuckets(data.weekly, "week");
    const daily = dailyRevenueLine(data.daily);

    const revenueByMonth = monthlyRevenueByKey(data.monthly);
    const visitorsByMonth = monthlyTimelineTotals(timeline, "landingVisitors");
    const signupsByMonth = monthlyTimelineTotals(timeline, "signups");
    const paidClientsByMonth = monthlyActiveUsersByKey(history?.monthly ?? []);

    return {
      monthly,
      weekly,
      daily,
      monthlyCmgr: revenueCmgrSummary(monthly),
      weeklyCmgr: revenueCmgrSummary(weekly),
      perVisitor: avgPerSeries(revenueByMonth, visitorsByMonth),
      perSignup: avgPerSeries(revenueByMonth, signupsByMonth),
      perPaidClient: avgPerSeries(revenueByMonth, paidClientsByMonth),
    };
  }, [data, history, timeline]);

  if (isError) {
    return (
      <section className="rounded-lg border border-red-200 bg-white p-6">
        <p className="text-sm font-medium text-red-700">Couldn&apos;t load revenue.</p>
        <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total revenue"
          value={data ? money(data.totalRevenueUsd) : "—"}
          detail="Realized cold-email revenue since inception"
          accent="bg-brand-500"
          pending={isPending}
        />
        <StatCard
          label="Current MRR"
          value={data ? money(data.currentMrrUsd) : "—"}
          detail="Active daily budgets × 30, live fleet"
          accent="bg-emerald-500"
          pending={isPending}
        />
        <StatCard
          label="Tracked revenue days"
          value={data ? data.daily.length.toLocaleString("en-US") : "—"}
          detail="Days with realized cold-email spend"
          accent="bg-sky-500"
          pending={isPending}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Monthly revenue</h2>
          <p className="mt-1 text-sm text-gray-500">Realized revenue per month with compound monthly growth since inception.</p>
          <div className="mt-4">
            {isPending || !derived ? (
              <Skeleton className="h-16 w-32 rounded" />
            ) : (
              <CmgrHeadline latestPct={derived.monthlyCmgr.latestPct} avgPct={derived.monthlyCmgr.avgPct} unit="monthly" />
            )}
          </div>
          <div className="mt-5">
            {isPending || !derived ? (
              <Skeleton className="h-[280px] w-full rounded" />
            ) : (
              <RevenuePeriodChart data={derived.monthly} growthLabel="CMGR since inception" />
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Weekly revenue</h2>
          <p className="mt-1 text-sm text-gray-500">Realized revenue per week with compound weekly growth since inception.</p>
          <div className="mt-4">
            {isPending || !derived ? (
              <Skeleton className="h-16 w-32 rounded" />
            ) : (
              <CmgrHeadline latestPct={derived.weeklyCmgr.latestPct} avgPct={derived.weeklyCmgr.avgPct} unit="weekly" />
            )}
          </div>
          <div className="mt-5">
            {isPending || !derived ? (
              <Skeleton className="h-[280px] w-full rounded" />
            ) : (
              <RevenuePeriodChart data={derived.weekly} growthLabel="CWGR since inception" />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-950">MRR over time</h2>
        <p className="mt-1 text-sm text-gray-500">Total active daily budget billed per day since inception.</p>
        <div className="mt-5">
          {isPending || !derived ? (
            <Skeleton className="h-[280px] w-full rounded" />
          ) : (
            <RevenueDailyLineChart data={derived.daily} />
          )}
        </div>
      </section>

      {historyError && (
        <section className="rounded-lg border border-amber-200 bg-white p-6">
          <p className="text-sm font-medium text-amber-700">Average revenue per paid client is unavailable.</p>
          <p className="mt-1 text-xs text-amber-500">Active-user history failed to load: {historyErr?.message ?? "Unknown error"}</p>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Avg revenue per unique visitor</h2>
          <p className="mt-1 text-sm text-gray-500">Monthly revenue divided by unique website visitors.</p>
          <div className="mt-4">
            {isPending || !derived ? <Skeleton className="h-16 w-32 rounded" /> : <AvgHeadline series={derived.perVisitor} />}
          </div>
          <div className="mt-5">
            {isPending || !derived ? (
              <Skeleton className="h-[240px] w-full rounded" />
            ) : (
              <RevenueAvgChart data={derived.perVisitor.buckets} valueLabel="per visitor" />
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Avg revenue per signup</h2>
          <p className="mt-1 text-sm text-gray-500">Monthly revenue divided by signups.</p>
          <div className="mt-4">
            {isPending || !derived ? <Skeleton className="h-16 w-32 rounded" /> : <AvgHeadline series={derived.perSignup} />}
          </div>
          <div className="mt-5">
            {isPending || !derived ? (
              <Skeleton className="h-[240px] w-full rounded" />
            ) : (
              <RevenueAvgChart data={derived.perSignup.buckets} valueLabel="per signup" />
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Avg revenue per paid client</h2>
          <p className="mt-1 text-sm text-gray-500">Monthly revenue divided by active paying clients.</p>
          <div className="mt-4">
            {isPending || !derived ? <Skeleton className="h-16 w-32 rounded" /> : <AvgHeadline series={derived.perPaidClient} />}
          </div>
          <div className="mt-5">
            {isPending || !derived ? (
              <Skeleton className="h-[240px] w-full rounded" />
            ) : (
              <RevenueAvgChart data={derived.perPaidClient.buckets} valueLabel="per client" />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
