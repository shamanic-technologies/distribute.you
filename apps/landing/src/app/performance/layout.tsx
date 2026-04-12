import type { Metadata } from "next";
import Image from "next/image";
import { URLS } from "@distribute/content";
import { PROD_URLS } from "@/lib/env-urls";
import { PerformanceNavbar } from "@/components/performance/performance-navbar";

const SITE_URL = PROD_URLS.landing + "/performance";
const SITE_NAME = "distribute Performance";
const SITE_DESCRIPTION =
  "100% transparent performance data from distribute campaigns. See real open rates, reply rates, and cost-per-action across all brands and AI models.";

export const metadata: Metadata = {
  title: {
    default: "distribute Performance — Public Leaderboard",
    template: "%s | distribute Performance",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "cold email performance",
    "email open rate benchmarks",
    "AI email performance",
    "cold email reply rate",
    "outreach leaderboard",
    "email campaign metrics",
    "AI model comparison",
    "cold email statistics",
    "distribute",
    "sales outreach data",
    "email automation results",
    "transparent performance data",
    "cost per reply",
    "Claude email performance",
    "cold email benchmarks 2025",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "distribute Performance — Real Campaign Data",
    description:
      "100% transparent performance data. Real open rates, reply rates, and cost-per-action from every distribute campaign.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute Performance — Public Leaderboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute Performance — Public Leaderboard",
    description:
      "100% transparent campaign performance data. Real open rates, reply rates, and cost-per-action.",
    images: ["/og-image.jpg"],
    creator: "@distribute_you",
  },
  alternates: {
    canonical: SITE_URL,
  },
};

const datasetJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "distribute Campaign Performance Data",
  description:
    "Public leaderboard of cold email campaign performance metrics including open rates, click rates, reply rates, and cost-per-action across brands and AI models.",
  url: SITE_URL,
  license: "https://creativecommons.org/licenses/by/4.0/",
  creator: {
    "@type": "Organization",
    name: "distribute",
    url: PROD_URLS.landing,
  },
  distribution: {
    "@type": "DataDownload",
    encodingFormat: "application/json",
    contentUrl: `${SITE_URL}/api/leaderboard`,
  },
  temporalCoverage: "2024/..",
  variableMeasured: [
    { "@type": "PropertyValue", name: "Open Rate", unitText: "percent" },
    { "@type": "PropertyValue", name: "Click Rate", unitText: "percent" },
    { "@type": "PropertyValue", name: "Reply Rate", unitText: "percent" },
    { "@type": "PropertyValue", name: "Cost Per Reply", unitText: "USD cents" },
  ],
};

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
      name: "Performance",
      item: SITE_URL,
    },
  ],
};

export default function PerformanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PerformanceNavbar />
      {children}
      <footer className="bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center text-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image src="/logo-head.jpg" alt="distribute" width={20} height={20} className="rounded" />
            <a href="/" className="hover:text-brand-400 transition">
              distribute
            </a>
            <span>—</span>
            <span>The Stripe for Distribution</span>
          </div>
          <p className="text-xs">
            All data is from real campaigns. Updated hourly.{" "}
            <a href={URLS.github} className="underline hover:text-gray-300">
              Open source methodology.
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
