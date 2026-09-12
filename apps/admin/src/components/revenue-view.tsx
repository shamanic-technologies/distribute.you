"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getFleetRevenue,
  getActiveUsersByUser,
  type FleetRevenue,
  type ActiveUsersByUser,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { PeriodCompoundChart } from "@/components/period-compound-chart";
import { PeriodCompoundCard } from "@/components/period-compound-card";
import { formatUsd } from "@/lib/format-number";
import type { BillingStats, FirstSeenMonthRow } from "@/lib/public-stats";
import { StatedAmountsCard } from "@/components/revenue/stated-amounts-card";
import {
  revenueBuckets,
  revenueCmgrSummary,
  mrrSplitBuckets,
  unmeasurableSplitPeriods,
  retentionSeries,
  cashBuckets,
  centsStringToUsd,
  toCompoundPoints,
  trackedWeeks,
  monthlyRevenueByKey,
  firstSeenMonthTotals,
  newPaidClientsByMonth,
  cumulativeAvgSeries,
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
  // A thin money wrapper over the one shared card: it maps revenue buckets to points
  // and pins the currency formatters, so the ten call sites below do not each repeat
  // them. The card itself is the SAME one every other /metrics tab draws.
  return (
    <PeriodCompoundCard
      title={title}
      subtitle={subtitle}
      cmgrLabel={cmgrLabel}
      cmgrUnit={cmgrUnit}
      summary={{ latestPct, avgPct, barsUsed }}
      data={toCompoundPoints(buckets)}
      valueLabel={valueLabel}
      growthLabel={growthLabel}
      formatValue={usdFull}
      formatAxis={usdCompact}
      pending={pending}
    />
  );
}

/**
 * Headline for an average-revenue-per-X card: the global figure, with the DISTINCT
 * population it divides by underneath.
 *
 * The line under the number states the denominator rather than the latest month's
 * own ratio: a monthly figure sits on a different basis than the headline, so one
 * card would carry two answers under one title.
 */
function AvgHeadline({ series, denominatorLabel }: { series: AvgSeries; denominatorLabel: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-gray-950">{series.pooledUsd === null ? "—" : usdFull(series.pooledUsd)}</p>
      <p className="mt-0.5 text-xs text-gray-400">
        {series.denominator === null
          ? "—"
          : `${series.denominator.toLocaleString("en-US")} ${denominatorLabel} since inception`}
      </p>
    </div>
  );
}

/** Nothing measured yet — every figure reads "—", never a fabricated zero. */
const EMPTY_AVG_SERIES: AvgSeries = { buckets: [], pooledUsd: null, denominator: null };

function AvgCard({
  title,
  subtitle,
  series,
  valueLabel,
  denominatorLabel,
  pending,
}: {
  title: string;
  subtitle: string;
  series: AvgSeries;
  valueLabel: string;
  denominatorLabel: string;
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
          <AvgHeadline series={series} denominatorLabel={denominatorLabel} />
        )}
      </div>
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
 * 100% is where retention stops being a number and becomes a verdict: above it
 * the existing base grew with no new customers, below it the base shrank. The
 * chart draws it as a solid line so a reader can answer that at a glance without
 * reading a single tick.
 */
