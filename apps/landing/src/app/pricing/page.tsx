import { Suspense } from "react";
import { PROD_URLS } from "@/lib/env-urls";
import { ProviderTablesAsync } from "@/components/pricing/provider-tables-async";
import { ProviderTablesSkeleton } from "@/components/pricing/provider-tables-skeleton";
import { Section } from "@/components/section";

export const revalidate = 300;

const PRICING_URL = `${PROD_URLS.landing}/pricing`;

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
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
      "Variable pay-per-use pricing across 50+ priced API operations (AI tokens, leads, emails, etc.). $25 in welcome credits, no subscription.",
    seller: { "@type": "Organization", name: "distribute" },
    url: PRICING_URL,
  },
};

export default function PricingPage() {
  return (
    <main className="v2-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />

      <section className="v2-section">
        <div className="v2-shell text-center">
          <div className="v2-eyebrow mb-6">
            <span className="v2-dot" />
            Transparent variable costs
          </div>
          <h1 className="v2-title mx-auto mb-5 max-w-3xl text-4xl md:text-6xl">
            Every unit cost we re-bill,{" "}
            <span className="text-[var(--v2-accent-hi)]">live from production</span>
          </h1>
          <p className="v2-body mx-auto mb-2 max-w-2xl text-lg">
            We do not sell flat subscriptions. You pay only for what your campaigns
            actually consume — token by token, lead by lead, email by email.
          </p>
          <p className="v2-muted mx-auto max-w-2xl text-sm">
            Below is the live unit-cost catalog grouped by provider. Prices change as
            providers change theirs.
          </p>
        </div>
      </section>

      <section className="v2-section-tight border-y border-[var(--v2-border)] bg-[var(--v2-bg-alt)]">
        <div className="v2-shell">
          <p className="v2-mono mb-6 text-center text-xs uppercase tracking-wider text-[var(--v2-muted)]">
            How pricing works
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="v2-card p-5">
              <div className="v2-mono mb-2 text-[10px] uppercase tracking-wider text-[var(--v2-muted)]">
                Layer 1
              </div>
              <h3 className="v2-h2 mb-1 text-lg">
                Primitives
              </h3>
              <p className="v2-body text-sm">
                50+ priced API operations. Each one listed below.
                Fixed unit price per call.
              </p>
            </div>
            <div className="v2-card p-5">
              <div className="v2-mono mb-2 text-[10px] uppercase tracking-wider text-[var(--v2-muted)]">
                Layer 2
              </div>
              <h3 className="v2-h2 mb-1 text-lg">
                Workflows
              </h3>
              <p className="v2-body text-sm">
                Recipes that combine primitives. One run = sum of primitives.
                Forkable, customizable.
              </p>
            </div>
            <div className="v2-card p-5">
              <div className="v2-mono mb-2 text-[10px] uppercase tracking-wider text-[var(--v2-muted)]">
                Layer 3
              </div>
              <h3 className="v2-h2 mb-1 text-lg">
                Outcomes
              </h3>
              <p className="v2-body text-sm">
                Derived a posteriori. Cost per qualified reply, cost per paid conversion —
                tracked per product × channel, live in your dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section variant="content" outerClassName="v2-section-tight">
        <Suspense fallback={<ProviderTablesSkeleton />}>
          <ProviderTablesAsync />
        </Suspense>
      </Section>
    </main>
  );
}
