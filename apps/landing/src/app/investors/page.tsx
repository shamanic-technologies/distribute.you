import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PROD_URLS } from "@/lib/env-urls";
import {
  BRAND_LOGO_URL,
  INVESTORS_OG_IMAGE_PATH,
  TWITTER_HANDLE,
} from "@/lib/seo";
import { DISTRIBUTION_FEATURES } from "@distribute/content";
import type { FeatureColor } from "@distribute/content";
import {
  CompanyOverviewSection,
  PlatformMetricsSection,
  RevenueCreditsSection,
  MonthlyGrowthSection,
  WeeklyGrowthSection,
} from "@/components/investors/data-sections";
import {
  CompanyOverviewSkeleton,
  PlatformMetricsSkeleton,
  RevenueCreditsSkeleton,
  MonthlyGrowthSkeleton,
  WeeklyGrowthSkeleton,
} from "@/components/investors/skeletons";

export const revalidate = 86400;

const FEATURE_DOT: Record<FeatureColor, string> = {
  emerald: "bg-emerald-400",
  cyan: "bg-cyan-400",
  blue: "bg-blue-400",
  violet: "bg-violet-400",
  pink: "bg-pink-400",
  amber: "bg-amber-400",
};

const liveFeatureCount = DISTRIBUTION_FEATURES.filter((f) => f.status === "live").length;
const comingSoonFeatureCount = DISTRIBUTION_FEATURES.filter(
  (f) => f.status === "coming-soon"
).length;

const INVESTORS_URL = `${PROD_URLS.landing}/investors`;
const PAGE_DESCRIPTION =
  "Live platform metrics, growth data, infrastructure, and SAFE-round details for distribute. Public investor page — updated on every load.";

