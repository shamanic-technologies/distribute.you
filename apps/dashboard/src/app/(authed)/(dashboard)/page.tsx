import Image from "next/image";
import Link from "next/link";
import { fetchPublicStatsSummary } from "@/lib/public-stats";
import { formatBillingCents, formatCount } from "@/lib/format-number";

export const revalidate = 300;

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  accent: string;
}

interface FunnelStepProps {
  index: string;
  label: string;
  value: string;
  detail: string;
  widthPct: number;
  tone: string;
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function numericCents(cents: string): number {
  return Number.parseFloat(cents);
}

function shortMoney(cents: string): string {
  const dollars = numericCents(cents) / 100;
  return `$${Math.round(dollars).toLocaleString("en-US")}`;
}

function barWidth(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.min((numerator / denominator) * 100, 100);
}

function StatCard({ label, value, detail, accent }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className={`h-1 w-10 rounded-full ${accent} mb-4`} />
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
}

function FunnelStep({ index, label, value, detail, widthPct, tone }: FunnelStepProps) {
  return (
    <div className="grid gap-3 border-b border-gray-100 py-4 last:border-b-0 md:grid-cols-[3rem_1fr_9rem] md:items-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-semibold text-gray-500">
        {index}
      </div>
      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-sm font-semibold text-gray-950 md:hidden">{value}</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${widthPct}%` }} />
        </div>
        <p className="mt-1 text-xs text-gray-500">{detail}</p>
      </div>
      <p className="hidden text-right text-sm font-semibold text-gray-950 md:block">{value}</p>
    </div>
  );
}

function SourceRow({ layer, source, status }: { layer: string; source: string; status: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 border-b border-gray-100 py-3 last:border-b-0 sm:grid-cols-[7rem_1fr_12rem]">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{layer}</p>
      <p className="text-sm text-gray-900">{source}</p>
      <p className="col-span-2 text-xs text-gray-500 sm:col-span-1 sm:text-right">{status}</p>
    </div>
  );
}

export default async function DashboardHome() {
  const stats = await fetchPublicStatsSummary();
  const cardRate = pct(stats.billing.accounts_with_payment_method, stats.users.totalUsers);
  const billingAccountRate = pct(stats.billing.total_accounts, stats.users.totalUsers);
  const completedRuns = stats.runs.byStatus.completed;
  const totalRuns = stats.runs.byStatus.completed + stats.runs.byStatus.failed + stats.runs.byStatus.running;
  const runCompletionRate = pct(completedRuns, totalRuns);
  const maxFunnelValue = Math.max(stats.users.totalUsers, stats.billing.total_accounts, stats.billing.accounts_with_payment_method, 1);
  const currentMonth = stats.users.monthlyGrowth[stats.users.monthlyGrowth.length - 1];

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
        <section className="bg-white border border-gray-200 rounded-lg p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <Image src="/logo-head.jpg" alt="distribute" width={36} height={36} className="rounded-lg" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Build in public</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-normal text-gray-950 md:text-4xl">
                    distribute public metrics
                  </h1>
                </div>
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-gray-600">
                The global dashboard starts before any org context: signups, payment activation, credits, and platform runs are visible from the same public stats endpoints used by the investor page.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/orgs"
                className="inline-flex items-center justify-center rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                Open my org
              </Link>
              <Link
                href="https://distribute.you"
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Public site
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Users"
            value={formatCount(stats.users.totalUsers)}
            detail={`${formatCount(stats.users.totalOrgs)} orgs created`}
            accent="bg-brand-500"
          />
          <StatCard
            label="Cards added"
            value={formatCount(stats.billing.accounts_with_payment_method)}
            detail={`${cardRate} of signed-up users`}
            accent="bg-emerald-500"
          />
          <StatCard
            label="Credits purchased"
            value={shortMoney(stats.billing.total_revenue_cents)}
            detail={`${formatBillingCents(stats.billing.total_credited_cents)} credited total`}
            accent="bg-amber-500"
          />
          <StatCard
            label="Runs completed"
            value={formatCount(completedRuns)}
            detail={`${runCompletionRate} completion rate`}
            accent="bg-sky-500"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">Signup funnel</h2>
                <p className="text-sm text-gray-500">Public-safe product steps from gateway stats.</p>
              </div>
              <p className="text-xs text-gray-400">
                Updated {new Date(stats.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="mt-4">
              <FunnelStep
                index="01"
                label="Landing visitors"
                value="Pending"
                detail="PostHog and GA4 raw sources will feed this step."
                widthPct={100}
                tone="bg-gray-300"
              />
              <FunnelStep
                index="02"
                label="Signed up"
                value={formatCount(stats.users.totalUsers)}
                detail={currentMonth ? `${formatCount(currentMonth.newUsers)} new users in ${currentMonth.month}` : "User stats endpoint is live."}
                widthPct={barWidth(stats.users.totalUsers, maxFunnelValue)}
                tone="bg-brand-500"
              />
              <FunnelStep
                index="03"
                label="Billing account created"
                value={formatCount(stats.billing.total_accounts)}
                detail={`${billingAccountRate} of signed-up users`}
                widthPct={barWidth(stats.billing.total_accounts, maxFunnelValue)}
                tone="bg-sky-500"
              />
              <FunnelStep
                index="04"
                label="Card added"
                value={formatCount(stats.billing.accounts_with_payment_method)}
                detail={`${cardRate} of signed-up users`}
                widthPct={barWidth(stats.billing.accounts_with_payment_method, maxFunnelValue)}
                tone="bg-emerald-500"
              />
              <FunnelStep
                index="05"
                label="Credits purchased"
                value={shortMoney(stats.billing.total_revenue_cents)}
                detail="Revenue amount is live; purchaser count needs billing gold."
                widthPct={barWidth(numericCents(stats.billing.total_revenue_cents), numericCents(stats.billing.total_credited_cents))}
                tone="bg-amber-500"
              />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-950">Data layers</h2>
            <p className="mt-1 text-sm text-gray-500">
              Two analytics bronzes can converge into one public funnel without double-counting visitors.
            </p>
            <div className="mt-4">
              <SourceRow layer="Bronze" source="PostHog events raw" status="Product and auth events" />
              <SourceRow layer="Bronze" source="GA4 events or report snapshots raw" status="Acquisition and landing traffic" />
              <SourceRow layer="Bronze" source="Clerk, billing, and runs public stats" status="Already live" />
              <SourceRow layer="Silver" source="Canonical web sessions and funnel steps" status="Next data pass" />
              <SourceRow layer="Gold" source="public_funnel_daily / weekly / all_time" status="Public page source" />
            </div>
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-950">Not synthesized client-side</p>
              <p className="mt-1 text-sm leading-5 text-amber-900">
                Visitors, visitor-to-signup rate, auto-top-up count, and credit-purchaser count stay explicit until the producer layers expose them.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
