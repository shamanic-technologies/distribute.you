import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Navbar } from "@/components/navbar";
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

export const metadata: Metadata = {
  title: "Investor Information",
  description:
    "Live platform metrics and company information for distribute investors.",
  robots: { index: false, follow: false },
};

async function ResolvedNavbar() {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  return <Navbar host={host} />;
}

export default function InvestorsPage() {
  return (
    <>
      <Suspense fallback={<div className="h-16" />}>
        <ResolvedNavbar />
      </Suspense>
      <main className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <section className="pt-24 pb-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Image
                src="/logo-head.jpg"
                alt="distribute"
                width={40}
                height={40}
                className="rounded-xl"
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
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Company Overview
            </h2>
            <Suspense fallback={<CompanyOverviewSkeleton />}>
              <CompanyOverviewSection />
            </Suspense>
          </div>
        </section>

        {/* Platform Metrics */}
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Platform Metrics
            </h2>
            <Suspense fallback={<PlatformMetricsSkeleton />}>
              <PlatformMetricsSection />
            </Suspense>
          </div>
        </section>

        {/* Revenue & Credits */}
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Revenue & Credits
            </h2>
            <Suspense fallback={<RevenueCreditsSkeleton />}>
              <RevenueCreditsSection />
            </Suspense>
          </div>
        </section>

        {/* Monthly Growth */}
        <section className="pb-12 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Monthly Growth
            </h2>
            <Suspense fallback={<MonthlyGrowthSkeleton />}>
              <MonthlyGrowthSection />
            </Suspense>
          </div>
        </section>

        {/* Weekly Growth */}
        <section className="pb-12 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-6 text-gray-200">
              Weekly Growth
            </h2>
            <Suspense fallback={<WeeklyGrowthSkeleton />}>
              <WeeklyGrowthSection />
            </Suspense>
          </div>
        </section>

        {/* What We Need */}
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
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
        <section className="pb-12 px-4">
          <div className="max-w-4xl mx-auto">
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
        <section className="pb-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
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
      <footer className="bg-gray-900 text-gray-400 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center text-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Image
              src="/logo-head.jpg"
              alt="distribute"
              width={20}
              height={20}
              className="rounded"
            />
            <a href="/" className="hover:text-brand-400 transition">
              distribute
            </a>
            <span>--</span>
            <span>The Stripe of Distribution</span>
          </div>
          <p className="text-xs text-gray-600">
            This page contains confidential information intended for prospective
            investors only.
          </p>
        </div>
      </footer>
    </>
  );
}
