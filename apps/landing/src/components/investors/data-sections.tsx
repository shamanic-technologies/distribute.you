import { cache } from "react";
import { headers } from "next/headers";
import { fetchInvestorMetrics } from "@/lib/investors/fetch-metrics";
import { formatCents, formatNumber, computeCAGR } from "@/lib/investors/format";

const getMetrics = cache((host: string) => fetchInvestorMetrics(host));

async function loadMetrics() {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  return getMetrics(host);
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
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-display font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function shortenLabel(label: string): string {
  const parts = label.split("-");
  if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
  if (parts.length === 2) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const idx = parseInt(parts[1], 10) - 1;
    return monthNames[idx] ?? parts[1];
  }
  return label;
}

function BarChart({
  data,
  rotateLabels,
  title,
}: {
  data: { label: string; value: string }[];
  rotateLabels?: boolean;
  title: string;
}) {
  const numericValues = data.map((d) => parseFloat(d.value));
  const max = Math.max(...numericValues, 1);
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 overflow-hidden">
      <p className="text-sm text-gray-400 mb-4 font-medium">{title}</p>
      <div className="flex items-end gap-1 h-48">
        {data.map((d, i) => {
          const pct = (numericValues[i] / max) * 100;
          return (
            <div key={d.label} className="flex-1 min-w-0 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400 truncate w-full text-center">
                {formatCents(d.value)}
              </span>
              <div className="w-full flex items-end" style={{ height: "140px" }}>
                <div
                  className="w-full bg-emerald-500/80 rounded-t"
                  style={{ height: `${Math.max(pct, 2)}%` }}
                />
              </div>
              {rotateLabels ? (
                <span
                  className="text-[10px] text-gray-500 whitespace-nowrap origin-top-left"
                  style={{ writingMode: "vertical-rl", height: "50px" }}
                >
                  {shortenLabel(d.label)}
                </span>
              ) : (
                <span className="text-[10px] text-gray-500 truncate w-full text-center">
                  {shortenLabel(d.label)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export async function CompanyOverviewSection() {
  const metrics = await loadMetrics();
  const totalRuns =
    metrics.runs.completed + metrics.runs.failed + metrics.runs.running;
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-gray-300 space-y-4 text-sm leading-relaxed">
      <p>
        <strong className="text-white">distribute</strong> is the Stripe of
        Distribution. Users provide a URL and a budget — the platform automates
        lead finding, outreach, email generation, and reporting using AI
        workflows ranked by real performance data.
      </p>
      <p>
        The business model is{" "}
        <strong className="text-white">credit-based</strong> with no
        subscriptions. Users top up their account balance and pay per workflow
        execution. Revenue scales linearly with usage.
      </p>
      <p>
        The platform runs{" "}
        <strong className="text-white">
          {formatNumber(totalRuns)}+ workflow executions
        </strong>{" "}
        to date across{" "}
        <strong className="text-white">{metrics.users.orgs}</strong>{" "}
        organizations and{" "}
        <strong className="text-white">{metrics.users.total}</strong>{" "}
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
      ? "text-gray-500"
      : numeric >= 0
        ? "text-emerald-400"
        : "text-red-400";
  const display =
    numeric === null
      ? "n/a"
      : `${numeric >= 0 ? "+" : ""}${value}%`;
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-display font-bold ${colorClass}`}>{display}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
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
              <tr className="border-b border-gray-700 text-gray-400">
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
                    className="border-b border-gray-800 text-gray-300"
                  >
                    <td className="py-3 px-4 font-medium text-white">{row.month}</td>
                    <td className="py-3 px-4 text-right">{formatNumber(row.completedRuns)}</td>
                    <td className="py-3 px-4 text-right">{formatCents(row.consumedCents)}</td>
                    <td className="py-3 px-4 text-right">{formatCents(row.revenueCents)}</td>
                    <td className="py-3 px-4 text-right">
                      {growth ? (
                        <span className={Number(growth) >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {Number(growth) >= 0 ? "+" : ""}{growth}%
                        </span>
                      ) : (
                        <span className="text-gray-600">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-6">
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

export async function WeeklyGrowthSection() {
  const metrics = await loadMetrics();
  const cagrRows = metrics.weeklyGrowth.filter(
    (r) => r.period >= WEEKLY_CAGR_START
  );
  const weeklyCreditsCAGR = computeCAGR(cagrRows.map((r) => r.consumedCents));
  const weeklyRevenueCAGR = computeCAGR(cagrRows.map((r) => r.revenueCents));
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
              <tr className="border-b border-gray-700 text-gray-400">
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
                    className="border-b border-gray-800 text-gray-300"
                  >
                    <td className="py-3 px-4 font-medium text-white">{row.period}</td>
                    <td className="py-3 px-4 text-right">{formatCents(row.consumedCents)}</td>
                    <td className="py-3 px-4 text-right">{formatCents(row.revenueCents)}</td>
                    <td className="py-3 px-4 text-right">
                      {growth ? (
                        <span className={Number(growth) >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {Number(growth) >= 0 ? "+" : ""}{growth}%
                        </span>
                      ) : (
                        <span className="text-gray-600">--</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-6">
          <BarChart
            rotateLabels
            title="Credits Spent"
            data={[...metrics.weeklyGrowth]
              .reverse()
              .map((row) => ({ label: row.period, value: row.consumedCents }))}
          />
          <BarChart
            rotateLabels
            title="Revenue"
            data={[...metrics.weeklyGrowth]
              .reverse()
              .map((row) => ({ label: row.period, value: row.revenueCents }))}
          />
        </div>
      </div>
    </div>
  );
}