export const metadata: Metadata = {
  title: "Investor Information",
  description: PAGE_DESCRIPTION,
  keywords: [
    "distribute investors",
    "distribute SAFE round",
    "distribute platform metrics",
    "distribute revenue",
    "cold email startup investors",
    "Y Combinator SAFE",
    "distribute growth metrics",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: INVESTORS_URL,
    siteName: "distribute Investors",
    title: "distribute — Investor Information",
    description: PAGE_DESCRIPTION,
    images: [{ url: INVESTORS_OG_IMAGE_PATH, width: 1200, height: 630, alt: "distribute Investor Information" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "distribute — Investor Information",
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
  name: "distribute",
  url: PROD_URLS.landing,
  logo: BRAND_LOGO_URL,
  image: BRAND_LOGO_URL,
  description: "The Stripe of Distribution — pay-as-you-go cloud platform for cold outbound channels.",
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
    { "@type": "ListItem", position: 1, name: "distribute", item: PROD_URLS.landing },
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
                alt="distribute"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <h1 className="font-display text-4xl font-bold">distribute</h1>
            </div>
            <p className="text-xl text-gray-400 mb-2">Investor Information</p>
            <p className="text-sm text-gray-600">
              Live data — updated on every page load
            </p>
          </div>
        </section>

        {/* Company Overview */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Company Overview
            </h2>
            <Suspense fallback={<CompanyOverviewSkeleton />}>
              <CompanyOverviewSection />
            </Suspense>
          </div>
        </section>

        {/* Product — Channels Catalog */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-2 text-gray-200">
              Product — {liveFeatureCount} Channels Live, {comingSoonFeatureCount} Coming
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Each channel is a priced outbound surface. Builders enable one or many,
              set a per-channel budget, and only pay for executions that run.
              At least one new channel ships per month. The Stripe-of-Distribution
              metaphor is literal: one payment method → 50+ payment methods over time.
            </p>

            <div className="grid md:grid-cols-2 gap-3">
              {DISTRIBUTION_FEATURES.map((feature) => {
                const isLive = feature.status === "live";
                return (
                  <div
                    key={feature.id}
                    className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600 transition"
                  >
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${FEATURE_DOT[feature.color]}`}
                        />
                        <h3 className="font-semibold text-white text-sm">
                          {feature.title}
                        </h3>
                      </div>
                      {isLive ? (
                        <span className="text-[10px] font-medium text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 flex-shrink-0">
                          Live
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 flex-shrink-0">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">
                      {feature.description}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                      Ranked by {feature.metric}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Who We Serve — ICP #1 */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-2 text-gray-200">
              Who We Serve — ICP #1
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              The Serial Builder. The single user persona we optimize the product, pricing, and roadmap for.
            </p>

            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-gray-300 text-sm leading-relaxed space-y-6">
              <blockquote className="border-l-2 border-brand-500/60 pl-4 italic text-gray-300">
                &quot;16-40 years old. CEO-founder, mostly solo. I always have several SaaS in bench.
                I have no time between newsletter, content, distribute.you campaigns, meetings,
                monitoring, replies, and refining the ICP of my own campaigns. I want someone close
                to me — founder reachable, bugs fixed fast, features shipped fast.&quot;
              </blockquote>

              <div className="rounded-lg bg-gradient-to-br from-brand-500/10 to-violet-500/10 border border-brand-500/30 p-4">
                <p className="text-[10px] uppercase tracking-wider text-brand-300 font-semibold mb-2">
                  The dream
                </p>
                <p className="text-gray-200 italic">
                  &quot;One of my products is going to take off. I need to monitor closely the
                  CAC because I am looking for my marketing channel to scale. distribute.you is
                  the lever that makes that math actionable — whether I stay 1 person or grow
                  to 10.&quot;
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Age</p>
                  <p className="text-white">16-40</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Status</p>
                  <p className="text-white">Solo CEO-founder, 1-3 ppl max</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Portfolio</p>
                  <p className="text-white">3-10 products active</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Monthly budget</p>
                  <p className="text-white">$50-$500 across products</p>
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold text-base mb-3">Time poverty</h3>
                <p className="text-gray-400 mb-2">No time between:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-300 marker:text-gray-600">
                  <li>Writing the newsletter</li>
                  <li>Producing content</li>
                  <li>Launching distribute.you campaigns across multiple products</li>
                  <li>Meetings these generate</li>
                  <li>Monitoring + qualified replies</li>
                  <li>Refining own workflows / templates / ICPs</li>
                </ul>
                <p className="text-gray-400 mt-3">
                  Buys <span className="text-white font-medium">time</span> and{" "}
                  <span className="text-white font-medium">leverage</span>, not a tool.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-white font-semibold text-base mb-3">Refuses</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 marker:text-red-500/60">
                    <li>Buying a sending domain</li>
                    <li>SPF / DKIM / DMARC setup</li>
                    <li>Warming mailboxes for 6 weeks</li>
                    <li>Triaging raw replies (spam vs lead)</li>
                    <li>Subscriptions ($99/mo × N products = impossible)</li>
                    <li>Lock-in / opaque pricing</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-base mb-3">Accepts</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-400 marker:text-emerald-500/60">
                    <li>Agency-style sender on his behalf</li>
                    <li>AI-qualified replies forwarded to Gmail</li>
                    <li>Public unit prices + 2x margin baked in</li>
                    <li>Pay-as-you-go credits, first 50 emails free</li>
                    <li>Multi-brand portfolio in one dashboard</li>
                    <li>Open source as a safety valve</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold text-base mb-3">North-star metric</h3>
                <p className="text-gray-300">
                  Real <span className="text-white font-medium">CAC</span> ($/qualified reply, $/paid conversion)
                  per product × per channel × per workflow. Kills losers under 4 weeks.
                  Scales winners 10x when CAC &lt; LTV/3.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold text-base mb-3">Founder proximity</h3>
                <p className="text-gray-300">
                  Wants the founder reachable. Twitter DM, GitHub issue, direct email —
                  all acceptable. Bug fixed fast, feature shipped fast, roadmap public.
                  No enterprise support, no ticketing system.
                </p>
              </div>

              <div>
                <h3 className="text-white font-semibold text-base mb-3">Catalog expectation</h3>
                <p className="text-gray-300">
                  A growing marketplace of channels. <span className="text-white font-medium">Stripe taken literally:</span>{" "}
                  1 payment method → 50+ payment methods over time. distribute.you ships
                  at least one new channel per month. See the full catalog in the{" "}
                  <span className="text-white font-medium">Product</span> section above.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Metrics */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Platform Metrics
            </h2>
            <Suspense fallback={<PlatformMetricsSkeleton />}>
              <PlatformMetricsSection />
            </Suspense>
          </div>
        </section>

        {/* Revenue & Credits */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Revenue & Credits
            </h2>
            <Suspense fallback={<RevenueCreditsSkeleton />}>
              <RevenueCreditsSection />
            </Suspense>
          </div>
        </section>

        {/* Monthly Growth */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Monthly Growth
            </h2>
            <Suspense fallback={<MonthlyGrowthSkeleton />}>
              <MonthlyGrowthSection />
            </Suspense>
          </div>
        </section>

        {/* Weekly Growth */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Weekly Growth
            </h2>
            <Suspense fallback={<WeeklyGrowthSkeleton />}>
              <WeeklyGrowthSection />
            </Suspense>
          </div>
        </section>

        {/* What We Need */}
        <section className="pb-12">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              What We Need From Investors in May 2026
            </h2>
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-gray-300 text-sm leading-relaxed space-y-6">
              <div>
                <h3 className="text-white font-semibold text-base mb-2">
                  $20K SAFE - $15K to cover 2026 fixed costs & $5K to accelerate sales growth
                </h3>
                <p>
                  We are raising a small round via a{" "}
                  <a
                    href="https://www.ycombinator.com/documents"
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline decoration-gray-500 underline-offset-4 hover:decoration-white"
                  >
                    SAFE (Simple Agreement for Future Equity)
                  </a>, the standard Y Combinator investment instrument. No valuation cap
                  negotiation needed upfront - your investment converts to equity at the
                  next priced round.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold text-base mb-2">
                  $500K - to convince a risk-averse tech co-founder to join
                </h3>
                <p>
                  A larger raise to de-risk the opportunity for a technical co-founder.
                  With capital in the bank, we can offer a competitive package that makes
                  joining an early-stage startup a rational decision.
                </p>
              </div>
              <div>
                <h3 className="text-white font-semibold text-base mb-2">
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
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Infrastructure
            </h2>
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 text-gray-300 text-sm leading-relaxed space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 mb-1">Hosting</p>
                  <p className="text-white">Railway (backend), Vercel (frontend)</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Database</p>
                  <p className="text-white">Neon Postgres (27 databases)</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Architecture</p>
                  <p className="text-white">27 microservices, DAG workflow orchestration</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Payments</p>
                  <p className="text-white">Stripe (credit top-ups, no subscriptions)</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">Auth</p>
                  <p className="text-white">Clerk</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-1">AI Models</p>
                  <p className="text-white">Multi-provider (Anthropic, OpenAI, Google)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="pb-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-display text-2xl font-bold mb-4 text-gray-200">
              Contact
            </h2>
            <p className="text-gray-400 text-sm mb-6">
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
