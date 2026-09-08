import type { Metadata } from "next";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PROD_URLS } from "@/lib/env-urls";
import {
  BRAND_LOGO_URL,
  INVESTORS_OG_IMAGE_PATH,
  TWITTER_HANDLE,
} from "@/lib/seo";
import {
  CompanyOverviewSection,
  PlatformMetricsSection,
  RevenueCreditsSection,
  MonthlyGrowthSection,
  WeeklyGrowthSection,
} from "@/components/investors/data-sections";

export const revalidate = 86400;

const INVESTORS_URL = `${PROD_URLS.landing}/investors`;
const PAGE_DESCRIPTION =
  "Live platform metrics, growth data, infrastructure and SAFE-round details for distribute.you, the AI-native acquisition agency. Public investor page, refreshed daily.";

export const metadata: Metadata = {
  title: "Investor Information",
  description: PAGE_DESCRIPTION,
  keywords: [
    "distribute.you investors",
    "distribute.you SAFE round",
    "distribute.you platform metrics",
    "distribute.you revenue",
    "acquisition agency investors",
    "Y Combinator SAFE",
    "distribute.you growth metrics",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: INVESTORS_URL,
    siteName: "distribute.you Investors",
    title: "distribute.you, Investor Information",
    description: PAGE_DESCRIPTION,
    images: [{ url: INVESTORS_OG_IMAGE_PATH, width: 1200, height: 630, alt: "distribute.you Investor Information" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute.you, Investor Information",
    description: PAGE_DESCRIPTION,
    images: [INVESTORS_OG_IMAGE_PATH],
    creator: TWITTER_HANDLE,
  },
  alternates: { canonical: INVESTORS_URL },
  robots: { index: true, follow: true },
};

const investorsOrganizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "distribute.you",
  url: PROD_URLS.landing,
  logo: BRAND_LOGO_URL,
  image: BRAND_LOGO_URL,
  description: "AI-native acquisition agency. Paste a website, set a daily budget, get sales meetings with their cost.",
  foundingDate: "2024",
  sameAs: [PROD_URLS.github, PROD_URLS.twitter],
  contactPoint: {
    "@type": "ContactPoint",
    email: "investors@distribute.you",
    contactType: "Investor Relations",
  },
};

const investorsBreadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "distribute.you", item: PROD_URLS.landing },
    { "@type": "ListItem", position: 2, name: "Investor Information", item: INVESTORS_URL },
  ],
};

