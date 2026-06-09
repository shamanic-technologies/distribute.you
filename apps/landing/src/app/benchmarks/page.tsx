import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { fetchFeatureBenchmark } from "@/lib/benchmarks/fetch-benchmark";
import {
  BrandLeaderboard,
  WorkflowLeaderboard,
} from "@/components/performance/leaderboard-table";
import {
  formatCostCents,
  formatCostCentsWhole,
  formatCostDollars,
  formatPercent,
} from "@/lib/performance/fetch-leaderboard";
import { getBenchmarkContent } from "@/data/benchmarks-content";
import { ExternalStudiesSection } from "@/components/benchmarks/external-studies-section";
import { BenchmarkCTA } from "@/components/benchmarks/benchmark-cta";
import { WhyMattersSection } from "@/components/benchmarks/why-matters-section";
import { ValueRecap } from "@/components/benchmarks/value-recap";
import { ClientTrajectoriesSection } from "@/components/benchmarks/client-trajectories-section";
import {
  buildBenchmarkTitle,
  buildBenchmarkDescription,
} from "@/lib/benchmarks/seo";
import {
  BENCHMARKS_OG_IMAGE_PATH,
  BRAND_LOGO_URL,
  TWITTER_HANDLE,
} from "@/lib/seo";

export const revalidate = 300;

// The only GA product. Benchmarks is a single static page (no per-feature
// dynamic route) because other channels stay alpha (dashboard-only).
const FEATURE_SLUG = "sales-cold-email-outreach";
const PAGE_URL = `${PROD_URLS.landing}/benchmarks`;

export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchFeatureBenchmark(FEATURE_SLUG);
  const name = data?.feature.name ?? "Sales Cold Email Outreach";
  const featureDescription =
    data?.feature.description ??
    "Real cold email performance from every brand running distribute.";
  const title = buildBenchmarkTitle(name);
  const description = buildBenchmarkDescription(name, featureDescription);

  return {
    // `absolute` so the final title stays under Google's ~60-char limit.
    title: { absolute: title },
    description,
    keywords: [
      `${name.toLowerCase()} benchmarks`,
      `${name.toLowerCase()} performance`,
      `${name.toLowerCase()} cost per reply`,
      `${name.toLowerCase()} reply rate`,
      "cold email performance",
      "cold email benchmarks",
    ],
    openGraph: {
      title,
      description,
      url: PAGE_URL,
      images: [
        { url: BENCHMARKS_OG_IMAGE_PATH, width: 1200, height: 630, alt: title },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [BENCHMARKS_OG_IMAGE_PATH],
      creator: TWITTER_HANDLE,
    },
    alternates: { canonical: PAGE_URL },
    robots: { index: true, follow: true },
  };
}

function HeroStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="v2-card p-5">
      <div className="v2-mono text-xs uppercase tracking-wider text-[var(--v2-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-[var(--v2-text)] md:text-3xl">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--v2-muted)]">{hint}</div>}
    </div>
  );
}

