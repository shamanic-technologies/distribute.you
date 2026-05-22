import Image from "next/image";
import { Suspense } from "react";
import { HeroForm } from "@/components/hero-form";
import { LinkButton } from "@/components/link-button";
import { Navbar } from "@/components/navbar";
import { PortfolioDashboard } from "@/components/portfolio-dashboard";
import { GmailInbox } from "@/components/gmail-inbox";
import { FreeVsCloud } from "@/components/free-vs-cloud";
import { WorkflowRecipe } from "@/components/workflow-recipe";
import { ToolsMarquee } from "@/components/tools-marquee";
import { StatusIndicator } from "@/components/status-indicator";
import { LeaderboardSectionAsync } from "@/components/leaderboard-section-async";
import { LeaderboardPreviewSkeleton } from "@/components/leaderboard-preview-skeleton";
import { ExpertQuoteMosaic, expertQuoteJsonLd } from "@/components/expert-quote-mosaic";
import { ColdEmailPainStats } from "@/components/sourced-stats";
import { DISTRIBUTION_FEATURES, DISTRIBUTION_STEPS } from "@distribute/content";
import { PROD_URLS } from "@/lib/env-urls";
import type { FeatureColor } from "@distribute/content";

export const revalidate = 300;

const FEATURE_COLOR_CLASSES: Record<FeatureColor, { bg: string; text: string; border: string; dot: string; hover: string }> = {
  emerald: { bg: "bg-emerald-100", text: "text-emerald-600", border: "border-emerald-200", dot: "bg-emerald-400", hover: "group-hover:text-emerald-600" },
  cyan: { bg: "bg-cyan-100", text: "text-cyan-600", border: "border-cyan-200", dot: "bg-cyan-400", hover: "group-hover:text-cyan-600" },
  blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200", dot: "bg-blue-400", hover: "group-hover:text-blue-600" },
  violet: { bg: "bg-violet-100", text: "text-violet-600", border: "border-violet-200", dot: "bg-violet-400", hover: "group-hover:text-violet-600" },
  pink: { bg: "bg-pink-100", text: "text-pink-600", border: "border-pink-200", dot: "bg-pink-400", hover: "group-hover:text-pink-600" },
  amber: { bg: "bg-amber-100", text: "text-amber-600", border: "border-amber-200", dot: "bg-amber-400", hover: "group-hover:text-amber-600" },
};

const liveCount = DISTRIBUTION_FEATURES.filter((f) => f.status === "live").length;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is distribute?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "distribute is a pay-as-you-go cloud platform that runs cold email, PR, hiring, and other outbound channels on your behalf. You give us a URL and a daily budget; we send from agency-warmed inboxes, qualify replies with AI, and forward only the positive ones to your Gmail.",
      },
    },
    {
      "@type": "Question",
      name: "How much does distribute cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "$2 in welcome credits. No subscription. Every unit cost is published live at distribute.you/pricing — you pay the raw provider price plus a transparent margin. No hidden fees.",
      },
    },
    {
      "@type": "Question",
      name: "Can I run distribute myself?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every workflow is open source under MIT on GitHub. You can self-host with your own API keys, your own mailbox warmup, and your own infrastructure.",
      },
    },
    {
      "@type": "Question",
      name: "Which channels does distribute support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `${liveCount} channels are live today, including sales cold email, PR outreach, hiring cold email, VC outreach, journalist pitch, influencer pitch, podcast pitch, and Google Ads. More channels ship every month.`,
      },
    },
    {
      "@type": "Question",
      name: "What is the average cold email reply rate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Industry studies put the average B2B cold email reply rate at 3.43% in 2025 (TheDigitalBloom). Top-quartile campaigns reach 15–25% through tight ICP targeting and follow-up sequencing.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to warm up a cold mailbox?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "3 to 5 weeks of progressive sending before a cold inbox can safely run real outreach at 40 emails per day (Lemlist Warmup Guide, 2025). distribute uses pre-warmed agency inboxes so you skip this entirely.",
      },
    },
  ],
};

