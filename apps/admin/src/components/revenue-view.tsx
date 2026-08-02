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
import type { BillingStats, DailyFunnelPoint } from "@/lib/public-stats";
import {
  revenueBuckets,
  revenueCmgrSummary,
  committedBuckets,
  retentionSeries,
  cashBuckets,
  centsStringToUsd,
  toCompoundPoints,
  trackedWeeks,
  monthlyRevenueByKey,
  monthlyTimelineTotals,
  monthlyActiveUsersByKey,
  avgPerSeries,
  type RevenueBucket,
  type AvgSeries,
  type RetentionSeries,
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
  barsUsed,
  buckets,
  growthLabel,
  valueLabel,
  pending,
}: {
  title: string;
  subtitle: string;
  cmgrLabel: string;
  cmgrUnit: "weekly" | "monthly";
  latestPct: number | null;
  avgPct: number | null;
  barsUsed: number | null;
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
          <CmgrStat
            latestPct={latestPct}
            avgPct={avgPct}
            barsUsed={barsUsed}
            label={cmgrLabel}
            unit={cmgrUnit}
          />
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

const EMPTY_RETENTION: RetentionSeries = {
  buckets: [],
  latestConcludedPct: null,
  latestConcludedLabel: null,
  latestConcludedCohort: null,
};

function pctFull(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}
function pctAxis(n: number): string {
  return `${Math.round(n)}%`;
}

/**
 * A net-revenue-retention card: the last CONCLUDED period's rate as the
 * headline, the measured periods as bars. No growth line — a rate of a rate
 * reads as nothing.
 */
function RetentionCard({
  title,
  subtitle,
  series,
  pending,
}: {
  title: string;
  subtitle: string;
  series: RetentionSeries;
  pending: boolean;
}) {
  const rate = series.latestConcludedPct;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      <div className="mt-4">
        {pending ? (
          <Skeleton className="h-16 w-32 rounded" />
        ) : (
          <div>
            {/* Green above 100 is the metric's own meaning — the existing base
                grew without a single new customer — not a chart-colour habit. */}
            <p
              className={`text-2xl font-semibold ${
                rate === null ? "text-gray-400" : rate >= 100 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {rate === null ? "Not measured yet" : pctFull(rate)}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {series.latestConcludedLabel === null
                ? "No concluded period has a prior cohort to retain"
                : `${series.latestConcludedLabel}, last complete period · ${series.latestConcludedCohort} customers carried in`}
            </p>
          </div>
        )}
      </div>
      <div className="mt-5">
        {pending ? (
          <Skeleton className="h-[280px] w-full rounded" />
        ) : (
          <PeriodCompoundChart
            data={toCompoundPoints(series.buckets, false)}
            valueLabel="retention"
            growthLabel=""
            formatValue={pctFull}
            formatAxis={pctAxis}
          />
        )}
      </div>
    </div>
  );
}

/** A band heading that names WHICH money the cards under it are about. */
function SectionHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">{blurb}</p>
    </div>
  );
}

export function RevenueView({ timeline, billing }: { timeline: DailyFunnelPoint[]; billing: BillingStats }) {
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
      monthlyNrr: retentionSeries(data.netRevenueRetention?.monthly ?? [], "month"),
      weeklyNrr: retentionSeries(data.netRevenueRetention?.weekly ?? [], "week"),
    };
  }, [data, history, timeline]);

  // Cash collected is server-side data on the page's own props — no query, no
  // poll, already fetched on every render of this route.
  const cash = useMemo(() => {
    const monthly = cashBuckets(billing.monthly_growth, "month");
    const weekly = cashBuckets(billing.weekly_growth, "week");
    return {
      monthly,
      weekly,
      monthlyCmgr: revenueCmgrSummary(monthly),
      weeklyCmgr: revenueCmgrSummary(weekly),
      grossUsd: centsStringToUsd(billing.total_paid_cents, "total_paid_cents"),
      returnedUsd: centsStringToUsd(billing.total_returned_cents, "total_returned_cents"),
      netUsd: centsStringToUsd(billing.total_revenue_cents, "total_revenue_cents"),
    };
  }, [billing]);

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
      <SectionHeading
        title="Cash collected"
        blurb="What customers paid us through Stripe, minus what went back out. Runs ahead of consumption below by the credit that is bought and not yet spent."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Net collected"
          value={usdFull(cash.netUsd)}
          detail="Charged less refunds and lost disputes — what we keep"
          accent="bg-emerald-500"
          pending={false}
        />
        <StatCard
          label="Gross charged"
          value={usdFull(cash.grossUsd)}
          detail="Every succeeded Stripe charge, before anything went back"
          accent="bg-sky-500"
          pending={false}
        />
        <StatCard
          label="Refunded and lost disputes"
          value={usdFull(cash.returnedUsd)}
          detail="Settled refunds plus disputes we lost"
          accent="bg-red-500"
          pending={false}
        />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCard
          title="Monthly net cash"
          subtitle="Stripe cash per month, net of refunds and lost disputes, with compound monthly growth since the first charge."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          latestPct={cash.monthlyCmgr.latestPct}
          avgPct={cash.monthlyCmgr.avgPct}
          barsUsed={cash.monthlyCmgr.barsUsed}
          buckets={cash.monthly}
          growthLabel="CMGR since the first charge"
          valueLabel="net cash"
          pending={false}
        />
        <PeriodCard
          title="Weekly net cash"
          subtitle="Stripe cash per week, net of refunds and lost disputes, with compound weekly growth since the first charge."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          latestPct={cash.weeklyCmgr.latestPct}
          avgPct={cash.weeklyCmgr.avgPct}
          barsUsed={cash.weeklyCmgr.barsUsed}
          buckets={cash.weekly}
          growthLabel="CWGR since the first charge"
          valueLabel="net cash"
          pending={false}
        />
      </section>

      <SectionHeading
        title="Revenue consumed"
        blurb="What customers actually burned in cold-email sending, after each org's usage discount. Stripe is nowhere in this figure — a refund reverses a payment, it cannot un-send an email, so refunds move the cash above and not this."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total revenue"
          value={data ? usdFull(data.totalRevenueUsd) : "—"}
          detail="Cold-email spend consumed since inception, net of usage discounts"
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
          barsUsed={mc?.barsUsed ?? null}
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
          barsUsed={wc?.barsUsed ?? null}
          buckets={derived?.weekly ?? []}
          growthLabel="CWGR since inception"
          valueLabel="revenue"
          pending={isPending || !derived}
        />
      </section>

      <SectionHeading
        title="Net revenue retention"
        blurb="Of the money the customers who were spending last period are spending now, how much remains. Expansion, contraction and churn among them all land in the one number, and a customer we acquired during the period counts on neither side — which is what makes it comparable: above 100% the existing base grows on its own, above 120% is where public SaaS trades at a premium. The current period is still filling up, so the headline states the last complete one."
      />

      <section className="grid gap-6 md:grid-cols-2">
        <RetentionCard
          title="Monthly NRR"
          subtitle="Month-over-month retention of the prior month's paying customers."
          series={derived?.monthlyNrr ?? EMPTY_RETENTION}
          pending={isPending || !derived}
        />
        <RetentionCard
          title="Weekly NRR"
          subtitle="Week-over-week retention of the prior week's paying customers."
          series={derived?.weeklyNrr ?? EMPTY_RETENTION}
          pending={isPending || !derived}
        />
      </section>

      <SectionHeading
        title="Committed run-rate"
        blurb="What the live fleet is contracted to bill: active daily budgets × 30. A point-in-time snapshot recorded daily going forward, so the series starts when recording started and does not reach back to inception — a growth rate only appears once there are two recorded periods to compare."
      />

      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCard
          title="Monthly MRR"
          subtitle="Committed run-rate: active daily budgets × 30, recorded daily (current period = live MRR)."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          latestPct={mmc?.latestPct ?? null}
          avgPct={mmc?.avgPct ?? null}
          barsUsed={mmc?.barsUsed ?? null}
          buckets={derived?.monthlyMrr ?? []}
          growthLabel="CMGR since the first snapshot"
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
          barsUsed={wmc?.barsUsed ?? null}
          buckets={derived?.weeklyMrr ?? []}
          growthLabel="CWGR since the first snapshot"
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
          barsUsed={mmc?.barsUsed ?? null}
          buckets={derived?.monthlyArr ?? []}
          growthLabel="CMGR since the first snapshot"
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
          barsUsed={wmc?.barsUsed ?? null}
          buckets={derived?.weeklyArr ?? []}
          growthLabel="CWGR since the first snapshot"
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

      <SectionHeading
        title="Revenue consumed per audience"
        blurb="The consumed revenue above divided by each funnel stage's population, month by month. The headline is pooled across every concluded month since the first earning one; the line under it is the last complete month on its own."
      />

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
