import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { Navbar } from "@/components/navbar";
import { fetchInvestorMetrics } from "@/lib/investors/fetch-metrics";

export const metadata: Metadata = {
  title: "Investor Information",
  description:
    "Live platform metrics and company information for distribute investors.",
  robots: { index: false, follow: false },
};

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function computeAvgGrowth(values: number[]): string | null {
  const pairs: { prev: number; curr: number }[] = [];
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i + 1] > 0) {
      pairs.push({ prev: values[i + 1], curr: values[i] });
    }
  }
  if (pairs.length === 0) return null;
  const avg =
    pairs.reduce((sum, p) => sum + ((p.curr - p.prev) / p.prev) * 100, 0) /
    pairs.length;
  return avg.toFixed(0);
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
}: {
  data: { label: string; value: number }[];
  rotateLabels?: boolean;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 overflow-hidden">
      <p className="text-sm text-gray-400 mb-4 font-medium">Credits Spent</p>
      <div className="flex items-end gap-1 h-48">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
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

export default async function InvestorsPage() {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  const metrics = await fetchInvestorMetrics(host);

  const totalRuns =
    metrics.runs.completed + metrics.runs.failed + metrics.runs.running;
  const successRate =
    totalRuns > 0
      ? ((metrics.runs.completed / totalRuns) * 100).toFixed(1)
      : "0";

  const monthlyAvgGrowth = computeAvgGrowth(
    metrics.monthlyGrowth.map((r) => r.consumedCents)
  );
  const weeklyAvgGrowth = computeAvgGrowth(
    metrics.weeklyGrowth.map((r) => r.consumed_cents)
  );

  return (
    <>
      <Navbar host={host} />
      <main className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <section className="pt-24 pb-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Image
                src="/logo-head.jpg"
                alt="distribute"
                width={40}
                height={40}
                className="rounded-xl"
              />
              <h1 className="font-display text-4xl font-bold">distribute</h1>
            </div>
            <p className="text-xl text-gray-400 mb-2">
              Investor Information
            </p>
            <p className="text-sm text-gray-600">
              Live data — updated on every page load
            </p>
          </div>
        </section>

        {/* Company Overview */}
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Company Overview
            </h2>
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-gray-300 space-y-4 text-sm leading-relaxed">
              <p>
                <strong className="text-white">distribute</strong> is the Stripe
                of Distribution. Users provide a URL and a budget — the
                platform automates lead finding, outreach, email generation, and
                reporting using AI workflows ranked by real performance data.
              </p>
              <p>
                The business model is{" "}
                <strong className="text-white">credit-based</strong> with no
                subscriptions. Users top up their account balance and pay per
                workflow execution. Revenue scales linearly with usage.
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
          </div>
        </section>

        {/* Platform Metrics */}
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Platform Metrics
            </h2>
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
          </div>
        </section>

        {/* Revenue & Credits */}
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Revenue & Credits
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                label="Total Credits Loaded"
                value={formatCents(metrics.billing.totalCreditedCents)}
                sub="Cumulative top-ups"
              />
              <StatCard
                label="Credits Consumed"
                value={formatCents(metrics.billing.totalConsumedCents)}
                sub="Total platform spend"
              />
              <StatCard
                label="Outstanding Balance"
                value={formatCents(metrics.billing.totalCreditBalanceCents)}
                sub="Across all accounts"
              />
            </div>
          </div>
        </section>

        {/* Monthly Growth */}
        <section className="pb-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="font-display text-2xl font-bold text-gray-200">
                Monthly Growth
              </h2>
              {monthlyAvgGrowth && (
                <p className="text-sm text-gray-400">
                  Avg. monthly spending growth:{" "}
                  <span className={Number(monthlyAvgGrowth) >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                    {Number(monthlyAvgGrowth) >= 0 ? "+" : ""}{monthlyAvgGrowth}%
                  </span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="text-left py-3 px-4 font-medium">Month</th>
                      <th className="text-right py-3 px-4 font-medium">
                        New Orgs
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        New Users
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        Completed Runs
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        Credits Spent
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        Revenue
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        Spending Growth
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.monthlyGrowth.map((row, i) => {
                      const prev = metrics.monthlyGrowth[i + 1];
                      const growth =
                        prev && prev.consumedCents > 0
                          ? (
                              ((row.consumedCents - prev.consumedCents) /
                                prev.consumedCents) *
                              100
                            ).toFixed(0)
                          : null;
                      return (
                        <tr
                          key={row.month}
                          className="border-b border-gray-800 text-gray-300"
                        >
                          <td className="py-3 px-4 font-medium text-white">
                            {row.month}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatNumber(row.newOrgs)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatNumber(row.newUsers)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatNumber(row.completedRuns)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCents(row.consumedCents)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCents(row.revenueCents)}
                          </td>
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
              <BarChart
                data={[...metrics.monthlyGrowth]
                  .reverse()
                  .map((row) => ({ label: row.month, value: row.consumedCents }))}
              />
            </div>
          </div>
        </section>

        {/* Weekly Growth */}
        <section className="pb-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="font-display text-2xl font-bold text-gray-200">
                Weekly Growth
              </h2>
              {weeklyAvgGrowth && (
                <p className="text-sm text-gray-400">
                  Avg. weekly spending growth:{" "}
                  <span className={Number(weeklyAvgGrowth) >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                    {Number(weeklyAvgGrowth) >= 0 ? "+" : ""}{weeklyAvgGrowth}%
                  </span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="text-left py-3 px-4 font-medium">Week</th>
                      <th className="text-right py-3 px-4 font-medium">
                        Credits Loaded
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        Credits Spent
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        Revenue
                      </th>
                      <th className="text-right py-3 px-4 font-medium">
                        Spending Growth
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.weeklyGrowth.map((row, i) => {
                      const prev = metrics.weeklyGrowth[i + 1];
                      const growth =
                        prev && prev.consumed_cents > 0
                          ? (
                              ((row.consumed_cents - prev.consumed_cents) /
                                prev.consumed_cents) *
                              100
                            ).toFixed(0)
                          : null;
                      return (
                        <tr
                          key={row.period}
                          className="border-b border-gray-800 text-gray-300"
                        >
                          <td className="py-3 px-4 font-medium text-white">
                            {row.period}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCents(row.credited_cents)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCents(row.consumed_cents)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCents(row.revenue_cents)}
                          </td>
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
              <BarChart
                rotateLabels
                data={[...metrics.weeklyGrowth]
                  .reverse()
                  .map((row) => ({ label: row.period, value: row.consumed_cents }))}
              />
            </div>
          </div>
        </section>

        {/* What We Need */}
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              What We Need — May 2026
            </h2>
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-gray-300 text-sm leading-relaxed space-y-6">
              <div>
                <h3 className="text-white font-semibold text-base mb-2">Raise</h3>
                <p>
                  We are raising a <strong className="text-white">$500K pre-seed round</strong> to
                  fund 12 months of runway. The capital will go toward infrastructure costs,
                  AI model spend, and one full-time hire (growth engineer).
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold text-base mb-2">Use of Funds</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li><strong className="text-white">40%</strong> — AI model costs (Anthropic, OpenAI, Google) and infrastructure (Railway, Neon, Vercel)</li>
                  <li><strong className="text-white">30%</strong> — First growth engineer hire</li>
                  <li><strong className="text-white">20%</strong> — Customer acquisition and paid distribution experiments</li>
                  <li><strong className="text-white">10%</strong> — Legal, compliance, and operational buffer</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold text-base mb-2">Key Milestones (Next 6 Months)</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-300">
                  <li>Reach <strong className="text-white">$5K MRR</strong> in credit consumption</li>
                  <li>Onboard <strong className="text-white">50 paying organizations</strong></li>
                  <li>Launch <strong className="text-white">self-serve onboarding</strong> (no-touch signup to first workflow execution)</li>
                  <li>Ship <strong className="text-white">MCP marketplace</strong> — third-party developers publish and monetize distribution workflows</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold text-base mb-2">Why Now</h3>
                <p>
                  AI model costs are dropping 10x per year. Distribution — lead finding,
                  outreach, content creation — is the last major business function still done
                  manually by most companies. The Model Context Protocol (MCP) creates a
                  standard interface for AI agents to interact with external tools, making
                  it possible to build a horizontal distribution platform for the first time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Infrastructure */}
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Infrastructure
            </h2>
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-gray-300 text-sm leading-relaxed space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 mb-1">Hosting</p>
                  <p className="text-white">Railway (backend), Vercel (frontend)</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Database</p>
                  <p className="text-white">Neon Postgres (27 databases)</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Architecture</p>
                  <p className="text-white">27 microservices, DAG workflow orchestration</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Payments</p>
                  <p className="text-white">Stripe (credit top-ups, no subscriptions)</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Auth</p>
                  <p className="text-white">Clerk</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">AI Models</p>
                  <p className="text-white">Multi-provider (Anthropic, OpenAI, Google)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="pb-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display text-2xl font-bold mb-4 text-gray-200">
              Contact
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              For investor inquiries, please reach out to:
            </p>
            <a
              href="mailto:investors@distribute.you"
              className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-3 rounded-lg transition"
            >
              investors@distribute.you
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center text-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image
              src="/logo-head.jpg"
              alt="distribute"
              width={20}
              height={20}
              className="rounded"
            />
            <a href="/" className="hover:text-brand-400 transition">
              distribute
            </a>
            <span>--</span>
            <span>The Stripe of Distribution</span>
          </div>
          <p className="text-xs text-gray-600">
            This page contains confidential information intended for prospective
            investors only.
          </p>
        </div>
      </footer>
    </>
  );
}
