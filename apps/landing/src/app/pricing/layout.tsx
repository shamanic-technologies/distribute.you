import type { Metadata } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { PRICING_OG_IMAGE_PATH, TWITTER_HANDLE } from "@/lib/seo";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

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
        url: PRICING_OG_IMAGE_PATH,
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
    images: [PRICING_OG_IMAGE_PATH],
    creator: TWITTER_HANDLE,
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
      <Footer
        disclaimer={
          <>
            Prices fetched live from{" "}
            <code className="text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded">
              api.distribute.you/v1/costs/platform-prices
            </code>
            . Updated whenever a provider rate changes.
          </>
        }
      />
    </>
  );
}
