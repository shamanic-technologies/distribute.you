import { cache } from "react";
import {
  fetchInvestorMetrics,
  type InvestorMetrics,
} from "@/lib/investors/fetch-metrics";
import { formatCents, formatNumber, computeCAGR } from "@/lib/investors/format";
import { BarChart, CGRLineChart } from "@/components/investors/charts";

// Last-resort zero metrics. The sections render SSR-sync (no <Suspense>), so a
// throw from fetchInvestorMetrics would abort the whole Vercel prerender
// (CLAUDE.md "Exception — Vercel build-time prerender"). Fail soft to zeros so
// the page always ships; a healthy build still renders the real numbers.
const EMPTY_INVESTOR_METRICS: InvestorMetrics = {
  updatedAt: new Date().toISOString(),
  users: { total: 0, orgs: 0 },
  billing: {
    totalAccounts: 0,
    accountsWithPaymentMethod: 0,
    totalCreditedCents: "0",
    totalRevenueCents: "0",
  },
  runs: { completed: 0, failed: 0, running: 0, totalCostInUsdCents: "0" },
  monthlyGrowth: [],
  weeklyGrowth: [],
};

const getMetrics = cache(async (): Promise<InvestorMetrics> => {
  try {
    return await fetchInvestorMetrics("");
  } catch (err) {
    console.error(
      "[landing] investor metrics unavailable, rendering zeros",
      err,
    );
    return EMPTY_INVESTOR_METRICS;
  }
});

async function loadMetrics() {
  return getMetrics();
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[var(--dy-surface)] border border-[var(--dy-border)] rounded-xl p-6">
      <p className="text-sm text-[var(--dy-sub)] mb-1">{label}</p>
      <p className="text-2xl font-display font-bold text-[var(--dy-text)]">{value}</p>
      {sub && <p className="text-xs text-[var(--dy-muted)] mt-1">{sub}</p>}
    </div>
  );
}


export async function CompanyOverviewSection() {
  const metrics = await loadMetrics();
  const totalRuns =
    metrics.runs.completed + metrics.runs.failed + metrics.runs.running;
  return (
    <div className="bg-[var(--dy-surface)] border border-[var(--dy-border)] rounded-xl p-6 text-[var(--dy-sub)] space-y-4 text-sm leading-relaxed">
      <p>
        <strong className="text-[var(--dy-text)]">distribute</strong> is a pay-as-you-go
        cloud platform for AI cold email outreach. Builders provide a URL and a
        daily budget; AI workflows handle prospecting, email generation, sending,
        reply qualification, and reporting — ranked by real cost-per-positive-reply.
      </p>
      <p>
        The business model is{" "}
        <strong className="text-[var(--dy-text)]">credit-based</strong> with no
        subscriptions. Users top up their account balance and pay per workflow
        execution. Revenue scales linearly with usage.
      </p>
      <p>
        The platform runs{" "}
        <strong className="text-[var(--dy-text)]">
          {formatNumber(totalRuns)}+ workflow executions
        </strong>{" "}
        to date across{" "}
        <strong className="text-[var(--dy-text)]">{metrics.users.orgs}</strong>{" "}
        organizations and{" "}
        <strong className="text-[var(--dy-text)]">{metrics.users.total}</strong>{" "}
        users.
      </p>
    </div>
  );
}

export async function PlatformMetricsSection() {
  const metrics = await loadMetrics();
  const totalRuns =
    metrics.runs.completed + metrics.runs.failed + metrics.runs.running;
  const successRate =
    totalRuns > 0
      ? ((metrics.runs.completed / totalRuns) * 100).toFixed(1)
      : "0";
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Organizations"
        value={formatNumber(metrics.users.orgs)}
        sub={`${metrics.users.total} individual users`}
      />
      <StatCard
        label="Billing Accounts"
        value={formatNumber(metrics.billing.totalAccounts)}
        sub={`${metrics.billing.accountsWithPaymentMethod} with saved payment method`}
      />
      <StatCard
        label="Completed Runs"
        value={formatNumber(metrics.runs.completed)}
        sub={`${successRate}% success rate`}
      />
      <StatCard
        label="Total Runs"
        value={formatNumber(totalRuns)}
        sub="All-time executions"
      />
    </div>
  );
}

export async function RevenueCreditsSection() {
  const metrics = await loadMetrics();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <StatCard
        label="Total Consumed"
        value={formatCents(metrics.runs.totalCostInUsdCents)}
        sub="Cumulative platform run costs (runs-service)"
      />
      <StatCard
        label="Revenue"
        value={formatCents(metrics.billing.totalRevenueCents)}
        sub="Cumulative net Stripe revenue"
      />
    </div>
  );
}

