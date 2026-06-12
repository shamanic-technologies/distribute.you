import { Suspense } from "react";
import { PROD_URLS } from "@/lib/env-urls";
import { BRAND_LOGO_URL } from "@/lib/seo";
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
  provider: {
    "@type": "Organization",
    name: "distribute",
    url: PROD_URLS.landing,
    logo: BRAND_LOGO_URL,
  },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "0",
    highPrice: "1",
    offerCount: 50,
    description:
      "Variable pay-per-use pricing across 50+ priced API operations (AI tokens, leads, emails, etc.). 50 free emails, no subscription.",
    seller: {
      "@type": "Organization",
      name: "distribute",
      url: PROD_URLS.landing,
      logo: BRAND_LOGO_URL,
    },
    url: PRICING_URL,
  },
};

export default function PricingPage() {
  return (
    <main className="dy-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />

      <section className="dy-section">
        <div className="dy-shell text-center">
          <div className="dy-eyebrow mb-6">
            <span className="dy-dot" />
            Transparent variable costs
          </div>
          <h1 className="dy-title mx-auto mb-5 max-w-3xl text-4xl md:text-6xl">
            Every unit cost we re-bill,{" "}
            <span className="text-[var(--dy-accent-hi)]">live from production</span>
          </h1>
          <p className="dy-body mx-auto mb-2 max-w-2xl text-lg">
            We do not sell flat subscriptions. You pay only for what your campaigns
            actually consume — token by token, lead by lead, email by email.
          </p>
          <p className="dy-muted mx-auto max-w-2xl text-sm">
            Below is the live unit-cost catalog grouped by provider. Prices change as
            providers change theirs.
          </p>
        </div>
      </section>

      <section className="dy-section-tight border-y border-[var(--dy-border)] bg-[var(--dy-bg-alt)]">
        <div className="dy-shell">
          <p className="dy-mono mb-6 text-center text-xs uppercase tracking-wider text-[var(--dy-muted)]">
            How pricing works
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="dy-card p-5">
              <div className="dy-mono mb-2 text-[10px] uppercase tracking-wider text-[var(--dy-muted)]">
                Layer 1
              </div>
              <h3 className="dy-h2 mb-1 text-lg">
                Primitives
              </h3>
              <p className="dy-body text-sm">
                50+ priced API operations. Each one listed below.
                Fixed unit price per call.
              </p>
            </div>
            <div className="dy-card p-5">
              <div className="dy-mono mb-2 text-[10px] uppercase tracking-wider text-[var(--dy-muted)]">
                Layer 2
              </div>
              <h3 className="dy-h2 mb-1 text-lg">
                Workflows
              </h3>
              <p className="dy-body text-sm">
                Recipes that combine primitives. One run = sum of primitives.
                Forkable, customizable.
              </p>
            </div>
            <div className="dy-card p-5">
              <div className="dy-mono mb-2 text-[10px] uppercase tracking-wider text-[var(--dy-muted)]">
                Layer 3
              </div>
              <h3 className="dy-h2 mb-1 text-lg">
                Outcomes
              </h3>
              <p className="dy-body text-sm">
                Derived a posteriori. Cost per qualified reply, cost per paid conversion —
                tracked per product × channel, live in your dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section variant="content" outerClassName="dy-section-tight">
        <Suspense fallback={<ProviderTablesSkeleton />}>
          <ProviderTablesAsync />
        </Suspense>
      </Section>
    </main>
  );
}
