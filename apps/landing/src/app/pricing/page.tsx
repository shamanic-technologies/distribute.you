import { PROD_URLS } from "@/lib/env-urls";
import { BRAND_LOGO_URL } from "@/lib/seo";
import { ProviderTablesAsync } from "@/components/pricing/provider-tables-async";
import { Section } from "@/components/section";

export const revalidate = 300;

const PRICING_URL = `${PROD_URLS.landing}/pricing`;

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "distribute — Pay-as-you-go cloud distribution",
  description:
    "Cloud platform with pay-as-you-go pricing. We send AI cold email outreach on your behalf — find prospects, write, send, qualify replies. Every unit cost is published live.",
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

// Single source of truth: the visible FAQ cards AND the FAQPage JSON-LD render
// from this array, so structured data can never drift from what's on the page
// (a Google requirement). Answers are grounded in facts already stated on this
// page — no invented billing specifics.
const PRICING_FAQ: { question: string; answer: string }[] = [
  {
    question: "Is there a subscription or a monthly fee?",
    answer:
      "No. distribute is pay-as-you-go — you only pay for what your campaigns actually consume, token by token, lead by lead, email by email. No seats, no monthly minimum.",
  },
  {
    question: "Is there a free tier?",
    answer:
      "Yes. Your first 50 emails are free, and no credit card is required to start.",
  },
  {
    question: "How is the price of a single email calculated?",
    answer:
      "Each email is the sum of its priced primitives — prospect lookup, AI generation, sending, and reply qualification. The full unit-cost catalog is published live on this page.",
  },
  {
    question: "Why do the prices change?",
    answer:
      "Most unit costs are passed straight through from the providers we wrap (AI models, data, sending). When a provider changes its price, ours updates to match — so what you see is always the live, real cost.",
  },
  {
    question: "What is the difference between a primitive, a workflow, and an outcome?",
    answer:
      "A primitive is a single priced API operation. A workflow is a recipe that combines primitives, so one run costs the sum of its primitives. An outcome — like cost per qualified reply — is derived afterward and tracked live in your dashboard.",
  },
  {
    question: "Where do I see my real cost per reply?",
    answer:
      "In your dashboard. distribute tracks cost per qualified reply and cost per paid conversion per product, computed from your actual spend — not an estimate.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: PRICING_FAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
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
        <ProviderTablesAsync />
      </Section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Section
        variant="prose"
        outerClassName="dy-section-tight border-t border-[var(--dy-border)]"
      >
        <h2 className="dy-h2 mb-8 text-center text-2xl md:text-3xl">
          Frequently asked questions
        </h2>
        <div className="space-y-4">
          {PRICING_FAQ.map((item) => (
            <div key={item.question} className="dy-card p-5">
              <h3 className="dy-h2 mb-2 text-base">{item.question}</h3>
              <p className="dy-body text-sm">{item.answer}</p>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
