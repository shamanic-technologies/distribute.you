import type { Metadata } from "next";
import Image from "next/image";
import { URLS } from "@distribute/content";
import { PROD_URLS } from "@/lib/env-urls";
import { Navbar } from "@/components/navbar";

const PRICING_URL = `${PROD_URLS.landing}/pricing`;
const SITE_NAME = "distribute Pricing";
const SITE_DESCRIPTION =
  "Live, transparent unit costs we re-bill, by provider and cost type. Variable pricing — pay only what you use, no half-used subscriptions.";

export const metadata: Metadata = {
  title: {
    default: "distribute Pricing — Transparent Variable Costs",
    template: "%s | distribute Pricing",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "distribute pricing",
    "transparent pricing",
    "pay per use",
    "variable costs",
    "no subscription",
    "unit cost",
    "AI cold email pricing",
    "Anthropic Claude pricing",
    "Apollo lead pricing",
    "Postmark email pricing",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: PRICING_URL,
    siteName: SITE_NAME,
    title: "distribute Pricing — Transparent Variable Costs",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "distribute Pricing — Transparent Variable Costs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute Pricing — Transparent Variable Costs",
    description: SITE_DESCRIPTION,
    images: ["/og-image.jpg"],
  },
  alternates: {
    canonical: PRICING_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <footer className="bg-gray-900 text-gray-400 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center text-sm">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Image src="/logo-head.jpg" alt="distribute" width={20} height={20} className="rounded" />
            <a href="/" className="hover:text-brand-400 transition">
              distribute
            </a>
            <span>—</span>
            <span>The Stripe of Distribution</span>
          </div>
          <p className="text-xs mb-3">
            Prices fetched live from{" "}
            <code className="text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded">
              api.distribute.you/v1/costs/platform-prices
            </code>
            . Updated whenever a provider rate changes.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <a href="/" className="hover:text-gray-300 transition">Home</a>
            <a href="/performance" className="hover:text-gray-300 transition">Performance</a>
            <a href={URLS.docs} className="hover:text-gray-300 transition">Docs</a>
            <a href={URLS.github} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">GitHub</a>
          </div>
        </div>
      </footer>
    </>
  );
}
