import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PROD_URLS } from "@/lib/env-urls";
import { BRAND_LOGO_URL, TWITTER_HANDLE } from "@/lib/seo";
import { OUTCOMES, getOutcome, type OutcomeDef } from "@/lib/outcomes/outcomes";
import {
  fetchOutcomeStats,
  type OutcomeStats,
  type OutcomeDistribution,
  type TrendPoint,
} from "@/lib/outcomes/fetch-outcome";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return OUTCOMES.map((o) => ({ outcome: o.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ outcome: string }>;
}): Promise<Metadata> {
  const { outcome } = await params;
  const def = getOutcome(outcome);
  if (!def) return {};
  const title = `Cost per ${def.noun} | distribute`;
  const description = `${def.tagline} ${def.howWeTrack}`;
  const url = `${PROD_URLS.landing}/outcomes/${def.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description, site: TWITTER_HANDLE },
  };
}

// ── Formatting ──────────────────────────────────────────────────────────────
function fmtUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v < 10
    ? `$${v.toFixed(2)}`
    : `$${Math.round(v).toLocaleString("en-US")}`;
}
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ── Inline SVG trend (server-rendered, scraper-safe, no client JS) ───────────
function TrendChart({ points }: { points: TrendPoint[] }) {
  const data = points.filter(
    (p): p is { date: string; costPerOutcomeUsd: number } =>
      p.costPerOutcomeUsd !== null,
  );
  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        Not enough data yet to plot a trend.
      </div>
    );
  }
  const W = 640;
  const H = 200;
  const pad = 8;
  const vals = data.map((d) => d.costPerOutcomeUsd);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (W - pad * 2) + pad;
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const line = data.map((d, i) => `${x(i).toFixed(1)},${y(d.costPerOutcomeUsd).toFixed(1)}`);
  const area = `${pad},${H - pad} ${line.join(" ")} ${W - pad},${H - pad}`;
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-48 w-full"
        role="img"
        aria-label="Cost per outcome over time"
      >
        <polygon points={area} fill="#eef2ff" />
        <polyline
          points={line.join(" ")}
          fill="none"
          stroke="#6366f1"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>{fmtDate(data[0].date)}</span>
        <span>
          low {fmtUsd(min)} · high {fmtUsd(max)}
        </span>
        <span>{fmtDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ── Inline SVG histogram (cross-brand price spread) ──────────────────────────
function Histogram({
  dist,
  noun,
}: {
  dist: OutcomeDistribution;
  noun: string;
}) {
  const W = 640;
  const H = 200;
  const padB = 22;
  const maxCount = Math.max(...dist.buckets.map((b) => b.count), 1);
  const n = dist.buckets.length;
  const gap = 4;
  const barW = (W - gap * (n - 1)) / n;
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-52 w-full"
        role="img"
        aria-label={`Distribution of cost per ${noun} across brands`}
      >
        {dist.buckets.map((b, i) => {
          const h = (b.count / maxCount) * (H - padB - 6);
          const x = i * (barW + gap);
          return (
            <rect
              key={i}
              x={x.toFixed(1)}
              y={(H - padB - h).toFixed(1)}
              width={barW.toFixed(1)}
              height={Math.max(h, 1).toFixed(1)}
              rx="2"
              fill="#6366f1"
              opacity={0.85}
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>{fmtUsd(dist.min)}</span>
        <span>
          {dist.brandCount} brands · median {fmtUsd(dist.median)} · mean{" "}
          {fmtUsd(dist.mean)}
        </span>
        <span>{fmtUsd(dist.max)}</span>
      </div>
    </div>
  );
}

function SourceTag({ measuredByUs }: { measuredByUs: boolean }) {
  return measuredByUs ? (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
      measured by us
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
      client-reported
    </span>
  );
}

function OutcomePage({ def, stats }: { def: OutcomeDef; stats: OutcomeStats }) {
  const others = OUTCOMES.filter((o) => o.slug !== def.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "distribute", item: PROD_URLS.landing },
      { "@type": "ListItem", position: 2, name: "Pricing", item: `${PROD_URLS.landing}/pricing` },
      {
        "@type": "ListItem",
        position: 3,
        name: `Cost per ${def.noun}`,
        item: `${PROD_URLS.landing}/outcomes/${def.slug}`,
      },
    ],
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-indigo-600 px-2 py-1 font-mono text-xs font-bold text-white">
          {def.sym}
        </span>
        <SourceTag measuredByUs={def.measuredByUs} />
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Cost per {def.noun}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-gray-600">{def.tagline}</p>

      {/* Price cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Current average
          </p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">
            {fmtUsd(stats.currentAvgUsd)}
          </p>
          <p className="mt-1 text-xs text-gray-400">per {def.noun}, live</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            All-time average
          </p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">
            {fmtUsd(stats.lifetimeAvgUsd)}
          </p>
          <p className="mt-1 text-xs text-gray-400">pooled, all history</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Across
          </p>
          <p className="mt-1 text-3xl font-semibold text-gray-900">
            {stats.brandCount ?? "—"}
          </p>
          <p className="mt-1 text-xs text-gray-400">brands we run</p>
        </div>
      </div>

      {/* How it works + how we track */}
      <section className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            What this outcome is
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {def.howItWorks}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            How we track it
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {def.howWeTrack}
          </p>
        </div>
      </section>

      {/* Trend */}
      <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          Cost per {def.noun} over time
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Moving average across every brand we run.
        </p>
        <div className="mt-4">
          <TrendChart points={stats.trend} />
        </div>
      </section>

      {/* Distribution histogram — cross-brand price spread. */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          Price spread across brands
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Each brand pays its own rate. This is how the cost per {def.noun} is
          spread across the brands we run, not just the average.
        </p>
        <div className="mt-4">
          {stats.distribution ? (
            <Histogram dist={stats.distribution} noun={def.noun} />
          ) : (
            <p className="py-6 text-sm text-gray-400">
              Not enough brands yet to show the full spread.
            </p>
          )}
        </div>
      </section>

      {/* Best model — per-workflow cost, cheapest first */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          Our best models
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Each workflow is one way we chase this outcome. Cheapest first.
        </p>
        {stats.workflows.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            No workflow data yet for this outcome.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="py-2 pr-4 font-medium">Model</th>
                  <th className="py-2 pr-4 font-medium text-right">
                    Cost per {def.noun}
                  </th>
                  <th className="py-2 font-medium text-right">Spend</th>
                </tr>
              </thead>
              <tbody>
                {stats.workflows.slice(0, 8).map((w, i) => (
                  <tr
                    key={w.workflowDynastySlug || w.workflowDynastyName}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="py-2 pr-4 text-gray-800">
                      {i === 0 && (
                        <span className="mr-2 rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-green-200">
                          best
                        </span>
                      )}
                      {w.workflowDynastyName}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-gray-900">
                      {fmtUsd(w.costPerOutcomeUsd)}
                    </td>
                    <td className="py-2 text-right text-gray-600">
                      {fmtUsd(w.spentUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="mt-10 rounded-2xl bg-gray-900 px-6 py-8 text-center">
        <h2 className="text-xl font-semibold text-white">
          Buy {def.nounPlural} from $1 a day
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-300">
          Set a daily budget and we chase this outcome at the lowest cost we can
          find. First $25 matched.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a
            href="https://dashboard.distribute.you/sign-up"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
          >
            Get $25 free credits
          </a>
          <a
            href="/pricing"
            className="rounded-lg border border-gray-600 px-5 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-800"
          >
            See the calculator
          </a>
        </div>
      </section>

      {/* Other outcomes */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-gray-900">Other outcomes</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {others.map((o) => (
            <a
              key={o.slug}
              href={`/outcomes/${o.slug}`}
              className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {o.sym}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {o.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Cost per {o.noun} →</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ outcome: string }>;
}) {
  const { outcome } = await params;
  const def = getOutcome(outcome);
  if (!def) notFound();
  const stats = await fetchOutcomeStats(def.objective);
  return <OutcomePage def={def} stats={stats} />;
}
