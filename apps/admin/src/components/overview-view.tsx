"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getActiveUsersHistory,
  getActiveUsersByUser,
  getCustomerSuccess,
  getFleetRevenue,
  type ActiveUsersBucket,
  type ActiveUsersByUser,
  type ActiveUsersHistory,
  type CustomerSuccessBoard,
  type FleetRevenue,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { PeriodCompoundCard } from "@/components/period-compound-card";
import type { PeriodCompoundPoint } from "@/components/period-compound-chart";
import { compoundGrowthSeries, compoundGrowthSummary, type CompoundGrowthSummary } from "@/lib/compound-growth";
import { formatUsd } from "@/lib/format-number";
import type { DailyFunnelPoint, FunnelWindowTotals } from "@/lib/public-stats";
import {
  EconomicsCard,
  FunnelIndexChart,
  FunnelStatCard,
} from "@/components/overview-funnel-cards";
import {
  activeOrgsSince,
  clientEconomics,
  economicsRows,
  funnelSteps,
  funnelWindows,
  sumSince,
} from "@/lib/funnel-overview";
import {
  cmgrSummary,
  rateCmgrSummary,
  monthlyVisitors,
  weeklyVisitors,
  monthlySignups,
  weeklySignups,
  monthlySignupRates,
  weeklySignupRates,
  monthlyCards,
  weeklyCards,
  monthlyCardRates,
  weeklyCardRates,
  type RateBucket,
  type SignupBucket,
} from "@/lib/signup-buckets";
import { revenueBuckets, revenueCmgrSummary, mrrSplitBuckets, toCompoundPoints } from "@/lib/revenue-buckets";

const EMPTY_SUMMARY: CompoundGrowthSummary = { latestPct: null, avgPct: null, barsUsed: null };