const RETENTION_BREAK_EVEN_PCT = 100;

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
  excludeFirstFromScale = false,
}: {
  title: string;
  subtitle: string;
  series: RetentionSeries;
  pending: boolean;
  /** Weekly only: its first measurable week dwarfs the rest. See the chart's own note. */
  excludeFirstFromScale?: boolean;
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
            referenceValue={RETENTION_BREAK_EVEN_PCT}
            excludeFirstFromScale={excludeFirstFromScale}
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

export function RevenueView({
  billing,
  visitorFirstSeenMonths,
  signupFirstSeenMonths,
}: {
  billing: BillingStats;
  visitorFirstSeenMonths: FirstSeenMonthRow[];
  signupFirstSeenMonths: FirstSeenMonthRow[];
}) {
  const { data, isPending, isError, error } = useAuthQuery<FleetRevenue>(
    ["fleetRevenue"],
    () => getFleetRevenue(),
    pollOptionsSlower,
  );

  // Per-USER rather than the monthly totals: the avg-per-client denominator is the
  // DISTINCT orgs ever active, which only `firstActiveMonth` per org can answer.
  const {
    data: history,
    isError: historyError,
    error: historyErr,
  } = useAuthQuery<ActiveUsersByUser>(["activeUsersByUser"], () => getActiveUsersByUser(), pollOptionsSlower);

  const derived = useMemo(() => {
    if (!data) return null;
    const monthly = revenueBuckets(data.monthly, "month");
    const weekly = revenueBuckets(data.weekly, "week");

    // The run-rate, in its TWO halves. features-service computes both and their
    // total; nothing is added, subtracted or re-divided here. The current-period
    // point of each is its live figure, so the charts reconcile with the cards.
    //
    // ARR is deliberately NOT charted: it is MRR × 12, so its curve and its growth
    // are the MRR curve and the MRR growth with a multiplier on the axis. It is
    // stated on the cards, where the number is the point.
    const split = data.mrrSplit ?? null;
    const monthlySelfServe = split ? mrrSplitBuckets(split.monthly, "selfServeMrrUsd", "month") : [];
    const weeklySelfServe = split ? mrrSplitBuckets(split.weekly, "selfServeMrrUsd", "week") : [];
    const monthlyAgency = split ? mrrSplitBuckets(split.monthly, "agencyMrrUsd", "month") : [];
    const weeklyAgency = split ? mrrSplitBuckets(split.weekly, "agencyMrrUsd", "week") : [];
    const monthlyTotal = split ? mrrSplitBuckets(split.monthly, "totalMrrUsd", "month") : [];
    const weeklyTotal = split ? mrrSplitBuckets(split.weekly, "totalMrrUsd", "week") : [];

    // Each denominator is NEW ENTRANTS per month — one row per person, in the month
    // they first reached that stage — which `cumulativeAvgSeries` accumulates into
    // the distinct population. Never a per-month count summed across months.
    const revenueByMonth = monthlyRevenueByKey(data.monthly);
    const newVisitorsByMonth = firstSeenMonthTotals(visitorFirstSeenMonths);
    const newSignupsByMonth = firstSeenMonthTotals(signupFirstSeenMonths);
    const newPaidClients = newPaidClientsByMonth(history?.users ?? []);

    return {
      monthly,
      weekly,
      split,
      // Periods the producer declined to split. Charted nowhere (a dropped bucket,
      // never a zero bar), so they are NAMED instead — otherwise a month simply
      // goes missing from the curve with nothing on the page saying why.
      unmeasurableMonths: split ? unmeasurableSplitPeriods(split.monthly) : [],
      unmeasurableWeeks: split ? unmeasurableSplitPeriods(split.weekly) : [],
      monthlySelfServe,
      weeklySelfServe,
      monthlyAgency,
      weeklyAgency,
      monthlyTotal,
      weeklyTotal,
      monthlyCmgr: revenueCmgrSummary(monthly),
      weeklyCmgr: revenueCmgrSummary(weekly),
      monthlySelfServeCmgr: revenueCmgrSummary(monthlySelfServe),
      weeklySelfServeCmgr: revenueCmgrSummary(weeklySelfServe),
      monthlyAgencyCmgr: revenueCmgrSummary(monthlyAgency),
      weeklyAgencyCmgr: revenueCmgrSummary(weeklyAgency),
      monthlyTotalCmgr: revenueCmgrSummary(monthlyTotal),
      weeklyTotalCmgr: revenueCmgrSummary(weeklyTotal),
      perVisitor: cumulativeAvgSeries(revenueByMonth, newVisitorsByMonth),
      perSignup: cumulativeAvgSeries(revenueByMonth, newSignupsByMonth),
      perPaidClient: cumulativeAvgSeries(revenueByMonth, newPaidClients),
      monthlyNrr: retentionSeries(data.netRevenueRetention?.monthly ?? [], "month"),
      weeklyNrr: retentionSeries(data.netRevenueRetention?.weekly ?? [], "week"),
    };
  }, [data, history, visitorFirstSeenMonths, signupFirstSeenMonths]);

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
  const split = derived?.split ?? null;
  // The producer computes the split fail-soft and answers null when it could not
  // read the stated amounts. That is "we could not measure this" — it is STATED
  // below, never rendered as a zero agency and a self-serve half that silently
  // equals the whole fleet.
  const splitUnavailable = Boolean(data) && !isPending && split === null;
  // Agency budget that left the self-serve half and landed in NEITHER: a brand
  // under an agency org that nobody has stated an amount for yet. Served so the
  // gap is visible instead of quietly shrinking the total.
  const unstatedAgencyUsd =
    split && split.currentAgencyBudgetMrrUsd > split.currentAgencyMrrUsd
      ? split.currentAgencyBudgetMrrUsd - split.currentAgencyMrrUsd
      : 0;
  // Named rather than silently missing from the curve. The two sides of the
  // subtraction were recorded on different bases — the fleet snapshot holds the
  // RUNNING daily budget, billing's timeline the CONFIGURED one — so on a period
  // where the agency's replayed budget exceeds the recorded total the difference
  // comes out negative, and the producer declines to state it.
  const unmeasurable = [...(derived?.unmeasurableMonths ?? []), ...(derived?.unmeasurableWeeks ?? [])];

  return (
    <>
      <SectionHeading
        title="Cash collected"
        blurb="What customers paid us, whichever acquirer took the payment, minus what went back out. Runs ahead of consumption below by the credit that is bought and not yet spent."
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
          detail="Every payment that went through, before anything went back"
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
          subtitle="Cash per month, net of refunds and lost disputes, with compound monthly growth since the first charge."
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
          subtitle="Cash per week, net of refunds and lost disputes, with compound weekly growth since the first charge."
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
        blurb="What customers actually burned in cold-email sending, after each org's usage discount. No payment is in this figure: a refund reverses a payment, it cannot un-send an email, so refunds move the cash above and not this."
      />

      {/* The committed run-rate used to sit here as a third card. It moved into
          its own band below, because the fleet figure and the two halves it
          splits into are three MRRs, and a page that states one of them beside
          consumption and the others two screens down reads as contradicting
          itself. There is ONE MRR band now. */}
      <section className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Total revenue"
          value={data ? usdFull(data.totalRevenueUsd) : "—"}
          detail="Cold-email spend consumed since inception, net of usage discounts"
          accent="bg-brand-500"
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
          excludeFirstFromScale
          series={derived?.weeklyNrr ?? EMPTY_RETENTION}
          pending={isPending || !derived}
        />
      </section>

      {/* ── MONTHLY RUN-RATE, IN ITS TWO HALVES ─────────────────────────────
          One band, one vocabulary. It replaces both retired surfaces: the
          undifferentiated run-rate band that used to sit here, and the live
          fleet card that sat beside consumption — three MRRs on one page, on
          two different bases, is the contradiction this removes. ARR is stated
          on the cards and never
          charted: it is MRR × 12, so its curve and its growth are the MRR ones
          with a multiplier on the axis. */}
      <SectionHeading
        title="Monthly run-rate"
        blurb="What the fleet is worth per month, in the two halves it is actually earned in. A SELF-SERVE customer pays through the product, so what they are worth IS their daily budget × 30. An AGENCY does not: it hands over cash at its own discretion and somebody then decides how that cash is spread into daily budgets across its brands, so there the budget says how the money was split and never what the customer is worth — only what a human states does. The two halves are disjoint, so they add up."
      />

      {splitUnavailable ? (
        <section className="rounded-lg border border-amber-200 bg-white p-6">
          <p className="text-sm font-medium text-amber-700">The run-rate could not be split.</p>
          <p className="mt-1 text-sm text-amber-600">
            features-service could not read the stated amounts, so it declined to answer rather than
            report an agency worth nothing and a self-serve half quietly holding the whole fleet. The
            fleet committed run-rate is still {data ? usdFull(data.currentMrrUsd) : "—"} per month.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Self-serve MRR"
              value={split ? usdFull(split.currentSelfServeMrrUsd) : "—"}
              detail={
                split
                  ? `${usdFull(split.currentSelfServeArrUsd)} a year — daily budgets × 30, every org that is not an agency`
                  : "Daily budgets × 30, every org that is not an agency"
              }
              accent="bg-brand-500"
              pending={isPending || !derived}
            />
            <StatCard
              label="Agency MRR"
              value={split ? usdFull(split.currentAgencyMrrUsd) : "—"}
              detail={
                split
                  ? `${usdFull(split.currentAgencyArrUsd)} a year — what a human stated, never those brands' budget × 30`
                  : "What a human stated, never those brands' budget × 30"
              }
              accent="bg-emerald-500"
              pending={isPending || !derived}
            />
            <StatCard
              label="Total MRR"
              value={split ? usdFull(split.currentTotalMrrUsd) : "—"}
              detail={
                split
                  ? `${usdFull(split.currentTotalArrUsd)} a year — the two halves, which never overlap`
                  : "The two halves, which never overlap"
              }
              accent="bg-sky-500"
              pending={isPending || !derived}
            />
          </section>

          {/* Agency budget that left the self-serve half and landed in NEITHER —
              a brand under an agency org nobody has stated an amount for yet.
              Stated rather than absorbed: without it the total silently sits
              below the fleet figure and nothing says why. */}
          {unmeasurable.length > 0 && (
            <section className="rounded-lg border border-amber-200 bg-white p-4">
              <p className="text-sm text-amber-700">
                The self-serve half could not be measured for {unmeasurable.length}{" "}
                {unmeasurable.length === 1 ? "period" : "periods"} ({unmeasurable.join(", ")}), so they are
                not on the charts. On those the agency&apos;s replayed daily budget came out larger than
                the run-rate it is subtracted from — the fleet snapshot records the budget that was
                RUNNING while the replay reads the budget that was CONFIGURED, and where those disagree
                the difference is not a quantity. The agency half is unaffected: it is a sum of what you
                stated, not a subtraction.
              </p>
            </section>
          )}

          {unstatedAgencyUsd > 0 && (
            <section className="rounded-lg border border-amber-200 bg-white p-4">
              <p className="text-sm text-amber-700">
                {usdFull(unstatedAgencyUsd)} a month of agency budget is in neither half — an agency brand
                nobody has stated an amount for yet. Until it is stated, the total sits that much below the
                fleet&apos;s committed run-rate.
              </p>
            </section>
          )}

          <section className="grid gap-6 md:grid-cols-2">
            <PeriodCard
              title="Monthly MRR"
              subtitle="Self-serve plus agency, per month, with compound monthly growth."
              cmgrLabel="CMGR"
              cmgrUnit="monthly"
              latestPct={derived?.monthlyTotalCmgr.latestPct ?? null}
              avgPct={derived?.monthlyTotalCmgr.avgPct ?? null}
              barsUsed={derived?.monthlyTotalCmgr.barsUsed ?? null}
              buckets={derived?.monthlyTotal ?? []}
              growthLabel="CMGR since the first recorded day"
              valueLabel="MRR"
              pending={isPending || !derived}
            />
            <PeriodCard
              title="Weekly MRR"
              subtitle="Self-serve plus agency, per week, with compound weekly growth."
              cmgrLabel="CWGR"
              cmgrUnit="weekly"
              latestPct={derived?.weeklyTotalCmgr.latestPct ?? null}
              avgPct={derived?.weeklyTotalCmgr.avgPct ?? null}
              barsUsed={derived?.weeklyTotalCmgr.barsUsed ?? null}
              buckets={derived?.weeklyTotal ?? []}
              growthLabel="CWGR since the first recorded day"
              valueLabel="MRR"
              pending={isPending || !derived}
            />
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <PeriodCard
              title="Monthly self-serve MRR"
              subtitle="Daily budgets × 30 for every org that is not an agency, recorded daily."
              cmgrLabel="CMGR"
              cmgrUnit="monthly"
              latestPct={derived?.monthlySelfServeCmgr.latestPct ?? null}
              avgPct={derived?.monthlySelfServeCmgr.avgPct ?? null}
              barsUsed={derived?.monthlySelfServeCmgr.barsUsed ?? null}
              buckets={derived?.monthlySelfServe ?? []}
              growthLabel="CMGR since the first recorded day"
              valueLabel="self-serve MRR"
              pending={isPending || !derived}
            />
            <PeriodCard
              title="Weekly self-serve MRR"
              subtitle="Daily budgets × 30 for every org that is not an agency, recorded weekly."
              cmgrLabel="CWGR"
              cmgrUnit="weekly"
              latestPct={derived?.weeklySelfServeCmgr.latestPct ?? null}
              avgPct={derived?.weeklySelfServeCmgr.avgPct ?? null}
              barsUsed={derived?.weeklySelfServeCmgr.barsUsed ?? null}
              buckets={derived?.weeklySelfServe ?? []}
              growthLabel="CWGR since the first recorded day"
              valueLabel="self-serve MRR"
              pending={isPending || !derived}
            />
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <PeriodCard
              title="Monthly agency MRR"
              subtitle="What a human stated the agency's brands are worth, per month."
              cmgrLabel="CMGR"
              cmgrUnit="monthly"
              latestPct={derived?.monthlyAgencyCmgr.latestPct ?? null}
              avgPct={derived?.monthlyAgencyCmgr.avgPct ?? null}
              barsUsed={derived?.monthlyAgencyCmgr.barsUsed ?? null}
              buckets={derived?.monthlyAgency ?? []}
              growthLabel="CMGR since the first recorded day"
              valueLabel="agency MRR"
              pending={isPending || !derived}
            />
            <PeriodCard
              title="Weekly agency MRR"
              subtitle="What a human stated the agency's brands are worth, per week."
              cmgrLabel="CWGR"
              cmgrUnit="weekly"
              latestPct={derived?.weeklyAgencyCmgr.latestPct ?? null}
              avgPct={derived?.weeklyAgencyCmgr.avgPct ?? null}
              barsUsed={derived?.weeklyAgencyCmgr.barsUsed ?? null}
              buckets={derived?.weeklyAgency ?? []}
              growthLabel="CWGR since the first recorded day"
              valueLabel="agency MRR"
              pending={isPending || !derived}
            />
          </section>
        </>
      )}

      <StatedAmountsCard />

      {historyError && (
        <section className="rounded-lg border border-amber-200 bg-white p-6">
          <p className="text-sm font-medium text-amber-700">Average revenue per paid client is unavailable.</p>
          <p className="mt-1 text-xs text-amber-500">Active-user history failed to load: {historyErr?.message ?? "Unknown error"}</p>
        </section>
      )}

      <SectionHeading
        title="Revenue consumed per audience"
        blurb="The consumed revenue above divided by the DISTINCT population that has ever reached each funnel stage — every person counted once, however many months they were around. The chart is cumulative, so its last concluded point IS the headline."
      />

      <section className="grid gap-6 lg:grid-cols-3">
        <AvgCard
          title="Avg revenue per unique visitor"
          subtitle="All revenue divided by every distinct visitor since inception."
          series={derived?.perVisitor ?? EMPTY_AVG_SERIES}
          valueLabel="per visitor"
          denominatorLabel="visitors"
          pending={isPending || !derived}
        />
        <AvgCard
          title="Avg revenue per signup"
          subtitle="All revenue divided by every distinct signup since inception."
          series={derived?.perSignup ?? EMPTY_AVG_SERIES}
          valueLabel="per signup"
          denominatorLabel="signups"
          pending={isPending || !derived}
        />
        <AvgCard
          title="Avg revenue per paid client"
          subtitle="All revenue divided by every org that has ever billed cold-email spend — a client counted once, not once per month."
          series={derived?.perPaidClient ?? EMPTY_AVG_SERIES}
          valueLabel="per client"
          denominatorLabel="clients"
          pending={isPending || !derived}
        />
      </section>
    </>
  );
}
