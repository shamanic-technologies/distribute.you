import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { fetchLeaderboard } from "@/lib/performance/fetch-leaderboard";
import { BrandLeaderboard } from "@/components/performance/leaderboard-table";
import { Section } from "@/components/section";

export const revalidate = 300;

const PERF_URL = `${PROD_URLS.landing}/performance`;
const PAGE_URL = `${PERF_URL}/brands`;
const PAGE_DESCRIPTION =
  "Public brand leaderboard for distribute cold email campaigns. Real open rates, website visits, replies, and cost per action — sortable, transparent, updated hourly.";

export const metadata: Metadata = {
  title: "Brand Leaderboard",
  description: PAGE_DESCRIPTION,
  keywords: [
    "cold email brand leaderboard",
    "cold email reply rate by brand",
    "cost per reply benchmarks",
    "open source cold email performance",
    "distribute brands",
  ],
  openGraph: {
    title: "Brand Leaderboard — distribute Performance",
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "distribute Brand Leaderboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Brand Leaderboard — distribute Performance",
    description: PAGE_DESCRIPTION,
    images: ["/og-image.jpg"],
    creator: "@distribute_you",
  },
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "distribute", item: PROD_URLS.landing },
    { "@type": "ListItem", position: 2, name: "Performance", item: PERF_URL },
    { "@type": "ListItem", position: 3, name: "Brand Leaderboard", item: PAGE_URL },
  ],
};

const datasetJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "distribute Brand Performance Leaderboard",
  description: PAGE_DESCRIPTION,
  url: PAGE_URL,
  license: "https://creativecommons.org/licenses/by/4.0/",
  creator: { "@type": "Organization", name: "distribute", url: PROD_URLS.landing },
  variableMeasured: [
    { "@type": "PropertyValue", name: "Open Rate", unitText: "percent" },
    { "@type": "PropertyValue", name: "Click Rate", unitText: "percent" },
    { "@type": "PropertyValue", name: "Reply Rate", unitText: "percent" },
    { "@type": "PropertyValue", name: "Cost Per Reply", unitText: "USD cents" },
  ],
};

export default async function BrandsPage() {
  const data = await fetchLeaderboard();
  const brands = data?.brands || [];

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
      <Section variant="wide" outerClassName="py-12">
        <h1 className="font-display text-3xl font-bold mb-2 text-gray-800">
          Brand Leaderboard
        </h1>
        <p className="text-gray-600 mb-8">
          Performance data for every brand running campaigns through distribute.
          Click column headers to sort.
        </p>

        {brands.length > 0 ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <BrandLeaderboard brands={brands} />
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
              Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "hourly"}.
              Brands are opted-in by default.
            </p>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500">No campaign data yet. Check back soon.</p>
          </div>
        )}
      </Section>
    </main>
  );
}
