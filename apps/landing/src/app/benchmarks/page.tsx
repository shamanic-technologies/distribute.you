import type { Metadata } from "next";
import Link from "next/link";
import { PROD_URLS } from "@/lib/env-urls";
import { BRAND_LOGO_URL, TWITTER_HANDLE } from "@/lib/seo";
import { OUTCOMES, type OutcomeDef } from "@/lib/outcomes/outcomes";
import {
  fetchOutcomeStats,
  type OutcomeStats,
  type TrendPoint,
} from "@/lib/outcomes/fetch-outcome";

export const revalidate = 300;

const PAGE_URL = `${PROD_URLS.landing}/benchmarks`;
// Bare title for the <title> tag — the root layout template already appends
// "| distribute", so don't double the brand here. OG/twitter carry the full
// brand form (no template applies to them).
const PAGE_TITLE = "What outcomes cost";
const PAGE_TITLE_SOCIAL = "What outcomes cost | distribute";
const PAGE_DESCRIPTION =
  "The live going rate for B2B outbound outcomes, averaged across every brand distribute runs: cost per website visit, positive reply, booked meeting, and signup.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: PAGE_TITLE_SOCIAL,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE_SOCIAL,
    description: PAGE_DESCRIPTION,
    site: TWITTER_HANDLE,
  },
};

// ── Formatting ───────────────────────────────────────────────────────────────
function fmtUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v < 10
    ? `$${v.toFixed(2)}`
    : `$${Math.round(v).toLocaleString("en-US")}`;
}

// Mini trend sparkline (theme-independent, emerald stroke). Server-rendered SVG
// so the chart ships in raw HTML (SEO / AI-scraper safe).
function Sparkline({ points }: { points: TrendPoint[] }) {
  const vals = points
    .map((p) => p.costPerOutcomeUsd)
    .filter((v): v is number => v !== null);
  if (vals.length < 2) {
    return <div className="h-9 w-full" aria-hidden="true" />;
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const W = 140;
  const H = 36;
  const pad = 3;
  const coords = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = pad + (1 - (v - min) / span) * (H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      className="h-9 w-full"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={coords}
        fill="none"
        stroke="#059669"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

async function safeStats(def: OutcomeDef): Promise<OutcomeStats | null> {
  // Build-time prerender must stay shippable: a slow/failed public metric must
  // not abort the whole landing deploy (CLAUDE.md build-time fetch rule).
  try {
    return await fetchOutcomeStats(def.objective);
  } catch (error) {
    console.error(`[benchmarks] outcome stats unavailable for ${def.slug}`, error);
    return null;
  }
}

export default async function BenchmarksPage() {
  const stats = await Promise.all(OUTCOMES.map(safeStats));
  const rows = OUTCOMES.map((def, i) => ({ def, stats: stats[i] }));

  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "distribute cost-per-outcome benchmarks",
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    creator: {
      "@type": "Organization",
      name: "distribute",
      url: PROD_URLS.landing,
      logo: BRAND_LOGO_URL,
    },
    variableMeasured: OUTCOMES.map((o) => ({
      "@type": "PropertyValue",
      name: `Cost per ${o.noun}`,
      unitText: "USD",
    })),
  };

  return (
    <main className="bg-white">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-10 sm:pt-28">
        <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live · observed prices
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          What outcomes actually cost.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
          Nobody pays a fixed rate. These are the average prices our campaigns
          are paying right now, across every brand we run. The further down the
          funnel, the more each outcome costs.
        </p>
      </section>

      {/* The distribute outcome funnel */}
      <section className="mx-auto max-w-5xl px-6 pb-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900">
          The distribute outcome funnel
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          One budget, four outcomes. Pick the result you want the campaign to
          pursue; the cost climbs as the outcome moves closer to revenue.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {rows.map(({ def, stats }, i) => (
            <div key={def.slug} className="flex flex-1 items-stretch gap-3">
              <Link
                href={`/outcomes/${def.slug}`}
                className="group flex flex-1 flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-emerald-700">
                      {def.sym}
                    </span>
                    <span className="text-xs text-gray-500">{i + 1}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-900">
                    {def.label}
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold tracking-tight text-gray-900">
                  {fmtUsd(stats?.currentAvgUsd)}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">
                  {def.measuredByUs ? "measured by us" : "client-reported"}
                </div>
              </Link>
              {i < rows.length - 1 && (
                <div
                  className="hidden shrink-0 items-center text-gray-300 sm:flex"
                  aria-hidden="true"
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Detail cards — cost + trend, link into each outcome page */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-6 text-sm font-semibold text-gray-900">
          Every outcome, in detail
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {rows.map(({ def, stats }) => (
            <Link
              key={def.slug}
              href={`/outcomes/${def.slug}`}
              className="group rounded-xl border border-gray-200 bg-white p-6 transition hover:border-emerald-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold text-gray-900">
                    Cost per {def.noun}
                  </div>
                  <p className="mt-1 max-w-xs text-sm text-gray-500">
                    {def.tagline}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tracking-tight text-gray-900">
                    {fmtUsd(stats?.currentAvgUsd)}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">
                    avg / {def.noun}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Sparkline points={stats?.trend ?? []} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-gray-400">
                  {def.measuredByUs ? "measured by us" : "client-reported"}
                </span>
                <span className="text-sm font-medium text-emerald-600 group-hover:underline">
                  See the price detail →
                </span>
              </div>
            </Link>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-gray-400">
          Website visits and positive replies we measure ourselves, from our own
          sending inboxes. Meetings and signups are reported by each client from
          their own funnel, so they vary more between brands. Observed prices are
          not guarantees; your cost depends on targeting, offer, geography, copy,
          and downstream conversion.
        </p>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            See your own cost per outcome.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-600">
            Drop your website, pick the outcome you want, set a daily budget.
            distribute runs the outreach and reports the real cost per outcome in
            your dashboard.
          </p>
          <a
            href={PROD_URLS.signUp}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-700"
          >
            Start free →
          </a>
        </div>
      </section>
    </main>
  );
}
