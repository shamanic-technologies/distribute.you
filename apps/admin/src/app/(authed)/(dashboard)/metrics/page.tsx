import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PublicAnalyticsChart } from "@/components/public-analytics-chart";
import { PeriodCompoundCard } from "@/components/period-compound-card";
import { ActiveUsersView } from "@/components/active-users-view";
import { OverviewView } from "@/components/overview-view";
import { RevenueView } from "@/components/revenue-view";
import { SignupView } from "@/components/signup-view";
import { CardsView } from "@/components/cards-view";
import {
  fetchPublicStatsSummary,
  type BillingStats,
  type DailyFunnelPoint,
  type PublicAnalyticsView,
  type TrafficSource,
} from "@/lib/public-stats";
import { cmgrSummary, monthlyVisitors, weeklyVisitors } from "@/lib/signup-buckets";
import { formatCount, formatPctAdaptive } from "@/lib/format-number";
import { StatCard } from "@/components/stat-card";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const VIEWS: Array<{ id: PublicAnalyticsView; label: string; href: string }> = [
  { id: "overview", label: "Overview", href: "/metrics?view=overview" },
  { id: "landing", label: "Unique visitors", href: "/metrics?view=landing" },
  { id: "signups", label: "Signups", href: "/metrics?view=signups" },
  { id: "cards", label: "Paid users", href: "/metrics?view=cards" },
  { id: "active-users", label: "Active users", href: "/metrics?view=active-users" },
  { id: "revenue", label: "Revenue", href: "/metrics?view=revenue" },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// The footer names where the numbers ABOVE it come from, so it cannot be one
// fixed list — the Revenue tab shares none of the funnel tabs' sources. It used
// to claim PostHog and saved payment methods on every view, which on Revenue
// named three things that feed none of its figures and omitted the cost ledger
// that feeds nearly all of them.
function dataSourcesFor(view: PublicAnalyticsView): Array<{ tier: string; label: string }> {
  if (view === "revenue") {
    return [
      { tier: "Bronze", label: "Payments, refunds and lost disputes across every acquirer" },
      { tier: "Silver", label: "Actualized cold-email spend on the runs cost ledger" },
      { tier: "Gold", label: "Fleet revenue history and committed-budget snapshots" },
    ];
  }
  if (view === "overview") {
    return [
      { tier: "Bronze", label: "PostHog unique visitors and signup events" },
      { tier: "Bronze", label: "Stripe saved payment methods" },
      { tier: "Gold", label: "Fleet revenue, active users and the customer board" },
    ];
  }
  return [
    { tier: "Bronze", label: "PostHog unique visitors and signup events" },
    { tier: "Bronze", label: "Stripe saved payment methods" },
    { tier: "Gold", label: "Public signup and billing totals" },
  ];
}

function parseView(raw: string | string[] | undefined): PublicAnalyticsView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (
    value === "overview" ||
    value === "signups" ||
    value === "cards" ||
    value === "active-users" ||
    value === "revenue"
  ) {
    return value;
  }
  return "landing";
}

function latestDate(points: DailyFunnelPoint[]): string {
  const last = points[points.length - 1];
  if (!last) return "No dated activity";
  return new Date(`${last.date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ViewTabs({ active }: { active: PublicAnalyticsView }) {
  return (
    <div className="flex flex-wrap gap-2">
      {VIEWS.map((view) => (
        <Link
          key={view.id}
          href={view.href}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            active === view.id
              ? "border-gray-950 bg-gray-950 text-white"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-950"
          }`}
        >
          {view.label}
        </Link>
      ))}
    </div>
  );
}

