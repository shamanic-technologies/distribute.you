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
import { CmgrStat } from "@/components/cmgr-stat";
import { PeriodCompoundChart } from "@/components/period-compound-chart";
import { formatUsd } from "@/lib/format-number";
import type { DailyFunnelPoint } from "@/lib/public-stats";
import {
  revenueBuckets,
  revenueCmgrSummary,
  committedBuckets,
  toCompoundPoints,
  trackedWeeks,
  monthlyRevenueByKey,
  monthlyTimelineTotals,
  monthlyActiveUsersByKey,
  avgPerSeries,
  type RevenueBucket,
  type AvgSeries,
} from "@/lib/revenue-buckets";

// Currency formatters — full for tooltips/headlines, compact for chart axes.
function usdFull(n: number): string {
  return formatUsd(n, Math.abs(n) < 10 ? 2 : 0);
}
function usdCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (abs >= 10) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${n.toFixed(2)}`;
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

/** A revenue/MRR/ARR bar+compound-growth card (reuses the shared signups chart). */
function PeriodCard({
  title,
  subtitle,
  cmgrLabel,
  cmgrUnit,
  latestPct,
  avgPct,
  buckets,
  growthLabel,
  valueLabel,
  pending,
}: {
  title: string;
  subtitle: string;
  cmgrLabel: string;
  cmgrUnit: string;
  latestPct: number | null;
  avgPct: number | null;
  buckets: RevenueBucket[];
  growthLabel: string;
  valueLabel: string;
  pending: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      <div className="mt-4">
        {pending ? (
          <Skeleton className="h-16 w-32 rounded" />
        ) : (
          <CmgrStat latestPct={latestPct} avgPct={avgPct} label={cmgrLabel} unit={cmgrUnit} />
        )}
      </div>
      <div className="mt-5">
        {pending ? (
          <Skeleton className="h-[280px] w-full rounded" />
        ) : (
          <PeriodCompoundChart
            data={toCompoundPoints(buckets)}
            valueLabel={valueLabel}
            growthLabel={growthLabel}
            formatValue={usdFull}
            formatAxis={usdCompact}
          />
        )}
      </div>
    </div>
  );
}

/** Snapshot + "avg of the avg" headline for an average-revenue-per-X card. */
function AvgHeadline({ series }: { series: AvgSeries }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-gray-950">{series.pooledUsd === null ? "—" : usdFull(series.pooledUsd)}</p>
      <p className="mt-0.5 text-xs text-gray-400">
        {series.snapshotUsd === null ? "—" : usdFull(series.snapshotUsd)} last complete month
      </p>
    </div>
  );
}

function AvgCard({
  title,
  subtitle,
  series,
  valueLabel,
  pending,
}: {
  title: string;
  subtitle: string;
  series: AvgSeries;
  valueLabel: string;
  pending: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      <div className="mt-4">{pending ? <Skeleton className="h-16 w-32 rounded" /> : <AvgHeadline series={series} />}</div>
      <div className="mt-5">
        {pending ? (
          <Skeleton className="h-[280px] w-full rounded" />
        ) : (
          // No growth line for an average ratio — just the bars, current period in pencil.
          <PeriodCompoundChart
            data={toCompoundPoints(series.buckets, false)}
            valueLabel={valueLabel}
            growthLabel=""
            formatValue={usdFull}
            formatAxis={usdCompact}
          />
        )}
      </div>
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

    // MRR/ARR = COMMITTED run-rate (active daily budget × 30), snapshotted daily by
    // features-service. Current-period point == the live Current MRR card.
    const cm = data.committedMrr;
    const monthlyMrr = committedBuckets(cm.monthly, "mrrUsd", "month");
    const weeklyMrr = committedBuckets(cm.weekly, "mrrUsd", "week");
    const monthlyArr = committedBuckets(cm.monthly, "arrUsd", "month");
    const weeklyArr = committedBuckets(cm.weekly, "arrUsd", "week");

    const revenueByMonth = monthlyRevenueByKey(data.monthly);
    const visitorsByMonth = monthlyTimelineTotals(timeline, "landingVisitors");
    const signupsByMonth = monthlyTimelineTotals(timeline, "signups");
    const paidClientsByMonth = monthlyActiveUsersByKey(history?.monthly ?? []);

    return {
      monthly,
      weekly,
      monthlyMrr,
      weeklyMrr,
      monthlyArr,
      weeklyArr,
      monthlyCmgr: revenueCmgrSummary(monthly),
      weeklyCmgr: revenueCmgrSummary(weekly),
      // ARR = MRR × 12 → same growth, so MRR & ARR share these.
      monthlyMrrCmgr: revenueCmgrSummary(monthlyMrr),
      weeklyMrrCmgr: revenueCmgrSummary(weeklyMrr),
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

  const mc = derived?.monthlyCmgr;
  const wc = derived?.weeklyCmgr;
  const mmc = derived?.monthlyMrrCmgr;
  const wmc = derived?.weeklyMrrCmgr;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total revenue"
          value={data ? usdFull(data.totalRevenueUsd) : "—"}
          detail="Realized cold-email revenue since inception"
          accent="bg-brand-500"
          pending={isPending}
        />
        <StatCard
          label="Current MRR (committed)"
          value={data ? usdFull(data.currentMrrUsd) : "—"}
          detail="Active daily budgets × 30 — committed run-rate, live fleet"
          accent="bg-emerald-500"
          pending={isPending}
        />
        <StatCard
          label="Tracked revenue weeks"
          value={data ? trackedWeeks(data.sinceInceptionDaily).toLocaleString("en-US") : "—"}
          detail="Weeks since the first billed cold-email spend"
          accent="bg-sky-500"
          pending={isPending}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCard
          title="Monthly revenue"
          subtitle="Realized revenue per month with compound monthly growth since inception."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          latestPct={mc?.latestPct ?? null}
          avgPct={mc?.avgPct ?? null}
          buckets={derived?.monthly ?? []}
          growthLabel="CMGR since inception"
          valueLabel="revenue"
          pending={isPending || !derived}
        />
        <PeriodCard
          title="Weekly revenue"
          subtitle="Realized revenue per week with compound weekly growth since inception."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          latestPct={wc?.latestPct ?? null}
          avgPct={wc?.avgPct ?? null}
          buckets={derived?.weekly ?? []}
          growthLabel="CWGR since inception"
          valueLabel="revenue"
          pending={isPending || !derived}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCard
          title="Monthly MRR"
          subtitle="Committed run-rate: active daily budgets × 30, recorded daily (current period = live MRR)."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          latestPct={mmc?.latestPct ?? null}
          avgPct={mmc?.avgPct ?? null}
          buckets={derived?.monthlyMrr ?? []}
          growthLabel="CMGR since inception"
          valueLabel="MRR"
          pending={isPending || !derived}
        />
        <PeriodCard
          title="Weekly MRR"
          subtitle="Committed run-rate: active daily budgets × 30, recorded weekly (current period = live MRR)."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          latestPct={wmc?.latestPct ?? null}
          avgPct={wmc?.avgPct ?? null}
          buckets={derived?.weeklyMrr ?? []}
          growthLabel="CWGR since inception"
          valueLabel="MRR"
          pending={isPending || !derived}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCard
          title="Monthly ARR"
          subtitle="Committed annual run-rate: MRR × 12, recorded monthly."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          latestPct={mmc?.latestPct ?? null}
          avgPct={mmc?.avgPct ?? null}
          buckets={derived?.monthlyArr ?? []}
          growthLabel="CMGR since inception"
          valueLabel="ARR"
          pending={isPending || !derived}
        />
        <PeriodCard
          title="Weekly ARR"
          subtitle="Committed annual run-rate: MRR × 12, recorded weekly."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          latestPct={wmc?.latestPct ?? null}
          avgPct={wmc?.avgPct ?? null}
          buckets={derived?.weeklyArr ?? []}
          growthLabel="CWGR since inception"
          valueLabel="ARR"
          pending={isPending || !derived}
        />
      </section>

      {historyError && (
        <section className="rounded-lg border border-amber-200 bg-white p-6">
          <p className="text-sm font-medium text-amber-700">Average revenue per paid client is unavailable.</p>
          <p className="mt-1 text-xs text-amber-500">Active-user history failed to load: {historyErr?.message ?? "Unknown error"}</p>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <AvgCard
          title="Avg revenue per unique visitor"
          subtitle="Total revenue divided by total unique website visitors, since inception."
          series={derived?.perVisitor ?? { buckets: [], pooledUsd: null, snapshotUsd: null, avgOfAvgUsd: null }}
          valueLabel="per visitor"
          pending={isPending || !derived}
        />
        <AvgCard
          title="Avg revenue per signup"
          subtitle="Total revenue divided by total signups, since inception."
          series={derived?.perSignup ?? { buckets: [], pooledUsd: null, snapshotUsd: null, avgOfAvgUsd: null }}
          valueLabel="per signup"
          pending={isPending || !derived}
        />
        <AvgCard
          title="Avg revenue per paid client"
          subtitle="Total revenue divided by total active paying clients, since inception."
          series={derived?.perPaidClient ?? { buckets: [], pooledUsd: null, snapshotUsd: null, avgOfAvgUsd: null }}
          valueLabel="per client"
          pending={isPending || !derived}
        />
      </section>
    </>
  );
}
