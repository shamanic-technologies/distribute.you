import { Suspense } from "react";
import { HeroForm } from "@/components/hero-form";
import { LinkButton } from "@/components/link-button";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { GmailInbox } from "@/components/gmail-inbox";
import { FreeVsCloud } from "@/components/free-vs-cloud";
import { ToolsMarquee } from "@/components/tools-marquee";
import { LeaderboardSectionAsync } from "@/components/leaderboard-section-async";
import { LeaderboardPreviewSkeleton } from "@/components/leaderboard-preview-skeleton";
import { ColdEmailPainStats } from "@/components/sourced-stats";
import { ProviderAvatar } from "@/components/provider-avatar";
import { PROD_URLS } from "@/lib/env-urls";

export const revalidate = 300;

// Cold-email-only "How it works" steps. Local to the home — the shared
// DISTRIBUTION_STEPS catalog still describes the full multi-channel product
// (consumed by README / investors / docs), but the public home sells one thing.
const COLD_EMAIL_STEPS = [
  {
    number: 1,
    title: "Add your URL",
    description:
      "We analyze your site, your brand, and your voice — then write cold emails that sound like you.",
  },
  {
    number: 2,
    title: "We find and email your buyers",
    description:
      "We find decision-makers at your target accounts, send from agency-warmed inboxes, and follow up automatically.",
  },
  {
    number: 3,
    title: "Set a daily budget",
    description:
      "$25 free to start. We send, qualify every reply with AI, and forward only the positive ones to your Gmail.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is distribute?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "distribute is a pay-as-you-go platform that runs cold email outreach on your behalf. You give us a URL and a daily budget; we find your buyers, write personalized cold emails, send from agency-warmed inboxes, qualify replies with AI, and forward only the positive ones to your Gmail.",
      },
    },
    {
      "@type": "Question",
      name: "How much does distribute cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "$25 in welcome credits. No subscription. Every unit cost is published live at distribute.you/pricing — you pay the raw provider price plus a transparent margin. No hidden fees.",
      },
    },
    {
      "@type": "Question",
      name: "Can I run distribute myself?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The cold email workflow is open source under MIT on GitHub. You can self-host with your own API keys, your own mailbox warmup, and your own infrastructure.",
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

      <Navbar />

      {/* Hero */}
      <section className="pt-20 pb-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            The Stripe of Cold Email
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 text-gray-900 tracking-tight">
            Cold Email Outreach,{" "}
            <span className="gradient-text-subtle">on Autopilot.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Client acquisition, done for you. We find your buyers, write personalized
            cold emails, send from warmed inboxes, and forward the replies worth
            reading — while you sleep.
          </p>

          <HeroForm signUpUrl={urls.signUp} />

          <p className="text-sm text-gray-400 mt-6">
            $25 welcome credits. No subscription. No setup. We send on your behalf.
          </p>
        </div>
      </section>

      {/* Gmail inbox — the email you want to read (money shot) */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-gray-900">
            The email you want to read
          </h2>
          <p className="text-gray-500 text-lg">
            We send on your behalf. AI qualifies every reply. Only the gold lands
            in your Gmail — full thread, ready to reply directly.
          </p>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <GmailInbox />
        </div>
      </section>

      {/* What you don't have to do */}
      <section className="py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              What you don&apos;t have to do
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Everything that makes cold email a full-time job. We handle it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              "Buy a sending domain",
              "Set up SPF / DKIM / DMARC",
              "Warm up mailboxes for 3–5 weeks",
              "Monitor bounces, blacklists, reputation",
              "Find and verify decision-maker emails",
              "Write a personalized email for every lead",
              "Triage raw replies to find real leads",
              "Wire Apollo + Resend + Claude into 4 services",
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

          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium">
              Under the hood
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {[
                { name: "Apollo", domain: "apollo.io" },
                { name: "Anthropic", domain: "anthropic.com" },
                { name: "Resend", domain: "resend.com" },
                { name: "OpenAI", domain: "openai.com" },
                { name: "Firecrawl", domain: "firecrawl.dev" },
                { name: "Perplexity", domain: "perplexity.ai" },
                { name: "Vercel", domain: "vercel.com" },
              ].map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1.5"
                >
                  <ProviderAvatar provider={p.name} providerDomain={p.domain} size={16} />
                  <span className="text-xs text-gray-700">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Industry stats — sourced (AI-search citation surface) */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">
              The state of cold email in 2026
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Why most cold email never gets read
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Independent benchmarks from Lemlist, Saleshandy, Adobe, and Gartner.
            </p>
          </div>
          <ColdEmailPainStats />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-14 text-gray-900">
            Three steps. That&apos;s it.
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {COLD_EMAIL_STEPS.map((step) => (
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

      {/* Performance Leaderboard — Suspense streams in, hero/static above paint instantly */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Cost per positive reply, not vanity metrics
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Every cold email campaign ranked by real cost per positive reply.
              All data is public — no black boxes.
            </p>
          </div>
          <Suspense fallback={<LeaderboardPreviewSkeleton />}>
            <LeaderboardSectionAsync />
          </Suspense>
        </div>
      </section>

      {/* Tools the builder lives in */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

      {/* Pricing — single cloud plan */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Pay only for what you use.
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              We send, qualify, forward. You close deals.
            </p>
          </div>
          <FreeVsCloud signUpUrl={urls.signUp} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-display text-3xl font-bold mb-3 text-white">
            Start your first campaign
          </h2>
          <p className="text-gray-400 mb-8">
            $25 free credits to start. No subscription. No credit card to try.
          </p>
          <LinkButton
            href={urls.signUp}
            className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition text-sm"
          >
            Start free — $25 credits
          </LinkButton>
        </div>
      </section>

      <Footer />
    </main>
  );
}