function usdFull(n: number): string {
  return formatUsd(n, Math.abs(n) < 10 ? 2 : 0);
}
function usdCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (abs >= 10) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${n.toFixed(2)}`;
}
/** A rate bar's own value, already a percentage. One decimal: 0.4% and 0.9% are different answers. */
function ratePct(value: number): string {
  return `${value.toFixed(1)}%`;
}
function countPoints(buckets: SignupBucket[]): PeriodCompoundPoint[] {
  return buckets.map((b) => ({ label: b.label, value: b.signups, cmgrPct: b.cmgrPct }));
}
function ratePoints(buckets: RateBucket[]): PeriodCompoundPoint[] {
  return buckets.map((b) => ({ label: b.label, value: b.ratePct, cmgrPct: b.cmgrPct }));
}
function bucketLabel(periodStart: string, granularity: "month" | "week"): string {
  return new Date(`${periodStart}T00:00:00.000Z`).toLocaleDateString("en-US", {
    ...(granularity === "month" ? { month: "short", year: "numeric" } : { month: "short", day: "numeric" }),
    timeZone: "UTC",
  });
}
function activePoints(buckets: ActiveUsersBucket[], granularity: "month" | "week"): PeriodCompoundPoint[] {
  const cmgr = compoundGrowthSeries(buckets.map((b) => b.activeUsers));
  return buckets.map((b, i) => ({
    label: bucketLabel(b.periodStart, granularity),
    value: b.activeUsers,
    cmgrPct: cmgr[i],
  }));
}

function SectionHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">{blurb}</p>
    </div>
  );
}

/**
 * The whole funnel on one page: the totals at each stage, where people drop out over
 * three windows, what the customers who come out are worth, and every headline chart
 * the four other tabs draw — through the SAME card component they use, so a figure
 * cannot read one way here and another way one click over.
 */
export function OverviewView({
  landingVisitors,
  totalUsers,
  cardsAdded,
  timeline,
  windows,
}: {
  landingVisitors: number;
  totalUsers: number;
  cardsAdded: number;
  timeline: DailyFunnelPoint[];
  windows: FunnelWindowTotals | null;
}) {
  const { data: history, isPending: historyPending } = useAuthQuery<ActiveUsersHistory>(
    ["activeUsersHistory"],
    () => getActiveUsersHistory(),
    pollOptionsSlower,
  );
  const { data: byUser, isPending: byUserPending } = useAuthQuery<ActiveUsersByUser>(
    ["activeUsersByUser"],
    () => getActiveUsersByUser(),
    pollOptionsSlower,
  );
  const { data: revenue, isPending: revenuePending } = useAuthQuery<FleetRevenue>(
    ["fleetRevenue"],
    () => getFleetRevenue(),
    pollOptionsSlower,
  );
  const { data: board, isPending: boardPending } = useAuthQuery<CustomerSuccessBoard>(
    ["customerSuccess"],
    () => getCustomerSuccess(),
    pollOptionsSlower,
  );

  const funnel = useMemo(() => {
    // `now` is read once so the three windows and the economics beside them are all
    // stated as of the same instant.
    const now = new Date();
    const cardDays = timeline.map((point) => ({ date: point.date, value: point.cardsAdded }));
    const users = byUser?.users ?? null;
    return funnelWindows(now).map((window) => {
      const inception = window.sinceIso === null;
      return {
        window,
        steps: funnelSteps({
          visitors: inception
            ? landingVisitors
            : windows === null
              ? null
              : window.key === "d30"
                ? windows.visitors30d
                : windows.visitors90d,
          signups: inception
            ? totalUsers
            : windows === null
              ? null
              : window.key === "d30"
                ? windows.signups30d
                : windows.signups90d,
          // Safe to sum: each row counts a customer's FIRST saved card, so nobody is
          // in the series twice. Inception reads the billing total rather than this
          // series, which only covers the days PostHog and Stripe both have.
          paidUsers: inception ? cardsAdded : sumSince(cardDays, window.sinceIso),
          activeUsers: users === null ? null : activeOrgsSince(users, window.sinceIso),
        }),
        economics: clientEconomics(economicsRows(board?.customers ?? []), window.sinceIso),
      };
    });
  }, [landingVisitors, totalUsers, cardsAdded, timeline, windows, byUser, board]);

  const funnelSeries = useMemo(() => {
    const monthlyVisitorBuckets = monthlyVisitors(timeline);
    const weeklyVisitorBuckets = weeklyVisitors(timeline);
    const monthlySignupBuckets = monthlySignups(timeline);
    const weeklySignupBuckets = weeklySignups(timeline);
    const monthlyRate = monthlySignupRates(timeline);
    const weeklyRate = weeklySignupRates(timeline);
    const monthlyCardBuckets = monthlyCards(timeline);
    const weeklyCardBuckets = weeklyCards(timeline);
    const monthlyCardRate = monthlyCardRates(timeline);
    const weeklyCardRate = weeklyCardRates(timeline);
    return {
      monthlyVisitors: { points: countPoints(monthlyVisitorBuckets), summary: cmgrSummary(monthlyVisitorBuckets) },
      weeklyVisitors: { points: countPoints(weeklyVisitorBuckets), summary: cmgrSummary(weeklyVisitorBuckets) },
      monthlySignups: { points: countPoints(monthlySignupBuckets), summary: cmgrSummary(monthlySignupBuckets) },
      weeklySignups: { points: countPoints(weeklySignupBuckets), summary: cmgrSummary(weeklySignupBuckets) },
      monthlySignupRate: { points: ratePoints(monthlyRate), summary: rateCmgrSummary(monthlyRate) },
      weeklySignupRate: { points: ratePoints(weeklyRate), summary: rateCmgrSummary(weeklyRate) },
      monthlyCards: { points: countPoints(monthlyCardBuckets), summary: cmgrSummary(monthlyCardBuckets) },
      weeklyCards: { points: countPoints(weeklyCardBuckets), summary: cmgrSummary(weeklyCardBuckets) },
      monthlyCardRate: { points: ratePoints(monthlyCardRate), summary: rateCmgrSummary(monthlyCardRate) },
      weeklyCardRate: { points: ratePoints(weeklyCardRate), summary: rateCmgrSummary(weeklyCardRate) },
    };
  }, [timeline]);

  const active = useMemo(() => {
    const monthly = activePoints(history?.monthly ?? [], "month");
    const weekly = activePoints(history?.weekly ?? [], "week");
    return {
      monthly: { points: monthly, summary: compoundGrowthSummary(monthly.map((p) => p.cmgrPct)) },
      weekly: { points: weekly, summary: compoundGrowthSummary(weekly.map((p) => p.cmgrPct)) },
    };
  }, [history]);

  const money = useMemo(() => {
    if (!revenue) return null;
    const monthly = revenueBuckets(revenue.monthly, "month");
    const weekly = revenueBuckets(revenue.weekly, "week");
    // The MRR halves are disjoint by construction and the producer states their total.
    // A null split is "we could not measure this" — stated below, never charted as 0.
    const split = revenue.mrrSplit ?? null;
    const monthlyMrr = split ? mrrSplitBuckets(split.monthly, "totalMrrUsd", "month") : [];
    const weeklyMrr = split ? mrrSplitBuckets(split.weekly, "totalMrrUsd", "week") : [];
    return {
      splitAvailable: split !== null,
      monthly: { points: toCompoundPoints(monthly), summary: revenueCmgrSummary(monthly) },
      weekly: { points: toCompoundPoints(weekly), summary: revenueCmgrSummary(weekly) },
      monthlyMrr: { points: toCompoundPoints(monthlyMrr), summary: revenueCmgrSummary(monthlyMrr) },
      weeklyMrr: { points: toCompoundPoints(weeklyMrr), summary: revenueCmgrSummary(weeklyMrr) },
    };
  }, [revenue]);

  const inceptionSteps = funnel[0].steps;
  const moneyPending = revenuePending || !money;

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        {inceptionSteps.map((step) => (
          <FunnelStatCard key={step.key} step={step} />
        ))}
      </section>

      <SectionHeading
        title="Where people drop out"
        blurb="The same four stages indexed on unique visitors at 100, over three windows. A stage nobody could measure draws no bar and says so — an empty bar would read as nobody reaching it."
      />
      <section className="grid gap-6 lg:grid-cols-3">
        {funnel.map((entry) => (
          <FunnelIndexChart key={entry.window.key} title={entry.window.label} steps={entry.steps} />
        ))}
      </section>

      <SectionHeading
        title="What a customer is worth"
        blurb="Each window picks the customers active in it; the three figures are the per-customer ones the customer board already states. Nothing here is an average measured over the window itself."
      />
      <section className="grid gap-6 lg:grid-cols-3">
        {funnel.map((entry) => (
          <EconomicsCard
            key={entry.window.key}
            title={entry.window.label}
            economics={entry.economics}
            pending={boardPending}
          />
        ))}
      </section>

      <SectionHeading
        title="Unique visitors"
        blurb="Unique visitors per period with compound growth since inception."
      />
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly unique visitors"
          subtitle="Unique visitors per month with compound monthly growth since inception."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          summary={funnelSeries.monthlyVisitors.summary}
          data={funnelSeries.monthlyVisitors.points}
          valueLabel="Unique visitors"
          growthLabel="CMGR since inception"
        />
        <PeriodCompoundCard
          title="Weekly unique visitors"
          subtitle="Unique visitors per week with compound weekly growth since inception."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          summary={funnelSeries.weeklyVisitors.summary}
          data={funnelSeries.weeklyVisitors.points}
          valueLabel="Unique visitors"
          growthLabel="CWGR since inception"
        />
      </section>

      <SectionHeading title="Signups" blurb="Signups per period, then the share of visitors they convert." />
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly signups"
          subtitle="Signups per month with compound monthly growth since inception."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          summary={funnelSeries.monthlySignups.summary}
          data={funnelSeries.monthlySignups.points}
          valueLabel="Signups"
          growthLabel="CMGR since inception"
        />
        <PeriodCompoundCard
          title="Weekly signups"
          subtitle="Signups per week with compound weekly growth since inception."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          summary={funnelSeries.weeklySignups.summary}
          data={funnelSeries.weeklySignups.points}
          valueLabel="Signups"
          growthLabel="CWGR since inception"
        />
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly signup rate"
          subtitle="Signups divided by unique visitors, per month, with compound monthly growth of that rate."
          cmgrLabel="Rate CMGR"
          cmgrUnit="monthly"
          summary={funnelSeries.monthlySignupRate.summary}
          data={funnelSeries.monthlySignupRate.points}
          valueLabel="conversion"
          growthLabel="Rate CMGR since inception"
          formatValue={ratePct}
        />
        <PeriodCompoundCard
          title="Weekly signup rate"
          subtitle="Signups divided by unique visitors, per week, with compound weekly growth of that rate."
          cmgrLabel="Rate CWGR"
          cmgrUnit="weekly"
          summary={funnelSeries.weeklySignupRate.summary}
          data={funnelSeries.weeklySignupRate.points}
          valueLabel="conversion"
          growthLabel="Rate CWGR since inception"
          formatValue={ratePct}
        />
      </section>

      <SectionHeading title="Paid users" blurb="Paid users per period, then the share of signups they convert." />
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly paid users"
          subtitle="Paid users per month with compound monthly growth since inception."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          summary={funnelSeries.monthlyCards.summary}
          data={funnelSeries.monthlyCards.points}
          valueLabel="Paid users"
          growthLabel="CMGR since inception"
        />
        <PeriodCompoundCard
          title="Weekly paid users"
          subtitle="Paid users per week with compound weekly growth since inception."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          summary={funnelSeries.weeklyCards.summary}
          data={funnelSeries.weeklyCards.points}
          valueLabel="Paid users"
          growthLabel="CWGR since inception"
        />
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly paid user rate"
          subtitle="Paid users divided by signups, per month, with compound monthly growth of that rate."
          cmgrLabel="Rate CMGR"
          cmgrUnit="monthly"
          summary={funnelSeries.monthlyCardRate.summary}
          data={funnelSeries.monthlyCardRate.points}
          valueLabel="conversion"
          growthLabel="Rate CMGR since inception"
          formatValue={ratePct}
        />
        <PeriodCompoundCard
          title="Weekly paid user rate"
          subtitle="Paid users divided by signups, per week, with compound weekly growth of that rate."
          cmgrLabel="Rate CWGR"
          cmgrUnit="weekly"
          summary={funnelSeries.weeklyCardRate.summary}
          data={funnelSeries.weeklyCardRate.points}
          valueLabel="conversion"
          growthLabel="Rate CWGR since inception"
          formatValue={ratePct}
        />
      </section>

      <SectionHeading
        title="Active users"
        blurb="Orgs running an active, funded brand in the period."
      />
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly active users"
          subtitle="Active users per month with compound monthly growth since inception."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          summary={historyPending ? EMPTY_SUMMARY : active.monthly.summary}
          data={active.monthly.points}
          valueLabel="active users"
          growthLabel="CMGR since inception"
          pending={historyPending}
        />
        <PeriodCompoundCard
          title="Weekly active users"
          subtitle="Active users per week with compound weekly growth since inception."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          summary={historyPending ? EMPTY_SUMMARY : active.weekly.summary}
          data={active.weekly.points}
          valueLabel="active users"
          growthLabel="CWGR since inception"
          pending={historyPending}
        />
      </section>

      <SectionHeading
        title="Revenue"
        blurb="Cold-email spend the fleet consumed, net of usage discounts. Not collected cash — the Revenue tab states both, apart."
      />
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly revenue"
          subtitle="Realized revenue per month with compound monthly growth since inception."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          summary={money?.monthly.summary ?? EMPTY_SUMMARY}
          data={money?.monthly.points ?? []}
          valueLabel="revenue"
          growthLabel="CMGR since inception"
          formatValue={usdFull}
          formatAxis={usdCompact}
          pending={moneyPending}
        />
        <PeriodCompoundCard
          title="Weekly revenue"
          subtitle="Realized revenue per week with compound weekly growth since inception."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          summary={money?.weekly.summary ?? EMPTY_SUMMARY}
          data={money?.weekly.points ?? []}
          valueLabel="revenue"
          growthLabel="CWGR since inception"
          formatValue={usdFull}
          formatAxis={usdCompact}
          pending={moneyPending}
        />
      </section>

      <SectionHeading
        title="MRR"
        blurb="Self-serve plus agency, the two halves the Revenue tab states separately."
      />
      {money && !money.splitAvailable ? (
        <section className="rounded-lg border border-amber-200 bg-white p-4">
          <p className="text-sm text-amber-700">
            The run-rate could not be split into its self-serve and agency halves, so there is no
            total to chart. The Revenue tab names the reason.
          </p>
        </section>
      ) : (
        <section className="grid gap-6 md:grid-cols-2">
          <PeriodCompoundCard
            title="Monthly MRR"
            subtitle="Self-serve plus agency, per month, with compound monthly growth."
            cmgrLabel="CMGR"
            cmgrUnit="monthly"
            summary={money?.monthlyMrr.summary ?? EMPTY_SUMMARY}
            data={money?.monthlyMrr.points ?? []}
            valueLabel="MRR"
            growthLabel="CMGR since the first recorded day"
            formatValue={usdFull}
            formatAxis={usdCompact}
            pending={moneyPending}
          />
          <PeriodCompoundCard
            title="Weekly MRR"
            subtitle="Self-serve plus agency, per week, with compound weekly growth."
            cmgrLabel="CWGR"
            cmgrUnit="weekly"
            summary={money?.weeklyMrr.summary ?? EMPTY_SUMMARY}
            data={money?.weeklyMrr.points ?? []}
            valueLabel="MRR"
            growthLabel="CWGR since the first recorded day"
            formatValue={usdFull}
            formatAxis={usdCompact}
            pending={moneyPending}
          />
        </section>
      )}
    </>
  );
}
