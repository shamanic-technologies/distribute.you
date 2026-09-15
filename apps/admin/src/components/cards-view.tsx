"use client";

import { PeriodCompoundCard } from "@/components/period-compound-card";
import { StatCard } from "@/components/stat-card";
import { formatCount } from "@/lib/format-number";
import { pct, formatRatePct } from "@/lib/funnel-rate-format";
import type { BillingStats, DailyFunnelPoint } from "@/lib/public-stats";
import {
  cmgrSummary,
  monthlyPaidRates,
  monthlyPayers,
  payerPeriods,
  rateCmgrSummary,
  weeklyPaidRates,
  weeklyPayers,
} from "@/lib/signup-buckets";

/**
 * WHY THIS IS A CLIENT COMPONENT, and it is not a style preference.
 *
 * The card below takes `formatValue` — a FUNCTION — and a function cannot cross
 * the server/client boundary: React throws "Functions cannot be passed directly
 * to Client Components". This view lived inline in the server `metrics/page.tsx`
 * and passed one, so the tab rendered an error digest and nothing else from
 * 2026-09-12 until it moved here. Its three siblings (Overview, Revenue, Active
 * users) were already client components for the same reason, which is why they
 * never broke.
 *
 * The props it receives are all serializable (numbers and plain rows), so the
 * page still fetches everything server-side and nothing extra crosses the wire.
 */
export function CardsView({
  billing,
  totalUsers,
  timeline,
}: {
  billing: BillingStats;
  totalUsers: number;
  timeline: DailyFunnelPoint[];
}) {
  const monthlyPeriods = payerPeriods(billing.monthly_growth);
  const weeklyPeriods = payerPeriods(billing.weekly_growth);
  const monthly = monthlyPayers(timeline, monthlyPeriods);
  const weekly = weeklyPayers(timeline, weeklyPeriods);
  const monthlyPoints = monthly.map((b) => ({ label: b.label, value: b.signups, cmgrPct: b.cmgrPct }));
  const weeklyPoints = weekly.map((b) => ({ label: b.label, value: b.signups, cmgrPct: b.cmgrPct }));
  const monthlyCmgr = cmgrSummary(monthly);
  const weeklyCmgr = cmgrSummary(weekly);
  const monthlyRate = monthlyPaidRates(timeline, monthlyPeriods);
  const weeklyRate = weeklyPaidRates(timeline, weeklyPeriods);
  const monthlyRatePoints = monthlyRate.map((b) => ({ label: b.label, value: b.ratePct, cmgrPct: b.cmgrPct }));
  const weeklyRatePoints = weeklyRate.map((b) => ({ label: b.label, value: b.ratePct, cmgrPct: b.cmgrPct }));
  const monthlyRateCmgr = rateCmgrSummary(monthlyRate);
  const weeklyRateCmgr = rateCmgrSummary(weeklyRate);
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total paid users" value={formatCount(billing.total_paying_accounts)} detail="Distinct accounts that have paid, every acquirer" accent="bg-emerald-500" />
        <StatCard label="Signup to paid conversion" value={pct(billing.total_paying_accounts, totalUsers)} detail="Paid users divided by total signups" accent="bg-brand-500" />
        {/*
          Stated beside the paying count on purpose, rather than left to contradict
          it from another surface: these are two populations and neither contains
          the other (33 paid, 31 carry a card, in production). The card figure is
          the producer's own Stripe-only one and says so.
        */}
        <StatCard label="Accounts with a saved card" value={formatCount(billing.accounts_with_payment_method)} detail="Stripe-only saved payment methods, not a payment" accent="bg-sky-500" />
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly new paid users"
          subtitle="Accounts paying us for the first time each month, with compound monthly growth since inception."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          summary={monthlyCmgr}
          data={monthlyPoints}
          valueLabel="New paid users"
          growthLabel="CMGR since inception"
        />
        <PeriodCompoundCard
          title="Weekly new paid users"
          subtitle="Accounts paying us for the first time each week, with compound weekly growth since inception."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          summary={weeklyCmgr}
          data={weeklyPoints}
          valueLabel="New paid users"
          growthLabel="CWGR since inception"
        />
      </section>
      {/*
        The paid-user RATE, in the same shape as the signup rate one stage up: bars are
        the period's conversion of signups into paid users, the line is the compound
        growth OF that rate. The Overview states this pair too, from the same buckets —
        a chart the Overview drew and this tab did not would be two pages disagreeing
        about what exists.
        A period with no signups is dropped rather than charted at 0%: there was nobody
        to convert, which is a different statement from nobody converting.
      */}
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly paid user rate"
          subtitle="Paid users divided by signups, per month, with compound monthly growth of that rate."
          cmgrLabel="Rate CMGR"
          cmgrUnit="monthly"
          summary={monthlyRateCmgr}
          data={monthlyRatePoints}
          valueLabel="conversion"
          growthLabel="Rate CMGR since inception"
          formatValue={formatRatePct}
        />
        <PeriodCompoundCard
          title="Weekly paid user rate"
          subtitle="Paid users divided by signups, per week, with compound weekly growth of that rate."
          cmgrLabel="Rate CWGR"
          cmgrUnit="weekly"
          summary={weeklyRateCmgr}
          data={weeklyRatePoints}
          valueLabel="conversion"
          growthLabel="Rate CWGR since inception"
          formatValue={formatRatePct}
        />
      </section>
    </>
  );
}
