import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PROD_URLS } from "@/lib/env-urls";
import {
  fetchBenchmarkFeatures,
  fetchFeatureBenchmark,
} from "@/lib/benchmarks/fetch-benchmark";
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

export const revalidate = 300;

interface PageProps {
  params: Promise<{ featureSlug: string }>;
}

export async function generateStaticParams() {
  try {
    const features = await fetchBenchmarkFeatures();
    return features.map((f) => ({ featureSlug: f.slug }));
  } catch (err) {
    console.error("[landing] benchmarks: generateStaticParams fetch failed", err);
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { featureSlug } = await params;
  const features = await fetchBenchmarkFeatures();
  const feature = features.find((f) => f.slug === featureSlug);
  if (!feature) {
    return { title: "Benchmark Not Found" };
  }

  const pageUrl = `${PROD_URLS.landing}/benchmarks/${feature.slug}`;
  const title = `${feature.name} Benchmarks & Statistics (2026)`;
  const description = `${feature.description} Real performance data from every brand running ${feature.name} through distribute — sortable leaderboard, full ranking, no cherry-picking.`;

  return {
    title,
    description,
    keywords: [
      `${feature.name.toLowerCase()} benchmarks`,
      `${feature.name.toLowerCase()} statistics 2026`,
      `${feature.name.toLowerCase()} cost per reply`,
      `${feature.name.toLowerCase()} reply rate`,
      "open dataset outreach",
      "cold email benchmarks",
    ],
    openGraph: {
      title,
      description,
      url: pageUrl,
      images: [
        {
          url: "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.jpg"],
      creator: "@distribute_you",
    },
    alternates: { canonical: pageUrl },
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
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-2xl md:text-3xl font-display font-bold text-gray-900 mt-1">
        {value}
      </div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

export default async function FeatureBenchmarkPage({ params }: PageProps) {
  const { featureSlug } = await params;
  // Resolved at build time (PROD_URLS = resolveUrls("")); preview/staging
  // deployments link to prod dashboard sign-up. Trade-off for ISR static
  // prerender, which requires no per-request headers().
  const signUpUrl = PROD_URLS.signUp;

  const data = await fetchFeatureBenchmark(featureSlug);
  if (!data) notFound();

  const content = getBenchmarkContent(featureSlug);
  const { feature, brands, workflows, aggregate, updatedAt } = data;
  const indexUrl = `${PROD_URLS.landing}/benchmarks`;
  const pageUrl = `${indexUrl}/${feature.slug}`;
  const title = `${feature.name} Benchmarks & Statistics (2026)`;
  const description = `${feature.description} Sortable leaderboard updated hourly.`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "distribute",
        item: PROD_URLS.landing,
      },
      { "@type": "ListItem", position: 2, name: "Benchmarks", item: indexUrl },
      { "@type": "ListItem", position: 3, name: feature.name, item: pageUrl },
    ],
  };

  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: title,
    description,
    url: pageUrl,
    license: "https://creativecommons.org/licenses/by/4.0/",
    creator: {
      "@type": "Organization",
      name: "distribute",
      url: PROD_URLS.landing,
    },
    temporalCoverage: "all-time",
    dateModified: updatedAt,
    variableMeasured: [
      { "@type": "PropertyValue", name: "Open Rate", unitText: "percent" },
      { "@type": "PropertyValue", name: "Click Rate", unitText: "percent" },
      {
        "@type": "PropertyValue",
        name: "Positive Reply Rate",
        unitText: "percent",
      },
      {
        "@type": "PropertyValue",
        name: "Cost Per Positive Reply",
        unitText: "USD cents",
      },
    ],
  };

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />

      {/* Hero */}
      <section className="py-12 md:py-16 gradient-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="text-sm text-gray-600 mb-4 flex items-center gap-2">
            <Link href="/benchmarks" className="hover:text-brand-600 underline">
              Benchmarks
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-800 font-medium">{feature.name}</span>
          </nav>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-3 text-gray-800">
            {feature.name} <span className="gradient-text">Benchmarks &amp; Statistics</span>{" "}
            <span className="text-gray-500 font-normal">(2026)</span>
          </h1>
          <p className="text-base md:text-lg text-gray-600 max-w-3xl mb-8">
            {feature.description}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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
      <section className="py-10 md:py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
            From the distribute open dataset
          </p>
          <h2 className="font-display text-xl md:text-2xl font-bold text-gray-900 mb-2">
            Platform averages
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Aggregated across every campaign run through {feature.name} — every
            brand, every workflow. Updated hourly.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            <HeroStat label="Open rate" value={formatPercent(aggregate.openRate)} />
            <HeroStat
              label="Click rate"
              value={formatPercent(aggregate.clickRate)}
            />
            <HeroStat
              label="Positive reply rate"
              value={formatPercent(aggregate.replyRate)}
            />
            <HeroStat
              label="$ / open"
              value={formatCostCents(aggregate.costPerOpenCents)}
            />
            <HeroStat
              label="$ / click"
              value={formatCostCents(aggregate.costPerClickCents)}
            />
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
      {content && <BenchmarkCTA copy={content.ctaPrimary} signUpUrl={signUpUrl} variant="primary" />}

      {/* Brand leaderboard */}
      <section className="py-10 md:py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="font-display text-xl md:text-2xl font-bold text-gray-900">
                Brand leaderboard
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Every brand that has run {feature.name} through distribute.
                Click column headers to sort.
              </p>
            </div>
            <span className="text-xs text-gray-400 hidden md:block">
              {brands.length.toLocaleString()} brands
            </span>
          </div>
          {brands.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <BrandLeaderboard brands={brands} />
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-gray-500">
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
      <section className="py-10 md:py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="font-display text-xl md:text-2xl font-bold text-gray-900">
                Workflow leaderboard
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Every workflow that runs {feature.name} — ranked by cost per
                positive reply.
              </p>
            </div>
            <span className="text-xs text-gray-400 hidden md:block">
              {workflows.length.toLocaleString()} workflows
            </span>
          </div>
          {workflows.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <WorkflowLeaderboard workflows={workflows} inSection />
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500">No workflow data yet.</p>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4">
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

      {/* See another feature */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-2xl font-bold mb-4 text-gray-800">
            See another feature
          </h2>
          <p className="text-gray-600 mb-6">
            distribute publishes the same depth of benchmarks for every feature
            we ship.
          </p>
          <Link
            href="/benchmarks"
            className="inline-block px-6 py-3 bg-brand-500 text-white rounded-full hover:bg-brand-600 transition font-medium"
          >
            All benchmarks →
          </Link>
        </div>
      </section>
    </main>
  );
}