export default function InvestorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(investorsOrganizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(investorsBreadcrumbJsonLd) }}
      />
      <Navbar />
      <main className="dy-page">
        {/* Header */}
        <section className="pt-24 pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Image
                src="/landing/logo/logo-distribute.svg"
                alt="distribute.you"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <h1 className="font-display text-4xl font-bold">distribute.you</h1>
            </div>
            <p className="text-xl text-gray-600 mb-2">Investor Information</p>
            <p className="text-sm text-gray-500">
              Live data, refreshed daily
            </p>
          </div>
        </section>

        {/* Company Overview */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-900">
              Company Overview
            </h2>
            <CompanyOverviewSection />
          </div>
        </section>

        {/* Product, AI Cold Email */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-2 text-gray-900">
              Product: sales meetings, done for you
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              A company pastes its website and sets a daily budget. We find the buyers,
              write and send the outreach from domains we own, answer the interested
              replies until a meeting is on the calendar, and report what each one
              cost. Cold email is the channel we run most today; the engine tests
              offers, channels and audiences against each other and ranks them by
              return, so the budget moves toward what pays.
            </p>

            <div className="grid sm:grid-cols-3 gap-3">
              {[
                {
                  label: "Find the buyers",
                  body: "We draft the ideal customer profile from the website and pull the people who match it.",
                },
                {
                  label: "Write, send, answer",
                  body: "A personal email per lead from our own domains. Interested replies are answered until the meeting is booked.",
                },
                {
                  label: "Report the cost",
                  body: "Every outcome is priced against real spend and shown to the customer, per offer, channel and audience.",
                },
              ].map((step) => (
                <div
                  key={step.label}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                >
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">{step.label}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who We Serve: ICP #1 */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-2 text-gray-900">
              Who We Serve: ICP #1
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              The Serial Builder. The single user persona we optimize the product, pricing, and roadmap for.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-gray-600 text-sm leading-relaxed space-y-6">
              <blockquote className="bg-white border border-gray-200 rounded-lg p-4 italic text-gray-600">
                &quot;16-40 years old. CEO-founder, mostly solo. I always have several products on the
                bench. I have no time between newsletter, content, campaigns, meetings, replies,
                and refining who I sell to. I want someone close to me, founder reachable, bugs
                fixed fast, features shipped fast.&quot;
              </blockquote>

              <div className="rounded-lg bg-gradient-to-br from-brand-500/10 to-blue-500/10 border border-brand-500/30 p-4">
                <p className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold mb-2">
                  The dream
                </p>
                <p className="text-gray-900 italic">
                  &quot;One of my products is going to take off. I need to know what a customer
                  costs me on every channel, because I am looking for the one that scales.
                  distribute.you is the lever that makes that math actionable, whether I stay
                  1 person or grow to 10.&quot;
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Age</p>
                  <p className="text-gray-900">16-40</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Status</p>
                  <p className="text-gray-900">Solo CEO-founder, 1-3 ppl max</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Portfolio</p>
                  <p className="text-gray-900">3-10 products active</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Monthly budget</p>
                  <p className="text-gray-900">$50-$500 across products</p>
                </div>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold text-base mb-3">Time poverty</h3>
                <p className="text-gray-600 mb-2">No time between:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600 marker:text-gray-500">
                  <li>Writing the newsletter</li>
                  <li>Producing content</li>
                  <li>Running acquisition across several products</li>
                  <li>The meetings those campaigns generate</li>
                  <li>Reading and answering replies</li>
                  <li>Refining who each product sells to</li>
                </ul>
                <p className="text-gray-600 mt-3">
                  Buys <span className="text-gray-900 font-medium">time</span> and{" "}
                  <span className="text-gray-900 font-medium">leverage</span>, not a tool.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-gray-900 font-semibold text-base mb-3">Refuses</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 marker:text-red-500/60">
                    <li>Buying a sending domain</li>
                    <li>SPF / DKIM / DMARC setup</li>
                    <li>Warming mailboxes for 6 weeks</li>
                    <li>Triaging raw replies (spam vs lead)</li>
                    <li>Subscriptions ($99/mo × N products = impossible)</li>
                    <li>Lock-in / opaque pricing</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-gray-900 font-semibold text-base mb-3">Accepts</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 marker:text-blue-500/60">
                    <li>An agency sending on their behalf, from domains it owns</li>
                    <li>Interested replies answered and handed over with the meeting</li>
                    <li>Our margin inside the budget, the cost per outcome shown</li>
                    <li>Pay as you go, $30 free at signup, no subscription</li>
                    <li>Every brand, offer, channel and audience in one dashboard, ranked by return</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold text-base mb-3">North-star metric</h3>
                <p className="text-gray-600">
                  Real <span className="text-gray-900 font-medium">CAC</span> ($ per sales meeting, $ per
                  paying customer) per offer, per channel and per audience. Kills losers under 4 weeks.
                  Scales winners 10x when CAC &lt; LTV/3.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold text-base mb-3">Founder proximity</h3>
                <p className="text-gray-600">
                  Wants the founder reachable. Twitter DM, GitHub issue, direct email,
                  all acceptable. Bug fixed fast, feature shipped fast, roadmap public.
                  No enterprise support, no ticketing system.
                </p>
              </div>

              <div>
                <h3 className="text-gray-900 font-semibold text-base mb-3">Roadmap expectation</h3>
                <p className="text-gray-600">
                  More channels, same measurement. <span className="text-gray-900 font-medium">Public roadmap:</span>{" "}
                  every channel and audience we add is ranked by return on the customer&apos;s own
                  dashboard, and the fleet&apos;s figures are published live on the homepage.
                  No lock-in.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Metrics */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-900">
              Platform Metrics
            </h2>
            <PlatformMetricsSection />
          </div>
        </section>

        {/* Revenue & Credits */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-900">
              Revenue & Credits
            </h2>
            <RevenueCreditsSection />
          </div>
        </section>

        {/* Monthly Growth */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-900">
              Monthly Growth
            </h2>
            <MonthlyGrowthSection />
          </div>
        </section>

        {/* Weekly Growth */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-900">
              Weekly Growth
            </h2>
            <WeeklyGrowthSection />
          </div>
        </section>

        {/* What We Need */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-900">
              What We Need From Investors
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-gray-600 text-sm leading-relaxed space-y-6">
              <div>
                <h3 className="text-gray-900 font-semibold text-base mb-2">
                  $20K SAFE - $15K to cover 2026 fixed costs & $5K to accelerate sales growth
                </h3>
                <p>
                  We are raising a small round via a{" "}
                  <a
                    href="https://www.ycombinator.com/documents"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-900 underline decoration-gray-400 underline-offset-4 hover:decoration-gray-900"
                  >
                    SAFE (Simple Agreement for Future Equity)
                  </a>, the standard Y Combinator investment instrument. No valuation cap
                  negotiation needed upfront - your investment converts to equity at the
                  next priced round.
                </p>
              </div>
              <div>
                <h3 className="text-gray-900 font-semibold text-base mb-2">
                  $500K - to convince a risk-averse tech co-founder to join
                </h3>
                <p>
                  A larger raise to de-risk the opportunity for a technical co-founder.
                  With capital in the bank, we can offer a competitive package that makes
                  joining an early-stage startup a rational decision.
                </p>
              </div>
              <div>
                <h3 className="text-gray-900 font-semibold text-base mb-2">
                  Technical Co-Founder Introduction
                </h3>
                <p>
                  We are seeking a technical co-founder to join the team. Ideal profile:
                  full-stack software engineer. If you know someone who might be a fit,
                  please reach out.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Infrastructure */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-900">
              Infrastructure
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-gray-600 text-sm leading-relaxed space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 mb-1">Hosting</p>
                  <p className="text-gray-900">One Hetzner server, Docker Compose, Cloudflare in front</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Database</p>
                  <p className="text-gray-900">Postgres on the same server, one database per service</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Architecture</p>
                  <p className="text-gray-900">40+ services, DAG workflow orchestration</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Payments</p>
                  <p className="text-gray-900">Stripe and Revolut (usage-based, auto top-up)</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Auth</p>
                  <p className="text-gray-900">Clerk</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">AI Models</p>
                  <p className="text-gray-900">Multi-provider (Anthropic, OpenAI, Google)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="pb-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-display text-2xl font-bold mb-4 text-gray-900">
              Contact
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              For investor inquiries, please reach out to:
            </p>
            <a
              href="mailto:investors@distribute.you"
              className="inline-block bg-brand-500 hover:bg-brand-600 text-white font-medium px-6 py-3 rounded-lg transition"
            >
              investors@distribute.you
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer disclaimer="This page contains confidential information intended for prospective investors only." />
    </>
  );
}
