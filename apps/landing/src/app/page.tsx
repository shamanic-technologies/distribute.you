import { WaitlistForm } from "@/components/waitlist-form";
import { Navbar } from "@/components/navbar";
import { DashboardPreview } from "@/components/dashboard-preview";
import { StatusIndicator } from "@/components/status-indicator";
import { LinkButton } from "@/components/link-button";
import { URLS, DISTRIBUTION_FEATURES, DISTRIBUTION_STEPS } from "@mcpfactory/content";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-20 pb-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
            The Stripe for Distribution
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 text-gray-900 tracking-tight">
            Your distribution,{" "}
            <span className="gradient-text-subtle">automated.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create an account. Give us your URL. We handle welcome emails,
            outreach campaigns, webinar flows, and every touchpoint in
            between.{" "}
            <span className="text-gray-700 font-medium">
              Powered by AI workflows ranked by real performance data.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <LinkButton
              href={URLS.signUp}
              className="px-8 py-3.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium text-base shadow-sm transition"
            >
              Get Early Access
            </LinkButton>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center px-6 py-3.5 text-gray-600 hover:text-gray-900 font-medium text-base transition"
            >
              See how it works
              <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </a>
          </div>

          <p className="text-sm text-gray-400">
            Free to start. You only pay for the AI costs.
          </p>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <DashboardPreview />
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6 text-gray-900">
            Built for builders who hate marketing
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed mb-8">
            You&apos;re great at building products. You shouldn&apos;t need to spend time
            crafting welcome emails, setting up drip campaigns, or managing
            outreach sequences.
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Zero configuration</h3>
              <p className="text-sm text-gray-500">
                We read your URL, understand your brand, and generate everything automatically.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="w-8 h-8 bg-secondary-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Data-driven defaults</h3>
              <p className="text-sm text-gray-500">
                The best-performing workflow runs by default. Optimized across thousands of accounts.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="w-8 h-8 bg-accent-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Pay only for AI</h3>
              <p className="text-sm text-gray-500">
                No platform markup. You pay the raw AI cost. Full transparency on every dollar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Categories */}
      <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              One platform, every touchpoint
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Each feature has hundreds of AI workflows competing on real metrics.
              The best one runs by default.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DISTRIBUTION_FEATURES.map((feature) => (
              <div
                key={feature.id}
                className="bg-white rounded-xl p-5 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition">
                    {feature.title}
                  </h3>
                  {feature.status === "live" ? (
                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                      Live
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                      Soon
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
            ))}
          </div>
        </div>
      </section>

      {/* How Workflows Work */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Thousands of workflows. One winner.
          </h2>
          <p className="text-gray-500 text-lg mb-6 leading-relaxed">
            Every distribution feature runs on AI workflows. Each workflow is a
            different approach — different prompts, different sequences, different
            timing. We rank them by real performance data and the best one runs
            by default.
          </p>
          <p className="text-gray-700 font-medium text-lg mb-12">
            Done is better than perfect. You don&apos;t configure anything.
          </p>

          <div className="bg-gray-50 rounded-2xl p-6 md:p-8 border border-gray-100 text-left">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-4 font-medium">
              Example: Welcome Email workflows
            </div>
            <div className="space-y-3">
              {[
                { name: "aurora-v3", metric: "34.2% open rate", cost: "$0.03/open", selected: true },
                { name: "nova-v2", metric: "31.8% open rate", cost: "$0.04/open", selected: false },
                { name: "sienna-v1", metric: "28.5% open rate", cost: "$0.05/open", selected: false },
              ].map((wf) => (
                <div
                  key={wf.name}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    wf.selected
                      ? "bg-white border-2 border-primary-200 shadow-sm"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {wf.selected && (
                      <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <span className={`font-mono text-sm ${wf.selected ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {wf.name}
                    </span>
                    {wf.selected && (
                      <span className="text-[10px] text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full font-medium">
                        Auto-selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className={wf.selected ? "text-gray-900 font-medium" : "text-gray-400"}>
                      {wf.metric}
                    </span>
                    <span className="text-gray-400">{wf.cost}</span>
                  </div>
                </div>
              ))}
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

      {/* Use case example */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900">
            Like having a growth team on autopilot
          </h2>
          <p className="text-gray-500 text-lg text-center mb-12">
            Here&apos;s what happens when you enable &ldquo;Welcome Emails&rdquo; for your SaaS.
          </p>

          <div className="space-y-4">
            {[
              {
                step: "Brand Service",
                desc: "Reads your URL, extracts your brand voice, colors, and messaging.",
                detail: "acme.com → modern, B2B SaaS, blue palette, professional tone",
              },
              {
                step: "Content Generation",
                desc: "Drafts a welcome email template matching your brand.",
                detail: "Subject: \"Welcome to Acme — here's what to do first\"",
              },
              {
                step: "Auto-trigger",
                desc: "Fires automatically when a new user signs up.",
                detail: "Webhook: user.created → send welcome email",
              },
              {
                step: "Metrics",
                desc: "We track open rates, clicks, and optimize continuously.",
                detail: "34.2% open rate — top 10% across all accounts",
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-px bg-gray-200 ml-3 flex-shrink-0 hidden md:block" style={{ minHeight: '100%' }} />
                <div className="bg-white rounded-xl p-5 border border-gray-200 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary-400" />
                    <h4 className="font-semibold text-gray-900 text-sm">{item.step}</h4>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{item.desc}</p>
                  <p className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-1.5 rounded-md">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="py-20 px-4 bg-gray-900">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-3xl font-bold mb-3 text-white">
            Get early access
          </h2>
          <p className="text-gray-400 mb-8">
            Be the first to automate your distribution. Early access includes lifetime pricing.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-gray-500 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="font-display font-bold text-white text-lg">distribute</span>
            <span className="text-[10px] text-primary-400 font-medium bg-primary-500/10 px-1.5 py-0.5 rounded">.eu</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">The Stripe for Distribution</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a href={URLS.docs} className="hover:text-gray-300 transition">Docs</a>
            <a href={URLS.github} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">GitHub</a>
            <a href="#" className="hover:text-gray-300 transition">Privacy</a>
          </div>
          <div className="flex justify-center mt-5">
            <StatusIndicator />
          </div>
          <p className="text-xs mt-4 text-gray-700">MIT License. Open Source.</p>
        </div>
      </footer>
    </main>
  );
}
