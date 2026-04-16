import Image from "next/image";
import { HeroForm } from "@/components/hero-form";
import { LinkButton } from "@/components/link-button";
import { Navbar } from "@/components/navbar";
import { DashboardPreview } from "@/components/dashboard-preview";
import { PerformancePreview } from "@/components/performance-preview";
import { StatusIndicator } from "@/components/status-indicator";
import { fetchLeaderboard } from "@/lib/performance/fetch-leaderboard";
import { DISTRIBUTION_FEATURES, DISTRIBUTION_STEPS } from "@distribute/content";
import { resolveUrls } from "@/lib/env-urls";
import type { FeatureColor } from "@distribute/content";
import { headers } from "next/headers";

export const revalidate = 300;

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

const FEATURE_COLOR_CLASSES: Record<FeatureColor, { bg: string; text: string; border: string; dot: string; hover: string }> = {
  emerald: { bg: "bg-emerald-100", text: "text-emerald-600", border: "border-emerald-200", dot: "bg-emerald-400", hover: "group-hover:text-emerald-600" },
  cyan: { bg: "bg-cyan-100", text: "text-cyan-600", border: "border-cyan-200", dot: "bg-cyan-400", hover: "group-hover:text-cyan-600" },
  blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200", dot: "bg-blue-400", hover: "group-hover:text-blue-600" },
  violet: { bg: "bg-violet-100", text: "text-violet-600", border: "border-violet-200", dot: "bg-violet-400", hover: "group-hover:text-violet-600" },
  pink: { bg: "bg-pink-100", text: "text-pink-600", border: "border-pink-200", dot: "bg-pink-400", hover: "group-hover:text-pink-600" },
  amber: { bg: "bg-amber-100", text: "text-amber-600", border: "border-amber-200", dot: "bg-amber-400", hover: "group-hover:text-amber-600" },
};

