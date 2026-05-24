import { Suspense } from "react";
import { PROD_URLS } from "@/lib/env-urls";
import { ProviderTablesAsync } from "@/components/pricing/provider-tables-async";
import { ProviderTablesSkeleton } from "@/components/pricing/provider-tables-skeleton";
import { Section } from "@/components/section";

export const revalidate = 300;

const PRICING_URL = `${PROD_URLS.landing}/pricing`;

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "distribute — Pay-as-you-go cloud distribution",
  description:
    "Cloud distribution platform with pay-as-you-go pricing. We send cold email, PR pitches, and other outbound channels on your behalf. Every unit cost is published live.",
  brand: { "@type": "Brand", name: "distribute" },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0",
    highPrice: "1",
    offerCount: 50,
    description:
      "Variable pay-per-use pricing across 50+ priced API operations (AI tokens, leads, emails, etc.). $2 in welcome credits, no subscription.",
    seller: { "@type": "Organization", name: "distribute" },
    url: PRICING_URL,
  },
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      {/* Hero */}
      <Section variant="content" outerClassName="py-16 md:py-20 gradient-bg" className="text-center">
        <div className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-emerald-200">
          Transparent variable costs
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-800">
          Every unit cost we re-bill,{" "}
          <span className="gradient-text">live from production</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-2">
          We do not sell flat subscriptions. You pay only for what your campaigns
          actually consume — token by token, lead by lead, email by email.
        </p>
        <p className="text-sm text-gray-500 max-w-2xl mx-auto">
          Below is the live unit-cost catalog grouped by provider. Prices change as
          providers change theirs.
        </p>
      </Section>

      {/* 3-layer pricing stack */}
      <Section variant="content" outerClassName="py-12 border-b border-gray-100">
        <p className="text-center text-xs uppercase tracking-wider text-gray-400 font-medium mb-6">
          How pricing works
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">
              Layer 1
            </div>
            <h3 className="font-display text-lg font-bold text-gray-900 mb-1">
              Primitives
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              50+ priced API operations. Each one listed below.
              Fixed unit price per call.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">
              Layer 2
            </div>
            <h3 className="font-display text-lg font-bold text-gray-900 mb-1">
              Workflows
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Recipes that combine primitives. One run = sum of primitives.
              Forkable, customizable.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">
              Layer 3
            </div>
            <h3 className="font-display text-lg font-bold text-gray-900 mb-1">
              Outcomes
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Derived a posteriori. Cost per qualified reply, cost per paid conversion —
              tracked per product × channel, live in your dashboard.
            </p>
          </div>
        </div>
      </Section>

      {/* Body — Suspense streams provider tables, page paints above the fold immediately */}
      <Section variant="content" outerClassName="py-12">
        <Suspense fallback={<ProviderTablesSkeleton />}>
          <ProviderTablesAsync />
        </Suspense>
      </Section>
    </main>
  );
}
