import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { PROD_URLS } from "@/lib/env-urls";
import { fetchBenchmarkFeatures } from "@/lib/benchmarks/fetch-benchmark";

export const revalidate = 300;
export const dynamic = "force-dynamic";

const PAGE_URL = `${PROD_URLS.landing}/benchmarks`;
const PAGE_DESCRIPTION =
  "Open benchmarks & statistics for AI-driven outreach. Real per-feature performance from every brand running campaigns through distribute — sales, PR, hiring, VC, accelerators, AI visibility, and more.";

export const metadata: Metadata = {
  title: "Benchmarks & Statistics (2026) — distribute",
  description: PAGE_DESCRIPTION,
  keywords: [
    "cold email benchmarks",
    "sales outreach benchmarks 2026",
    "PR outreach benchmarks",
    "hiring outreach benchmarks",
    "AI visibility benchmarks",
    "cost per reply benchmarks",
    "industry benchmarks 2026",
    "open dataset cold email",
  ],
  openGraph: {
    title: "Benchmarks & Statistics — distribute",
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute Benchmarks & Statistics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Benchmarks & Statistics — distribute",
    description: PAGE_DESCRIPTION,
    images: ["/og-image.jpg"],
    creator: "@distribute_you",
  },
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
};

export default async function BenchmarksIndexPage() {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const features = await fetchBenchmarkFeatures(host);

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
      {
        "@type": "ListItem",
        position: 2,
        name: "Benchmarks",
        item: PAGE_URL,
      },
    ],
  };

  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    name: "distribute Benchmarks & Statistics",
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    license: "https://creativecommons.org/licenses/by/4.0/",
    creator: {
      "@type": "Organization",
      name: "distribute",
      url: PROD_URLS.landing,
    },
    dataset: features.map((f) => ({
      "@type": "Dataset",
      name: `${f.name} Benchmarks & Statistics`,
      description: f.description,
      url: `${PAGE_URL}/${f.slug}`,
    })),
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

      <section className="py-16 md:py-20 px-4 gradient-bg">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-emerald-200">
            Open data · Updated hourly · {features.length} features
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-800">
            Benchmarks &{" "}
            <span className="gradient-text">Statistics</span> for AI-driven
            outreach
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every campaign run through distribute contributes to these public
            leaderboards. Pick a feature to see the full ranking — brand by
            brand, workflow by workflow.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          {features.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500">
                Benchmarks loading. Check back in a moment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <Link
                  key={feature.slug}
                  href={`/benchmarks/${feature.slug}`}
                  className="group block bg-white border border-gray-200 rounded-xl p-6 hover:border-brand-300 hover:shadow-md transition"
                >
                  <h2 className="font-display text-lg font-semibold text-gray-900 group-hover:text-brand-600 transition mb-2">
                    {feature.name}
                  </h2>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3">
                    {feature.description}
                  </p>
                  <span className="text-xs font-medium text-brand-600 group-hover:underline">
                    View benchmarks →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl font-bold mb-4 text-gray-800">
            Why we publish everything
          </h2>
          <p className="text-gray-600">
            Most outreach platforms hide their real numbers. We don&apos;t. Every
            campaign that runs through distribute contributes to these public
            benchmarks — sortable, transparent, no cherry-picking. Use them to
            calibrate what &ldquo;good&rdquo; looks like before you spend a
            dollar on outreach.
          </p>
        </div>
      </section>
    </main>
  );
}