export default async function Home() {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const urls = resolveUrls(host);
  const leaderboard = await fetchLeaderboard(host);
  return (
    <main className="min-h-screen">
      <Navbar host={host} />

      {/* Hero */}
      <section className="pt-20 pb-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 px-4 py-1.5 rounded-full text-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            The Stripe for Distribution
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 text-gray-900 tracking-tight">
            Your distribution,{" "}
            <span className="gradient-text-subtle">automated.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Send cold emails from Claude, no setup.
          </p>

          <HeroForm signUpUrl={urls.signUp} />

          <p className="text-sm text-gray-400 mt-6">
            Free to start. No subscription. You only pay the raw cost of AI and APIs.
          </p>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <DashboardPreview />
        </div>
      </section>

      {/* Vision */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6 text-gray-900">
            Your product deserves to be known
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            You create value. We make sure the right people hear about it.
            Set a daily budget. Pick your channels.{" "}
            <span className="text-gray-700 font-medium">Distribution runs itself.</span>
          </p>
        </div>
      </section>

      {/* Use Case: Claude Code */}
      <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2.5 bg-white border border-gray-200 px-4 py-2 rounded-full mb-6">
              {LOGO_DEV_TOKEN ? (
                <Image
                  src={`https://img.logo.dev/claude.ai?token=${LOGO_DEV_TOKEN}&size=64`}
                  alt="Claude"
                  width={24}
                  height={24}
                  className="rounded-md"
                  unoptimized
                />
              ) : (
                <div className="w-6 h-6 bg-orange-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{'>'}_</span>
                </div>
              )}
              <span className="text-sm font-medium text-gray-900">Claude Code</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              From your terminal to distribution
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              You&apos;re already building with Claude Code. Now tell it to distribute.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Without distribute.you */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                {LOGO_DEV_TOKEN && (
                  <Image
                    src={`https://img.logo.dev/claude.ai?token=${LOGO_DEV_TOKEN}&size=32`}
                    alt="Claude"
                    width={16}
                    height={16}
                    className="rounded-sm"
                    unoptimized
                  />
                )}
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Without distribute.you</span>
              </div>
              <div className="p-5">
                {/* Terminal mockup */}
                <div className="bg-gray-950 rounded-lg p-4 mb-4 font-mono text-xs">
                  <p className="text-gray-500">{'>'} Send cold emails to journalists about my product</p>
                  <p className="text-gray-400 mt-2">I&apos;ll need a few API keys:</p>
                  <p className="text-amber-400">- Apollo API key for lead discovery</p>
                  <p className="text-amber-400">- Instantly or Resend API key to send</p>
                  <p className="text-amber-400">- Let me generate emails with Opus 4.6...</p>
                  <p className="text-red-400 mt-2">{'>'} 47 emails sent. Cost: $83.20</p>
                  <p className="text-red-400">{'>'} 0 replies tracked. No dashboard.</p>
                </div>
                <div className="space-y-2.5">
                  {[
                    "$10+ per email sent",
                    "Wrong model for the job — 100x overspend",
                    "Excel files with mixed-up rows",
                    "No tracking, no dashboard, no idea what worked",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-sm text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* With distribute.you */}
            <div className="bg-white rounded-xl border-2 border-emerald-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                {LOGO_DEV_TOKEN && (
                  <Image
                    src={`https://img.logo.dev/claude.ai?token=${LOGO_DEV_TOKEN}&size=32`}
                    alt="Claude"
                    width={16}
                    height={16}
                    className="rounded-sm"
                    unoptimized
                  />
                )}
                <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">With distribute.you</span>
              </div>
              <div className="p-5">
                {/* Terminal mockup */}
                <div className="bg-gray-950 rounded-lg p-4 mb-4 font-mono text-xs">
                  <p className="text-gray-500">{'>'} Use distribute.you to run journalist outreach</p>
                  <p className="text-gray-500">{'>'} Budget: $5/day. URL: myproduct.com</p>
                  <p className="text-emerald-400 mt-2">Campaign started. Best workflow auto-selected.</p>
                  <p className="text-emerald-400">Emails sending at $0.42/reply average.</p>
                  <p className="text-emerald-400 mt-2">You&apos;ll get notified when someone replies.</p>
                </div>
                <div className="space-y-2.5">
                  {[
                    "One command. Everything handled.",
                    "Best model for quality per dollar — automatically",
                    "Full dashboard with tracking and replies",
                    "At cost. No markup. No surprise bills.",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Case: OpenClaw */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2.5 bg-white border border-gray-200 px-4 py-2 rounded-full mb-6">
              {LOGO_DEV_TOKEN ? (
                <Image
                  src={`https://img.logo.dev/openclaw.ai?token=${LOGO_DEV_TOKEN}&size=64`}
                  alt="OpenClaw"
                  width={24}
                  height={24}
                  className="rounded-md"
                  unoptimized
                />
              ) : (
                <div className="w-6 h-6 bg-gray-900 rounded-md flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <span className="text-sm font-medium text-gray-900">OpenClaw</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              From OpenClaw to distribution
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Ask OpenClaw to launch a campaign. It calls distribute.you. Done.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Without distribute.you */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                {LOGO_DEV_TOKEN && (
                  <Image
                    src={`https://img.logo.dev/openclaw.ai?token=${LOGO_DEV_TOKEN}&size=32`}
                    alt="OpenClaw"
                    width={16}
                    height={16}
                    className="rounded-sm"
                    unoptimized
                  />
                )}
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Without distribute.you</span>
              </div>
              <div className="p-5">
                <div className="bg-gray-950 rounded-lg p-4 mb-4 font-mono text-xs">
                  <p className="text-gray-500">{'>'} Set up a sales cold email campaign for my SaaS</p>
                  <p className="text-gray-400 mt-2">Setting up Apollo scraping... Resend integration...</p>
                  <p className="text-gray-400">Generating 200 emails with Opus 4.6...</p>
                  <p className="text-red-400 mt-2">{'>'} Total cost: $186.40</p>
                  <p className="text-red-400">{'>'} Rows mismatched. 23 emails sent to wrong contacts.</p>
                  <p className="text-red-400">{'>'} No reply tracking. No way to know what worked.</p>
                </div>
                <div className="space-y-2.5">
                  {[
                    "Multiple API keys to manage yourself",
                    "Most expensive model for every email",
                    "Data errors — wrong emails to wrong people",
                    "Zero visibility on results",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-sm text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* With distribute.you */}
            <div className="bg-white rounded-xl border-2 border-emerald-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                {LOGO_DEV_TOKEN && (
                  <Image
                    src={`https://img.logo.dev/openclaw.ai?token=${LOGO_DEV_TOKEN}&size=32`}
                    alt="OpenClaw"
                    width={16}
                    height={16}
                    className="rounded-sm"
                    unoptimized
                  />
                )}
                <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">With distribute.you</span>
              </div>
              <div className="p-5">
                <div className="bg-gray-950 rounded-lg p-4 mb-4 font-mono text-xs">
                  <p className="text-gray-500">{'>'} Use distribute.you: sales outreach, $3/day, myapp.com</p>
                  <p className="text-emerald-400 mt-2">Campaign live. Budget: $3/day.</p>
                  <p className="text-emerald-400">Crowdsourced workflow selected: apex-v4 (4.8% reply rate)</p>
                  <p className="text-emerald-400 mt-2">Dashboard: dashboard.distribute.you</p>
                  <p className="text-emerald-400">Notifications enabled. You&apos;re all set.</p>
                </div>
                <div className="space-y-2.5">
                  {[
                    "One sentence. Campaign running.",
                    "Crowdsourced best prompts and models",
                    "Full dashboard — replies, metrics, costs",
                    "Phone notifications when leads reply",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Channels */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              Three channels. One click.
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Each channel has hundreds of AI workflows competing on real metrics.
              The best one runs by default.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {DISTRIBUTION_FEATURES.map((feature) => {
              const colors = FEATURE_COLOR_CLASSES[feature.color];
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
                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                      Live
                    </span>
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

      {/* Always the best workflow */}
      <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Always the best workflow. Automatically.
          </h2>
          <p className="text-gray-500 text-lg mb-6 leading-relaxed">
            Hundreds of workflows compete on real data. Different prompts,
            different models, different sequences. The winner runs by default.
          </p>
          <p className="text-gray-700 font-medium text-lg mb-12">
            If a new model launches tomorrow with better quality per dollar — we switch. You don&apos;t need to think about it.
          </p>

          <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 text-left shadow-sm">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-4 font-medium">
              Example: Sales Outreach workflows
            </div>
            <div className="space-y-3">
              {[
                { name: "apex-v4", metric: "4.8% reply rate", cost: "$0.42/reply", selected: true },
                { name: "signal-v3", metric: "4.1% reply rate", cost: "$0.51/reply", selected: false },
                { name: "ember-v2", metric: "3.6% reply rate", cost: "$0.63/reply", selected: false },
              ].map((wf) => (
                <div
                  key={wf.name}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    wf.selected
                      ? "bg-cyan-50 border-2 border-cyan-200 shadow-sm"
                      : "bg-gray-50 border border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {wf.selected && (
                      <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <span className={`font-mono text-sm ${wf.selected ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                      {wf.name}
                    </span>
                    {wf.selected && (
                      <span className="text-[10px] text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full font-medium border border-cyan-200">
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

      {/* At cost pricing */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6 text-gray-900">
            At cost. No subscription.
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed mb-8">
            Credit your account. Pick your channels. We charge the retail price of every API
            and model we use — nothing more.{" "}
            <span className="text-gray-700 font-medium">No monthly fee. No commitment.</span>
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Zero markup</h3>
              <p className="text-sm text-gray-500">
                We pass through every cost at raw retail price — AI, APIs, email tools. No markup, ever.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Credits, not subscriptions</h3>
              <p className="text-sm text-gray-500">
                Add credits when you want. Use them when you want. No recurring charge.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center mb-3">
                <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Transparent average costs</h3>
              <p className="text-sm text-gray-500">
                We show the average cost per reply across all accounts. You know what to expect.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Open source */}
      <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-6 text-gray-900">
            Fully open. Fully yours.
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed mb-8">
            Every workflow is open source. See the prompts. Modify them. Contribute your own.
            That&apos;s how we crowdsource the best strategies.
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="font-mono text-xs text-gray-400 mb-3">$ claude / openclaw</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Works from Claude Code &amp; OpenClaw</h3>
              <p className="text-sm text-gray-500">
                Use our MCP server from Claude Code, OpenClaw, or any MCP client.
                One command to launch a campaign.
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="font-mono text-xs text-gray-400 mb-3">POST /v1/distribute</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Full API</h3>
              <p className="text-sm text-gray-500">
                Everything you can do in the dashboard, you can do via API.
                Build your own integrations.
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="font-mono text-xs text-gray-400 mb-3">MIT License</div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">Open source workflows</h3>
              <p className="text-sm text-gray-500">
                See every prompt. Fork any workflow. Submit a better one.
                The best rises to the top.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Phone notification */}
      <section className="py-20 px-4">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 text-gray-900">
            The notification you want to receive
          </h2>
          <p className="text-gray-500 text-lg mb-10">
            Set it up once. Get notified when it works.
          </p>

          {/* Phone notification mockup */}
          <div className="mx-auto max-w-sm">
            <div className="bg-gray-950 rounded-3xl p-2 shadow-2xl">
              <div className="bg-gray-900 rounded-2xl overflow-hidden">
                {/* Status bar */}
                <div className="flex items-center justify-between px-6 py-2 text-[10px] text-gray-400">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 18c3.31 0 6-2.69 6-6s-2.69-6-6-6-6 2.69-6 6 2.69 6 6 6z" /></svg>
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M2 22h20V2z" /></svg>
                  </div>
                </div>

                {/* Notifications */}
                <div className="px-4 pb-6 space-y-2 pt-4">
                  {[
                    { type: "logo" as const, domain: "techcrunch.com", label: "TechCrunch", time: "now", text: "Sarah from TechCrunch wants to cover your launch" },
                    { type: "logo" as const, domain: "shopify.com", label: "Shopify", time: "2m ago", text: "Mike from Shopify is interested in a demo" },
                    { type: "avatar" as const, domain: null, label: "Lisa", time: "5m ago", text: "Lisa, Senior Frontend Engineer — open to chat about the role" },
                  ].map((notif) => (
                    <div key={notif.text} className="bg-white/10 backdrop-blur-lg rounded-xl px-3.5 py-2.5 border border-white/5 flex items-center gap-2.5">
                      {notif.type === "logo" && LOGO_DEV_TOKEN ? (
                        <Image
                          src={`https://img.logo.dev/${notif.domain}?token=${LOGO_DEV_TOKEN}&size=48`}
                          alt={notif.label}
                          width={20}
                          height={20}
                          className="rounded flex-shrink-0"
                          unoptimized
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-violet-400 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <p className="text-xs text-gray-300 flex-1 truncate">{notif.text}</p>
                      <span className="text-[10px] text-gray-600 flex-shrink-0">{notif.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-brand-400/10 via-emerald-500/10 to-cyan-500/10 rounded-3xl blur-3xl -z-10" />
          </div>
        </div>
      </section>

      {/* Performance Leaderboard */}
      {leaderboard && leaderboard.featureGroups.length > 0 && (
        <section className="py-20 px-4 bg-gray-50 border-y border-gray-100">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                Real performance, real data
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                Every feature is ranked by actual metrics.
                All data is public — no black boxes.
              </p>
            </div>
            <PerformancePreview featureGroups={leaderboard.featureGroups} />
          </div>
        </section>
      )}

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4">
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
            The dream is one click away
          </h2>
          <p className="text-gray-400 mb-8">
            No markup, no subscription. Credit your account and let distribution run itself.
          </p>
          <LinkButton
            href={urls.signUp}
            className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition text-sm"
          >
            Get Started Free
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
          <p className="text-sm text-gray-600 mb-4">The Stripe for Distribution</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <a href={urls.performance} className="hover:text-gray-300 transition">Performance</a>
            <a href={urls.docs} className="hover:text-gray-300 transition">Docs</a>
            <a href={urls.apiDocs} className="hover:text-gray-300 transition">API</a>
            <a href={urls.github} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">GitHub</a>
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