export default function Home() {
  const urls = PROD_URLS;

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {expertQuoteJsonLd().map((q, i) => (
        <script
          key={`quote-jsonld-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(q) }}
        />
      ))}

      <Navbar />

      {/* Hero */}
      <section className="pt-20 pb-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            The Stripe of Distribution
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 text-gray-900 tracking-tight">
            Your distribution,{" "}
            <span className="gradient-text-subtle">on autopilot.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Sales, PR, VCs, hiring, accelerators. Drop a URL, set a budget —
            we send, qualify, forward.
          </p>

          <HeroForm signUpUrl={urls.signUp} />

          <p className="text-sm text-gray-400 mt-6">
            $2 welcome credits. No subscription. No setup. We send on your behalf.
          </p>
        </div>
      </section>

      {/* Portfolio Dashboard — money shot */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <PortfolioDashboard />
        </div>
      </section>

      {/* Tools the builder lives in */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
              You live here. We meet you here.
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900">
              Built to slot into your stack
            </h2>
          </div>
          <ToolsMarquee />
        </div>
      </section>

      {/* Cold email pain — sourced industry stats (AI-search citation surface) */}
      <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
              The state of cold outbound in 2025
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Why distribution kills most solo products
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Independent benchmarks from Lemlist and TheDigitalBloom. Every number linked to source.
            </p>
          </div>
          <ColdEmailPainStats />
        </div>
      </section>

      {/* Stay solo. Go big. */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6 text-gray-900">
            Stay solo. <span className="gradient-text-subtle">Go big.</span>
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed mb-4">
            You ship 3 products a year. One of them is going to take off.
            Our job is to make sure it does — and to keep up with you when it does.
          </p>
          <p className="text-lg text-gray-700 font-medium leading-relaxed">
            Drop a URL. Set a daily budget per product. We send, AI-qualify replies,
            forward leads to your inbox. You watch cost per reply per product,
            double down on the winner, and ride the one that takes you from
            $0 to $1M MRR — solo.
          </p>
        </div>
      </section>

      {/* What you don't have to do */}
      <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              What you don&apos;t have to do
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Everything that wastes a builder&apos;s week. We handle it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              "Buy a sending domain",
              "Set up SPF / DKIM / DMARC",
              "Warm up mailboxes for 3–5 weeks",
              "Monitor bounces, blacklists, reputation",
              "Triage raw replies to find real leads",
              "Build a reply classifier yourself",
              "Wire Apollo + Resend + Claude into 4 services",
              "Track cost per reply per product × per channel by hand",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 bg-white rounded-lg p-4 border border-gray-200"
              >
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-600 mt-10 max-w-2xl mx-auto">
            All you do is add a URL and a budget.{" "}
            <span className="text-gray-900 font-medium">
              We send from an agency address on your behalf, AI qualifies the replies,
              and the good ones land in your Gmail.
            </span>
          </p>
        </div>
      </section>

      {/* Channels grid */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {liveCount} channels live. More every month.
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Each channel has hundreds of competing workflows.
              The cheapest one — by $/qualified reply — runs by default.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DISTRIBUTION_FEATURES.map((feature) => {
              const colors = FEATURE_COLOR_CLASSES[feature.color];
              const isLive = feature.status === "live";
              return (
                <div
                  key={feature.id}
                  className="bg-white rounded-xl p-5 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <h3 className={`font-semibold text-gray-900 ${colors.hover} transition`}>
                        {feature.title}
                      </h3>
                    </div>
                    {isLive ? (
                      <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                        Live
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3 leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Ranked by {feature.metric}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow recipe */}
      <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Workflows are priced recipes
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Every workflow combines a handful of priced API primitives.
              One run = sum of primitives. Each primitive listed publicly on{" "}
              <a href={urls.pricing} className="underline underline-offset-2 hover:text-gray-700">
                our pricing page
              </a>.
            </p>
          </div>
          <WorkflowRecipe />
        </div>
      </section>

      {/* Performance Leaderboard — Suspense streams in, hero/static above paint instantly */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Cost per positive reply, not vanity metrics
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Every workflow ranked by real cost per positive reply.
              All data is public — no black boxes.
            </p>
          </div>
          <Suspense fallback={<LeaderboardPreviewSkeleton />}>
            <LeaderboardSectionAsync />
          </Suspense>
        </div>
      </section>

      {/* What builders we look up to actually said — public quotes, AI-search citation surface */}
      <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
              Public quotes — not testimonials
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              What the builders we look up to actually said
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Every quote attributed and sourced. Click through to the original.
              This is the mindset behind distribute.
            </p>
          </div>
          <ExpertQuoteMosaic />
        </div>
      </section>

      {/* Gmail inbox — the email you want to read */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-gray-900">
            The email you want to read
          </h2>
          <p className="text-gray-500 text-lg">
            We send on your behalf. AI qualifies every reply. Only the gold lands
            in your Gmail — full thread, ready to reply directly.
          </p>
        </div>
        <GmailInbox />
      </section>

      {/* Pricing — single cloud plan */}
      <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Pay only for what you use.
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              We send, qualify, forward. You ship products.
            </p>
          </div>
          <FreeVsCloud signUpUrl={urls.signUp} />
        </div>
      </section>

      {/* Works from your stack — demoted Claude Code / MCP mention */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Works from your stack
          </h2>
          <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
            Dashboard, REST API, or MCP. Whatever you&apos;re building with.
          </p>
          <div className="grid md:grid-cols-3 gap-4 text-left">
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="font-mono text-xs text-gray-400 mb-2">app.distribute.you</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Dashboard</h3>
              <p className="text-sm text-gray-500">
                Add a product, pick channels, set a budget. We take it from there.
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="font-mono text-xs text-gray-400 mb-2">POST /v1/campaigns</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">REST API</h3>
              <p className="text-sm text-gray-500">
                Everything you can do in the dashboard, you can do via API.{" "}
                <a href={urls.apiDocs} className="text-gray-700 underline underline-offset-2">
                  Docs →
                </a>
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="font-mono text-xs text-gray-400 mb-2">$ claude / openclaw</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">MCP server</h3>
              <p className="text-sm text-gray-500">
                Use distribute from Claude Code, OpenClaw, or any MCP client.
                One sentence to launch a campaign.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-14 text-gray-900">
            Three steps. That&apos;s it.
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {DISTRIBUTION_STEPS.map((step) => (
              <div key={step.number} className="text-center">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-xl flex items-center justify-center font-display font-bold text-lg mx-auto mb-4">
                  {step.number}
                </div>
                <h3 className="font-display font-bold text-lg text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gray-900">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold mb-3 text-white">
            Start your portfolio
          </h2>
          <p className="text-gray-400 mb-8">
            $2 free credits to start. No subscription. No credit card to try.
          </p>
          <LinkButton
            href={urls.signUp}
            className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition text-sm"
          >
            Start free — $2 credits
          </LinkButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-500 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Image src="/logo-head.jpg" alt="distribute" width={24} height={24} className="rounded-lg" />
            <span className="font-display font-bold text-white text-lg">distribute</span>
            <span className="text-[10px] text-brand-400 font-medium bg-brand-500/10 px-1.5 py-0.5 rounded uppercase">beta</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">The Stripe of Distribution</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a href={urls.pricing} className="hover:text-gray-300 transition">Pricing</a>
            <a href={urls.performance} className="hover:text-gray-300 transition">Performance</a>
            <a href={urls.docs} className="hover:text-gray-300 transition">Docs</a>
            <a href={urls.apiDocs} className="hover:text-gray-300 transition">API</a>
            <a href={urls.github} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">GitHub</a>
            <a href="#" className="hover:text-gray-300 transition">Privacy</a>
            <a href="/investors" className="hover:text-gray-300 transition">Investor Information</a>
          </div>
          <div className="flex justify-center mt-5">
            <StatusIndicator />
          </div>
          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-600 mb-3">Also by our team</p>
            <div className="flex flex-wrap justify-center gap-4 text-xs">
              <a href="https://pressbeat.io" target="_blank" className="hover:text-gray-300 transition">PressBeat.io — Organic Press on Demand</a>
              <a href="https://growthagency.dev" target="_blank" className="hover:text-gray-300 transition">GrowthAgency.dev — Growth Agency for Humans</a>
              <a href="https://growthservice.org" target="_blank" className="hover:text-gray-300 transition">GrowthService.org — Increase AI Search Ranking</a>
            </div>
          </div>
          <p className="text-xs mt-4 text-gray-700">MIT License. Open Source.</p>
        </div>
      </footer>
    </main>
  );
}
