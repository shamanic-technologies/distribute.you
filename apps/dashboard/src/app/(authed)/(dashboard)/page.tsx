import Image from "next/image";
import Link from "next/link";
import { PublicAnalyticsChart } from "@/components/public-analytics-chart";
import {
  fetchPublicStatsSummary,
  type DailyFunnelPoint,
  type PublicAnalyticsView,
  type TrafficSource,
} from "@/lib/public-stats";
import { formatCount } from "@/lib/format-number";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const VIEWS: Array<{ id: PublicAnalyticsView; label: string; href: string }> = [
  { id: "landing", label: "Unique visitors", href: "/?view=landing" },
  { id: "signups", label: "Signup conversions", href: "/?view=signups" },
  { id: "cards", label: "Cards added", href: "/?view=cards" },
];

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  accent: string;
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function parseView(raw: string | string[] | undefined): PublicAnalyticsView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "signups" || value === "cards") return value;
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

function StatCard({ label, value, detail, accent }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className={`mb-4 h-1 w-10 rounded-full ${accent}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
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
            <p className="text-xs text-gray-500 sm:text-right">{source.sharePct.toFixed(1)}%</p>
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
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Unique visitors" value={formatCount(totalVisitors)} detail={`Through ${latestDate(timeline)}`} accent="bg-sky-500" />
        <StatCard label="Tracked days" value={formatCount(timeline.length)} detail="PostHog daily visitor buckets" accent="bg-gray-500" />
        <StatCard label="Top origin" value={sources[0]?.source ?? "No source"} detail={sources[0] ? `${formatCount(sources[0].visitors)} unique visitors` : "No visitors yet"} accent="bg-emerald-500" />
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

function SignupView({
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
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total signups" value={formatCount(totalUsers)} detail="Clerk /users/count total" accent="bg-brand-500" />
        <StatCard label="Tracked signup events" value={formatCount(signupEvents)} detail="PostHog signup_completed events" accent="bg-sky-500" />
        <StatCard label="Signup conversion" value={pct(totalUsers, totalVisitors)} detail="Total users divided by unique visitors" accent="bg-emerald-500" />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Signups vs unique visitors</h2>
          <p className="mt-1 text-sm text-gray-500">Daily signups compared with daily unique visitors.</p>
          <div className="mt-5">
            <PublicAnalyticsChart
              data={timeline}
              series={[
                { metric: "landingVisitors", color: "#0ea5e9" },
                { metric: "signups", color: "#6366f1" },
              ]}
            />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Signup conversion over time</h2>
          <p className="mt-1 text-sm text-gray-500">Daily signup events divided by daily unique visitors.</p>
          <div className="mt-5">
            <PublicAnalyticsChart data={timeline} metric="signupConversionPct" color="#10b981" />
          </div>
        </div>
      </section>
    </>
  );
}

function CardsView({
  cardsAdded,
  totalUsers,
  timeline,
}: {
  cardsAdded: number;
  totalUsers: number;
  timeline: DailyFunnelPoint[];
}) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total cards added" value={formatCount(cardsAdded)} detail="Billing public accounts with payment method" accent="bg-emerald-500" />
        <StatCard label="Signup to card conversion" value={pct(cardsAdded, totalUsers)} detail="Cards added divided by total signups" accent="bg-brand-500" />
        <StatCard label="Tracked card days" value={formatCount(timeline.filter((point) => point.cardsAdded > 0).length)} detail="Stripe first saved-card dates" accent="bg-sky-500" />
      </section>
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Cards added over time</h2>
          <p className="mt-1 text-sm text-gray-500">Daily first saved card per Stripe customer.</p>
          <div className="mt-5">
            <PublicAnalyticsChart data={timeline} metric="cardsAdded" color="#10b981" />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Signup to card conversion over time</h2>
          <p className="mt-1 text-sm text-gray-500">Daily cards added divided by daily signup events.</p>
          <div className="mt-5">
            <PublicAnalyticsChart data={timeline} metric="cardConversionPct" color="#f59e0b" />
          </div>
        </div>
      </section>
    </>
  );
}

export default async function DashboardHome({ searchParams }: PageProps) {
  const sp = await searchParams;
  const view = parseView(sp.view);
  const stats = await fetchPublicStatsSummary(view);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
        <section className="rounded-lg border border-gray-200 bg-white p-6 md:p-8">
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

        {view === "landing" && (
          <LandingView totalVisitors={stats.landingVisitors} timeline={stats.timeline} sources={stats.trafficSources} />
        )}
        {view === "signups" && (
          <SignupView
            totalUsers={stats.users.totalUsers}
            totalVisitors={stats.landingVisitors}
            signupEvents={stats.signupEvents}
            timeline={stats.timeline}
          />
        )}
        {view === "cards" && (
          <CardsView cardsAdded={stats.cardsAdded} totalUsers={stats.users.totalUsers} timeline={stats.timeline} />
        )}

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-950">Data sources</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bronze</p>
              <p className="mt-1 text-sm font-medium text-gray-900">PostHog unique visitors and signup events</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Bronze</p>
              <p className="mt-1 text-sm font-medium text-gray-900">Stripe saved payment methods</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Gold</p>
              <p className="mt-1 text-sm font-medium text-gray-900">Public signup and billing totals</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Updated {new Date(stats.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </section>
      </div>
    </div>
  );
}
