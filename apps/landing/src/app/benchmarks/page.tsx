import type { Metadata } from "next";
import Link from "next/link";
import { PROD_URLS } from "@/lib/env-urls";
import { BRAND_LOGO_URL, TWITTER_HANDLE } from "@/lib/seo";
import { OUTCOMES, type OutcomeDef } from "@/lib/outcomes/outcomes";
import { fetchOutcomeStats, type OutcomeStats } from "@/lib/outcomes/fetch-outcome";

export const revalidate = 300;

const PAGE_URL = `${PROD_URLS.landing}/benchmarks`;
// Bare title for the <title> tag, the root layout template already appends
// "| distribute", so don't double the brand here. OG/twitter carry the full
// brand form (no template applies to them).
const PAGE_TITLE = "What outcomes cost";
const PAGE_TITLE_SOCIAL = "What outcomes cost | distribute";
const PAGE_DESCRIPTION =
  "The cost of our best cross-org workflow for each B2B outbound outcome distribute measures: cost per website visit and cost per positive reply for a sales meeting.";

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

// Scoped dark-charter remap (matches the new landing skin + the /outcomes
// detail pages): a .bm wrapper sets the dark page, and the Tailwind utilities
// the JSX uses are remapped to charter values inside it. Space Grotesk + IBM
// Plex Mono; emerald → signal green.
const BM_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.bm{background:#070a0f;color:#f2f5f7;min-height:100vh;font-family:'Inter',system-ui,sans-serif;
  background-image:radial-gradient(circle at 78% -2%,rgba(69,227,142,.08),transparent 32rem)}
.bm h1,.bm h2{font-family:'Space Grotesk','Inter',sans-serif}
.bm [class*="font-mono"]{font-family:'IBM Plex Mono',monospace}
.bm .bg-white{background:#10151d !important}
.bm .text-gray-900{color:#f2f5f7 !important}
.bm .text-gray-600,.bm .text-gray-700{color:#99a4b6 !important}
.bm .text-gray-500,.bm .text-gray-400{color:#657184 !important}
.bm .text-white{color:#082314 !important}
.bm .border-gray-200{border-color:#26303d !important}
.bm .text-emerald-600{color:#45e38e !important}
.bm .text-emerald-700{color:#8af6bc !important}
.bm .bg-emerald-500{background:#45e38e !important}
.bm .bg-emerald-50{background:rgba(69,227,142,.1) !important}
.bm .border-emerald-200{border-color:rgba(69,227,142,.28) !important}
.bm .hover\\:border-emerald-300:hover{border-color:rgba(69,227,142,.4) !important}
.bm .bg-emerald-600{background:#45e38e !important}
.bm .hover\\:bg-emerald-700:hover{background:#8af6bc !important}
.bm .bg-gray-50{background:#0b0f15 !important}
`;

// ── Formatting ───────────────────────────────────────────────────────────────
function fmtUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v < 10
    ? `$${v.toFixed(2)}`
    : `$${Math.round(v).toLocaleString("en-US")}`;
}

type OutcomeRow = { def: OutcomeDef; stats: OutcomeStats | null };

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
  const rows: OutcomeRow[] = OUTCOMES.map((def, i) => ({ def, stats: stats[i] }));
  const bySlug = (slug: string) => rows.find((r) => r.def.slug === slug);
  const reply = bySlug("positive-replies");
  const visit = bySlug("website-visits");

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
    <main className="bm">
      <style dangerouslySetInnerHTML={{ __html: BM_CSS }} />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-10 sm:pt-28">
        <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live · best model
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          What outcomes actually cost.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
          These are the prices our best cross-org workflow is paying right now
          for the two outcomes we measure ourselves: a website visit, or a
          positive reply for a sales meeting. Not a diluted pooled average — the
          model we deploy to new clients by default.
        </p>
      </section>

      {/* Detail cards — best-model cost, link into each outcome page */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-6 text-sm font-semibold text-gray-900">
          Every outcome, in detail
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[reply, visit].filter((r): r is OutcomeRow => Boolean(r)).map(({ def, stats }) => (
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
                    {fmtUsd(stats?.bestCostUsd)}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">
                    best model
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
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
          sending inboxes. Each price is the cost of our cheapest cross-org
          workflow that actually delivered the outcome. Observed prices are not
          guarantees; your cost depends on targeting, offer, geography, copy, and
          downstream conversion.
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
