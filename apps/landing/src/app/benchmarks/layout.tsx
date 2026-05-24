import type { Metadata } from "next";
import { URLS } from "@distribute/content";
import { PROD_URLS } from "@/lib/env-urls";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const BENCHMARKS_URL = `${PROD_URLS.landing}/benchmarks`;
const SITE_NAME = "distribute Benchmarks";
const SITE_DESCRIPTION =
  "Open benchmarks & statistics for AI-driven outreach. Per-feature industry studies plus live data from every brand running distribute.";

export const metadata: Metadata = {
  title: {
    default: "distribute Benchmarks — Open Industry Data",
    template: "%s | distribute Benchmarks",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "outreach benchmarks 2026",
    "cold email benchmarks",
    "sales outreach statistics",
    "PR outreach benchmarks",
    "hiring outreach data",
    "AI visibility benchmarks",
    "open dataset outreach",
    "industry benchmarks distribute",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BENCHMARKS_URL,
    siteName: SITE_NAME,
    title: "distribute Benchmarks — Open Industry Data",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute Benchmarks — Open Industry Data",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute Benchmarks — Open Industry Data",
    description: SITE_DESCRIPTION,
    images: ["/og-image.jpg"],
    creator: "@distribute_you",
  },
  alternates: {
    canonical: BENCHMARKS_URL,
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "distribute", item: PROD_URLS.landing },
    { "@type": "ListItem", position: 2, name: "Benchmarks", item: BENCHMARKS_URL },
  ],
};

export default function BenchmarksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Navbar />
      {children}
      <Footer
        disclaimer={
          <>
            External study citations curated by the distribute team. Live
            leaderboard data sourced from real campaigns, updated hourly.{" "}
            <a href={URLS.github} className="underline hover:text-gray-300">
              Open source methodology.
            </a>
          </>
        }
      />
    </>
  );
}
