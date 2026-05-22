import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { fetchLeaderboard } from "@/lib/performance/fetch-leaderboard";
import { WorkflowLeaderboardFiltered } from "@/components/performance/workflow-leaderboard-filtered";

export const revalidate = 300;

const PERF_URL = `${PROD_URLS.landing}/performance`;
const PAGE_URL = `${PERF_URL}/models`;
const PAGE_DESCRIPTION =
  "Public workflow leaderboard for distribute cold email campaigns. Compare AI workflows head-to-head by real open rates, reply rates, runs, and cost-per-action.";

export const metadata: Metadata = {
  title: "Workflow Leaderboard",
  description: PAGE_DESCRIPTION,
  keywords: [
    "cold email workflow comparison",
    "AI cold email benchmarks",
    "best cold email workflow",
    "cost per reply by workflow",
    "open source cold email leaderboard",
  ],
  openGraph: {
    title: "Workflow Leaderboard — distribute Performance",
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "distribute Workflow Leaderboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Workflow Leaderboard — distribute Performance",
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
    { "@type": "ListItem", position: 3, name: "Workflow Leaderboard", item: PAGE_URL },
  ],
};

const datasetJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "distribute Workflow Performance Leaderboard",
  description: PAGE_DESCRIPTION,
  url: PAGE_URL,
  license: "https://creativecommons.org/licenses/by/4.0/",
  creator: { "@type": "Organization", name: "distribute", url: PROD_URLS.landing },
  variableMeasured: [
    { "@type": "PropertyValue", name: "Open Rate", unitText: "percent" },
    { "@type": "PropertyValue", name: "Click Rate", unitText: "percent" },
    { "@type": "PropertyValue", name: "Reply Rate", unitText: "percent" },
    { "@type": "PropertyValue", name: "Cost Per Reply", unitText: "USD cents" },
    { "@type": "PropertyValue", name: "Run Count", unitText: "runs" },
  ],
};

export default async function WorkflowsPage() {
  const data = await fetchLeaderboard();
  const workflows = data?.workflows || [];

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
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl font-bold mb-2 text-gray-800">
            Workflow Leaderboard
          </h1>
          <p className="text-gray-600 mb-8">
            Compare outreach workflows by real campaign performance.
            Which workflow delivers the best open rates, visits, and replies?
          </p>

          {workflows.length > 0 ? (
            <>
              <WorkflowLeaderboardFiltered workflows={workflows} />
              <p className="text-xs text-gray-400 mt-4 text-center">
                Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "hourly"}.
                All data from real campaigns.
              </p>
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500">No workflow data yet. Check back soon.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