function formatRevenueUsd(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "$0";
  if (value < 100) return `$${value.toFixed(2)}`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatRoi(value: number | null | undefined): string {
  return value == null ? "—" : `${value.toFixed(1)}×`;
}

export default async function BenchmarksPage() {
  // Resolved at build time (PROD_URLS = resolveUrls("")); preview/staging
  // deployments link to prod dashboard sign-up. Trade-off for ISR static
  // prerender, which requires no per-request headers().
  const signUpUrl = PROD_URLS.signUp;

  const data = await fetchFeatureBenchmark(FEATURE_SLUG);
  const content = getBenchmarkContent(FEATURE_SLUG);

  if (!data) {
    return (
      <main className="v2-page">
        <section className="v2-section">
          <div className="v2-shell text-center">
            <h1 className="v2-title mb-3 text-3xl">
              Cold Email Benchmarks
            </h1>
            <p className="v2-body">
              Performance data is loading. Check back soon.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const { feature, brands, workflows, aggregate, updatedAt } = data;
  const title = `${feature.name} Benchmarks & Statistics (2026)`;
  const description = `${feature.description} Sortable leaderboard updated hourly.`;

  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: title,
    description,
    url: PAGE_URL,
    license: "https://creativecommons.org/licenses/by/4.0/",
    creator: {
      "@type": "Organization",
      name: "distribute",
      url: PROD_URLS.landing,
      logo: BRAND_LOGO_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "distribute",
      url: PROD_URLS.landing,
      logo: BRAND_LOGO_URL,
    },
    temporalCoverage: "all-time",
    dateModified: updatedAt,
    variableMeasured: [
      { "@type": "PropertyValue", name: "Open Rate", unitText: "percent" },
      { "@type": "PropertyValue", name: "Click Rate", unitText: "percent" },
      { "@type": "PropertyValue", name: "Positive Reply Rate", unitText: "percent" },
      { "@type": "PropertyValue", name: "Cost Per Positive Reply", unitText: "USD cents" },
    ],
  };

  return (
    <main className="v2-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />

      {/* Hero */}
      <section className="v2-section">
        <div className="v2-shell-wide">
          <div className="v2-eyebrow mb-6">
            <span className="v2-dot" />
            Open dataset
          </div>
          <h1 className="v2-title mb-4 max-w-4xl text-4xl md:text-6xl">
            {feature.name}{" "}
            <span className="text-[var(--v2-accent-hi)]">Benchmarks &amp; Statistics</span>{" "}
            <span className="font-normal text-[var(--v2-muted)]">(2026)</span>
          </h1>
          <p className="v2-body mb-8 max-w-3xl text-base md:text-lg">
            {feature.description}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
            <HeroStat
              label="Brands tracked"
              value={aggregate.participatingBrands.toLocaleString()}
            />
            <HeroStat
              label="Workflows tracked"
              value={aggregate.participatingWorkflows.toLocaleString()}
            />
            <HeroStat
              label="Emails sent"
              value={aggregate.emailsSent.toLocaleString()}
              hint="all-time"
            />
            <HeroStat
              label="$ spent"
              value={formatCostDollars(aggregate.totalCostUsdCents)}
              hint="all-time"
            />
            <HeroStat
              label="Expected revenue"
              value={formatRevenueUsd(aggregate.expectedRevenueUsd)}
              hint="from brands with revenue"
            />
            <HeroStat
              label="ROI"
              value={formatRoi(aggregate.roiMultiple)}
              hint="expected revenue / spend"
            />
          </div>
        </div>
      </section>

      {/* Why this feature matters — feature-specific narrative */}
      {content && <WhyMattersSection data={content.whyMatters} />}

      {/* External industry studies — sourced from established providers */}
      {content && (
        <ExternalStudiesSection studies={content.studies} featureName={feature.name} />
      )}

      {/* Platform averages — our open dataset */}
      <section className="v2-section-tight border-y border-[var(--v2-border)] bg-[var(--v2-bg-alt)]">
        <div className="v2-shell-wide">
          <p className="v2-mono mb-2 text-xs uppercase tracking-wider text-[var(--v2-muted)]">
            From the distribute open dataset
          </p>
          <h2 className="v2-h2 mb-2 text-xl md:text-2xl">
            Platform averages
          </h2>
          <p className="v2-body mb-6 text-sm">
            Aggregated across every campaign run through {feature.name} — every
            brand, every workflow. Updated hourly.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            <HeroStat label="Open rate" value={formatPercent(aggregate.openRate)} />
            <HeroStat label="Click rate" value={formatPercent(aggregate.clickRate)} />
            <HeroStat
              label="Positive reply rate"
              value={formatPercent(aggregate.replyRate)}
            />
            <HeroStat label="$ / open" value={formatCostCents(aggregate.costPerOpenCents)} />
            <HeroStat label="$ / click" value={formatCostCents(aggregate.costPerClickCents)} />
            <HeroStat
              label="$ / positive reply"
              value={formatCostCentsWhole(aggregate.costPerReplyCents)}
            />
          </div>
        </div>
      </section>

      {/* Value recap #1 → CTA primary, right before brand leaderboard */}
      {content && content.valueRecaps[0] && (
        <ValueRecap data={content.valueRecaps[0]} eyebrow="Why distribute" />
      )}
      {content && (
        <BenchmarkCTA copy={content.ctaPrimary} signUpUrl={signUpUrl} variant="primary" />
      )}

      <ClientTrajectoriesSection brands={brands} />

      {/* Brand leaderboard */}
      <section className="v2-section-tight">
        <div className="v2-shell-wide">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="v2-h2 text-xl md:text-2xl">
                Brand leaderboard
              </h2>
              <p className="v2-body mt-1 text-sm">
                Every brand that has run {feature.name} through distribute.
                Click column headers to sort.
              </p>
            </div>
            <span className="v2-mono hidden text-xs text-[var(--v2-muted)] md:block">
              {brands.length.toLocaleString()} brands
            </span>
          </div>
          {brands.length > 0 ? (
            <div className="v2-card overflow-hidden">
              <BrandLeaderboard brands={brands} />
            </div>
          ) : (
            <div className="v2-card py-12 text-center">
              <p className="v2-body">
                No campaign data for {feature.name} yet. Check back soon.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Value recap #2 — interleaved between leaderboards */}
      {content && content.valueRecaps[1] && (
        <ValueRecap data={content.valueRecaps[1]} eyebrow="How it works" />
      )}

      {/* Workflow leaderboard */}
      <section className="v2-section-tight border-y border-[var(--v2-border)] bg-[var(--v2-bg-alt)]">
        <div className="v2-shell-wide">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="v2-h2 text-xl md:text-2xl">
                Workflow leaderboard
              </h2>
              <p className="v2-body mt-1 text-sm">
                Every workflow that runs {feature.name} — ranked by cost per
                positive reply.
              </p>
            </div>
            <span className="v2-mono hidden text-xs text-[var(--v2-muted)] md:block">
              {workflows.length.toLocaleString()} workflows
            </span>
          </div>
          {workflows.length > 0 ? (
            <div className="v2-card overflow-hidden">
              <WorkflowLeaderboard workflows={workflows} inSection />
            </div>
          ) : (
            <div className="v2-card py-12 text-center">
              <p className="v2-body">No workflow data yet.</p>
            </div>
          )}
          <p className="v2-mono mt-4 text-xs text-[var(--v2-muted)]">
            Updated {new Date(updatedAt).toLocaleString()}. Methodology is open
            source.
          </p>
        </div>
      </section>

      {/* Value recap #3 — last reminder before closing CTA */}
      {content && content.valueRecaps[2] && (
        <ValueRecap data={content.valueRecaps[2]} eyebrow="What you get" />
      )}

      {/* Closing CTA */}
      {content && (
        <BenchmarkCTA copy={content.ctaClosing} signUpUrl={signUpUrl} variant="closing" />
      )}
    </main>
  );
}
