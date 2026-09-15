"use client";

import { PeriodCompoundCard } from "@/components/period-compound-card";
import { StatCard } from "@/components/stat-card";
import { formatCount } from "@/lib/format-number";
import { pct, formatRatePct } from "@/lib/funnel-rate-format";
import type { DailyFunnelPoint } from "@/lib/public-stats";
import {
  cmgrSummary,
  monthlySignupRates,
  monthlySignups,
  rateCmgrSummary,
  weeklySignupRates,
  weeklySignups,
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
export function SignupView({
  totalUsers,
  totalVisitors,
  signupEvents,
  timeline,
}: {
  totalUsers: number;
  totalVisitors: number;
  signupEvents: number;
  timeline: DailyFunnelPoint[];
}) {
  const monthly = monthlySignups(timeline);
  const weekly = weeklySignups(timeline);
  const monthlyPoints = monthly.map((b) => ({ label: b.label, value: b.signups, cmgrPct: b.cmgrPct }));
  const weeklyPoints = weekly.map((b) => ({ label: b.label, value: b.signups, cmgrPct: b.cmgrPct }));
  const monthlyCmgr = cmgrSummary(monthly);
  const weeklyCmgr = cmgrSummary(weekly);
  const monthlyRate = monthlySignupRates(timeline);
  const weeklyRate = weeklySignupRates(timeline);
  const monthlyRatePoints = monthlyRate.map((b) => ({ label: b.label, value: b.ratePct, cmgrPct: b.cmgrPct }));
  const weeklyRatePoints = weeklyRate.map((b) => ({ label: b.label, value: b.ratePct, cmgrPct: b.cmgrPct }));
  const monthlyRateCmgr = rateCmgrSummary(monthlyRate);
  const weeklyRateCmgr = rateCmgrSummary(weeklyRate);
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total signups" value={formatCount(totalUsers)} detail="Clerk /users/count total" accent="bg-brand-500" />
        <StatCard label="Tracked signup events" value={formatCount(signupEvents)} detail="PostHog signup_completed events" accent="bg-sky-500" />
        <StatCard label="Signup conversion" value={pct(totalUsers, totalVisitors)} detail="Total users divided by unique visitors" accent="bg-emerald-500" />
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly signups"
          subtitle="Signups per month with compound monthly growth since inception."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          summary={monthlyCmgr}
          data={monthlyPoints}
          valueLabel="Signups"
          growthLabel="CMGR since inception"
        />
        <PeriodCompoundCard
          title="Weekly signups"
          subtitle="Signups per week with compound weekly growth since inception."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          summary={weeklyCmgr}
          data={weeklyPoints}
          valueLabel="Signups"
          growthLabel="CWGR since inception"
        />
      </section>
      {/*
        Rate charts, in the same shape as the count charts above: bars are the
        period's conversion rate, the line is the compound growth OF that rate.
        The growth label says "Rate CMGR" rather than "CMGR" because the row
        above already states a CMGR over signup COUNTS, and one acronym over two
        bases on one screen is a surface contradicting itself.
        A period with no tracked visitors is dropped rather than drawn at 0%, so
        these two legitimately start later than the two above them.
      */}
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly signup rate"
          subtitle="Signups divided by unique visitors, per month, with compound monthly growth of that rate."
          cmgrLabel="Rate CMGR"
          cmgrUnit="monthly"
          summary={monthlyRateCmgr}
          data={monthlyRatePoints}
          valueLabel="conversion"
          growthLabel="Rate CMGR since inception"
          formatValue={formatRatePct}
        />
        <PeriodCompoundCard
          title="Weekly signup rate"
          subtitle="Signups divided by unique visitors, per week, with compound weekly growth of that rate."
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
