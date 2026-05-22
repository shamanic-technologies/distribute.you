import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { ComingSoon } from "@/components/performance/coming-soon";

const PERF_URL = `${PROD_URLS.landing}/performance`;
const PAGE_URL = `${PERF_URL}/prompts`;
const PAGE_DESCRIPTION =
  "Coming soon: public prompt-version leaderboard. Compare cold email prompt versions by real open rates, reply rates, and conversions.";

export const metadata: Metadata = {
  title: "Prompt Leaderboard",
  description: PAGE_DESCRIPTION,
  keywords: [
    "cold email prompt comparison",
    "AI prompt benchmarks",
    "best cold email prompts",
    "prompt versioning",
    "distribute prompts",
  ],
  openGraph: {
    title: "Prompt Leaderboard — distribute Performance",
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "distribute Prompt Leaderboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt Leaderboard — distribute Performance",
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
    { "@type": "ListItem", position: 3, name: "Prompt Leaderboard", item: PAGE_URL },
  ],
};

export default function PromptsPage() {
  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ComingSoon
        title="Prompt Leaderboard"
        description="We're building prompt versioning to track how different email generation prompts perform over time. You'll be able to see which prompt versions produce the highest open rates, reply rates, and conversions."
      />
    </main>
  );
}
