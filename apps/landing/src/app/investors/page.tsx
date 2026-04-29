import type { Metadata } from "next";
import Image from "next/image";
import { headers } from "next/headers";
import { Navbar } from "@/components/navbar";
import { PROD_URLS } from "@/lib/env-urls";

export const metadata: Metadata = {
  title: "Investor Information",
  description:
    "Live platform metrics and company information for distribute investors.",
  robots: { index: false, follow: false },
};

const METRICS = {
  updatedAt: "2026-04-29",
  users: { total: 59, orgs: 51 },
  billing: {
    totalAccounts: 16,
    accountsWithPaymentMethod: 4,
    totalCreditBalanceCents: 116_885,
    totalCreditedCents: 20_000,
    totalConsumedCents: 4_120,
  },
  runs: {
    completed: 376_910,
    failed: 43_945,
    running: 32_776,
  },
  monthlyGrowth: [
    { month: "Feb 2026", newOrgs: 40, newUsers: 19, completedRuns: 13_832 },
    { month: "Mar 2026", newOrgs: 7, newUsers: 38, completedRuns: 97_266 },
    { month: "Apr 2026", newOrgs: 4, newUsers: 2, completedRuns: 265_813 },
  ],
} as const;

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
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

export default async function InvestorsPage() {
  const headersList = await headers();
  const host = headersList.get("host") || "";

  const totalRuns =
    METRICS.runs.completed + METRICS.runs.failed + METRICS.runs.running;
  const successRate = ((METRICS.runs.completed / totalRuns) * 100).toFixed(1);

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
              Last updated: {METRICS.updatedAt}
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
                for Distribution. Users provide a URL and a budget — the
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
                <strong className="text-white">{METRICS.users.orgs}</strong>{" "}
                organizations and{" "}
                <strong className="text-white">{METRICS.users.total}</strong>{" "}
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
                value={formatNumber(METRICS.users.orgs)}
                sub={`${METRICS.users.total} individual users`}
              />
              <StatCard
                label="Billing Accounts"
                value={formatNumber(METRICS.billing.totalAccounts)}
                sub={`${METRICS.billing.accountsWithPaymentMethod} with saved payment method`}
              />
              <StatCard
                label="Completed Runs"
                value={formatNumber(METRICS.runs.completed)}
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
                value={formatCents(METRICS.billing.totalCreditedCents)}
                sub="Cumulative top-ups"
              />
              <StatCard
                label="Credits Consumed"
                value={formatCents(METRICS.billing.totalConsumedCents)}
                sub="Total platform spend"
              />
              <StatCard
                label="Outstanding Balance"
                value={formatCents(METRICS.billing.totalCreditBalanceCents)}
                sub="Across all accounts"
              />
            </div>
          </div>
        </section>

        {/* Monthly Growth */}
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Monthly Growth
            </h2>
            <div className="overflow-x-auto">
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
                      Run Growth
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.monthlyGrowth.map((row, i) => {
                    const prev = METRICS.monthlyGrowth[i - 1];
                    const growth = prev
                      ? (
                          ((row.completedRuns - prev.completedRuns) /
                            prev.completedRuns) *
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
                          {growth ? (
                            <span className="text-emerald-400">
                              +{growth}%
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
            <span>The Stripe for Distribution</span>
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