function SourcesTable({ sources }: { sources: TrafficSource[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">Visitor origins</h2>
      <div className="mt-4 divide-y divide-gray-100">
        {sources.map((source) => (
          <div key={source.source} className="grid gap-3 py-3 sm:grid-cols-[1fr_7rem_7rem] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{source.source}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${source.sharePct}%` }} />
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-950 sm:text-right">{formatCount(source.visitors)}</p>
            <p className="text-xs text-gray-500 sm:text-right">{formatPctAdaptive(source.sharePct)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingView({
  totalVisitors,
  timeline,
  sources,
}: {
  totalVisitors: number;
  timeline: DailyFunnelPoint[];
  sources: TrafficSource[];
}) {
  const monthly = monthlyVisitors(timeline);
  const weekly = weeklyVisitors(timeline);
  const monthlyPoints = monthly.map((b) => ({ label: b.label, value: b.signups, cmgrPct: b.cmgrPct }));
  const weeklyPoints = weekly.map((b) => ({ label: b.label, value: b.signups, cmgrPct: b.cmgrPct }));
  const monthlyCmgr = cmgrSummary(monthly);
  const weeklyCmgr = cmgrSummary(weekly);
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Unique visitors" value={formatCount(totalVisitors)} detail={`Through ${latestDate(timeline)}`} accent="bg-sky-500" />
        <StatCard label="Tracked days" value={formatCount(timeline.length)} detail="PostHog daily visitor buckets" accent="bg-gray-500" />
        <StatCard label="Top origin" value={sources[0]?.source ?? "No source"} detail={sources[0] ? `${formatCount(sources[0].visitors)} unique visitors` : "No visitors yet"} accent="bg-emerald-500" />
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <PeriodCompoundCard
          title="Monthly unique visitors"
          subtitle="Unique visitors per month with compound monthly growth since inception."
          cmgrLabel="CMGR"
          cmgrUnit="monthly"
          summary={monthlyCmgr}
          data={monthlyPoints}
          valueLabel="Unique visitors"
          growthLabel="CMGR since inception"
        />
        <PeriodCompoundCard
          title="Weekly unique visitors"
          subtitle="Unique visitors per week with compound weekly growth since inception."
          cmgrLabel="CWGR"
          cmgrUnit="weekly"
          summary={weeklyCmgr}
          data={weeklyPoints}
          valueLabel="Unique visitors"
          growthLabel="CWGR since inception"
        />
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Unique visitors over time</h2>
          <p className="mt-1 text-sm text-gray-500">Daily unique PostHog visitors on distribute.you.</p>
          <div className="mt-5">
            <PublicAnalyticsChart data={timeline} metric="landingVisitors" color="#0ea5e9" />
          </div>
        </div>
        <SourcesTable sources={sources} />
      </section>
    </>
  );
}

export default async function PlatformMetrics({ searchParams }: PageProps) {
  // Cross-org "build in public" funnel. Reachable via the header logo. The admin
  // app is fully staff-gated at the edge (email allowlist in proxy.ts), so no
  // per-viewer feature flag is needed — any signed-in staff sees it.
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const sp = await searchParams;
  const view = parseView(sp.view);
  // The active-users view reads the cross-org accounts snapshot client-side
  // (getAuditAccounts), so it doesn't need the PostHog/Stripe/Clerk summary.
  const stats = view === "active-users" ? null : await fetchPublicStatsSummary(view);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
        <section className="rounded-lg border border-gray-200 bg-white p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <Image src="/logo-head.jpg" alt="distribute.you" width={36} height={36} className="rounded-lg" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Build in public</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-normal text-gray-950 md:text-4xl">
                    distribute.you public metrics
                  </h1>
                </div>
              </div>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-gray-600">
                Public analytics for the global product funnel: unique visitors, signup conversion, and saved-card activation.
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
          <div className="mt-6">
            <ViewTabs active={view} />
          </div>
        </section>

        {view === "overview" && stats && (
          <OverviewView
            landingVisitors={stats.landingVisitors}
            totalUsers={stats.users.totalUsers}
            billing={stats.billing}
            timeline={stats.timeline}
            windows={stats.windows}
          />
        )}
        {view === "landing" && stats && (
          <LandingView totalVisitors={stats.landingVisitors} timeline={stats.timeline} sources={stats.trafficSources} />
        )}
        {view === "signups" && stats && (
          <SignupView
            totalUsers={stats.users.totalUsers}
            totalVisitors={stats.landingVisitors}
            signupEvents={stats.signupEvents}
            timeline={stats.timeline}
          />
        )}
        {view === "active-users" && <ActiveUsersView />}
        {view === "revenue" && stats && (
          <RevenueView
            billing={stats.billing}
            visitorFirstSeenMonths={stats.visitorFirstSeenMonths}
            signupFirstSeenMonths={stats.signupFirstSeenMonths}
          />
        )}
        {view === "cards" && stats && (
          <CardsView billing={stats.billing} totalUsers={stats.users.totalUsers} timeline={stats.timeline} />
        )}

        {stats && (
          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-950">Data sources</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {dataSourcesFor(view).map((source) => (
                <div key={source.label} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{source.tier}</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{source.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-400">
              Updated {new Date(stats.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