function findCgrAnchorRows<T>(
  ascRows: T[],
  getValue: (r: T) => string,
  minPoints: number
): T[] | null {
  const firstIdx = ascRows.findIndex((r) => parseFloat(getValue(r)) > 0);
  if (firstIdx === -1) return null;
  const sliced = ascRows.slice(firstIdx);
  if (sliced.length < minPoints) return null;
  return sliced;
}

function GrowthCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | null;
  sub?: string;
}) {
  const numeric = value === null ? null : Number(value);
  const colorClass =
    numeric === null
      ? "text-[var(--dy-muted)]"
      : numeric >= 0
        ? "text-emerald-400"
        : "text-red-400";
  const display =
    numeric === null
      ? "n/a"
      : `${numeric >= 0 ? "+" : ""}${value}%`;
  return (
    <div className="bg-[var(--dy-surface)] border border-[var(--dy-border)] rounded-xl p-6">
      <p className="text-sm text-[var(--dy-sub)] mb-1">{label}</p>
      <p className={`text-2xl font-display font-bold ${colorClass}`}>{display}</p>
      {sub && <p className="text-xs text-[var(--dy-muted)] mt-1">{sub}</p>}
    </div>
  );
}

export async function MonthlyGrowthSection() {
  const metrics = await loadMetrics();
  const monthlyCreditsCAGR = computeCAGR(
    metrics.monthlyGrowth.map((r) => r.consumedCents)
  );
  const monthlyRevenueCAGR = computeCAGR(
    metrics.monthlyGrowth.map((r) => r.revenueCents)
  );

  // Per-metric CGR line anchors: each chart starts at the first month with a
  // non-zero value for THAT specific metric. Render only if >=2 data points
  // exist past the anchor (1 anchor + 1+ compounded growth points).
  const monthlyAsc = [...metrics.monthlyGrowth].reverse();
  const monthlyCreditsCgrRows = findCgrAnchorRows(
    monthlyAsc,
    (r) => r.consumedCents,
    2
  );
  const monthlyRevenueCgrRows = findCgrAnchorRows(
    monthlyAsc,
    (r) => r.revenueCents,
    2
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GrowthCard label="Monthly credits spent growth" value={monthlyCreditsCAGR} />
        <GrowthCard label="Monthly revenue growth" value={monthlyRevenueCAGR} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--dy-border-hi)] text-[var(--dy-sub)]">
                <th className="text-left py-3 px-4 font-medium">Month</th>
                <th className="text-right py-3 px-4 font-medium">Completed Runs</th>
                <th className="text-right py-3 px-4 font-medium">Credits Spent</th>
                <th className="text-right py-3 px-4 font-medium">Revenue</th>
                <th className="text-right py-3 px-4 font-medium">Credits Spent Growth</th>
              </tr>
            </thead>
            <tbody>
              {metrics.monthlyGrowth.map((row, i) => {
                const prev = metrics.monthlyGrowth[i + 1];
                const rowConsumed = parseFloat(row.consumedCents);
                const prevConsumed = prev ? parseFloat(prev.consumedCents) : 0;
                const growth =
                  prev && prevConsumed > 0
                    ? (
                        ((rowConsumed - prevConsumed) / prevConsumed) *
                        100
                      ).toFixed(0)
                    : null;
                return (
                  <tr
                    key={row.month}
                    className="border-b border-[var(--dy-border)] text-[var(--dy-sub)]"
                  >
                    <td className="py-3 px-4 font-medium text-[var(--dy-text)]">{row.month}</td>
                    <td className="py-3 px-4 text-right">{formatNumber(row.completedRuns)}</td>
                    <td className="py-3 px-4 text-right">{formatCents(row.consumedCents)}</td>
                    <td className="py-3 px-4 text-right">{formatCents(row.revenueCents)}</td>
                    <td className="py-3 px-4 text-right">
                      {growth ? (
                        <span className={Number(growth) >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {Number(growth) >= 0 ? "+" : ""}{growth}%
                        </span>
                      ) : (
                        <span className="text-[var(--dy-muted)]">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <BarChart
            title="Credits Spent"
            data={[...metrics.monthlyGrowth]
              .reverse()
              .map((row) => ({ label: row.month, value: row.consumedCents }))}
          />
          <BarChart
            title="Revenue"
            data={[...metrics.monthlyGrowth]
              .reverse()
              .map((row) => ({ label: row.month, value: row.revenueCents }))}
          />
          {monthlyCreditsCgrRows && (
            <CGRLineChart
              title="Compound monthly growth — Credits Spent"
              data={monthlyCreditsCgrRows.map((row) => ({
                label: row.month,
                value: row.consumedCents,
              }))}
            />
          )}
          {monthlyRevenueCgrRows && (
            <CGRLineChart
              title="Compound monthly growth — Revenue"
              data={monthlyRevenueCgrRows.map((row) => ({
                label: row.month,
                value: row.revenueCents,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// CAGR baseline for weekly cards. Pre-March 2026 weeks had sub-dollar spend
// (mostly noise from grant credits), which distorts the geometric mean badly
// (e.g. $0.99 → $250 = +25000%). Anchor the series at the first full Monday
// of March 2026 so the growth rate reflects real revenue traction.
const WEEKLY_CAGR_START = "2026-03-02";

// Weekly CGR line charts compute the compound growth rate against the first
// non-zero week in WEEKLY_CAGR_START (per metric), but only render points from
// WEEKLY_CGR_LINE_DISPLAY_START onward. The early-March weeks pin the Y axis
// to >+10000% from near-zero baselines and make April-onward trajectory
// unreadable; restricting only the visible range (not the computation anchor)
// preserves the "compound from the very first dollar" semantics while keeping
// the chart legible.
const WEEKLY_CGR_LINE_DISPLAY_START = "2026-04-13";

export async function WeeklyGrowthSection() {
  const metrics = await loadMetrics();
  const cagrRows = metrics.weeklyGrowth.filter(
    (r) => r.period >= WEEKLY_CAGR_START
  );
  const weeklyCreditsCAGR = computeCAGR(cagrRows.map((r) => r.consumedCents));
  const weeklyRevenueCAGR = computeCAGR(cagrRows.map((r) => r.revenueCents));

  // Per-metric CGR computation anchor: each chart computes compound growth
  // against the first non-zero week for THAT specific metric within the
  // WEEKLY_CAGR_START window. The rendered range is then clipped to
  // WEEKLY_CGR_LINE_DISPLAY_START inside the chart itself.
  const cagrRowsAsc = [...cagrRows].reverse();
  const weeklyCreditsCgrRows = findCgrAnchorRows(
    cagrRowsAsc,
    (r) => r.consumedCents,
    3
  );
  const weeklyRevenueCgrRows = findCgrAnchorRows(
    cagrRowsAsc,
    (r) => r.revenueCents,
    3
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GrowthCard
          label="Weekly credits spent growth"
          value={weeklyCreditsCAGR}
          sub="Since March"
        />
        <GrowthCard
          label="Weekly revenue growth"
          value={weeklyRevenueCAGR}
          sub="Since March"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--dy-border-hi)] text-[var(--dy-sub)]">
                <th className="text-left py-3 px-4 font-medium">Week</th>
                <th className="text-right py-3 px-4 font-medium">Credits Spent</th>
                <th className="text-right py-3 px-4 font-medium">Revenue</th>
                <th className="text-right py-3 px-4 font-medium">Credits Spent Growth</th>
              </tr>
            </thead>
            <tbody>
              {metrics.weeklyGrowth.map((row, i) => {
                const prev = metrics.weeklyGrowth[i + 1];
                const rowConsumed = parseFloat(row.consumedCents);
                const prevConsumed = prev ? parseFloat(prev.consumedCents) : 0;
                const growth =
                  prev && prevConsumed > 0
                    ? (
                        ((rowConsumed - prevConsumed) / prevConsumed) *
                        100
                      ).toFixed(0)
                    : null;
                return (
                  <tr
                    key={row.period}
                    className="border-b border-[var(--dy-border)] text-[var(--dy-sub)]"
                  >
                    <td className="py-3 px-4 font-medium text-[var(--dy-text)]">{row.period}</td>
                    <td className="py-3 px-4 text-right">{formatCents(row.consumedCents)}</td>
                    <td className="py-3 px-4 text-right">{formatCents(row.revenueCents)}</td>
                    <td className="py-3 px-4 text-right">
                      {growth ? (
                        <span className={Number(growth) >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {Number(growth) >= 0 ? "+" : ""}{growth}%
                        </span>
                      ) : (
                        <span className="text-[var(--dy-muted)]">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-4">
          <BarChart
            rotateLabels
            title="Credits Spent"
            data={[...cagrRows]
              .reverse()
              .map((row) => ({ label: row.period, value: row.consumedCents }))}
          />
          <BarChart
            rotateLabels
            title="Revenue"
            data={[...cagrRows]
              .reverse()
              .map((row) => ({ label: row.period, value: row.revenueCents }))}
          />
          {weeklyCreditsCgrRows && (
            <CGRLineChart
              rotateLabels
              displayStart={WEEKLY_CGR_LINE_DISPLAY_START}
              title="Compound weekly growth — Credits Spent"
              data={weeklyCreditsCgrRows.map((row) => ({
                label: row.period,
                value: row.consumedCents,
              }))}
            />
          )}
          {weeklyRevenueCgrRows && (
            <CGRLineChart
              rotateLabels
              displayStart={WEEKLY_CGR_LINE_DISPLAY_START}
              title="Compound weekly growth — Revenue"
              data={weeklyRevenueCgrRows.map((row) => ({
                label: row.period,
                value: row.revenueCents,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
