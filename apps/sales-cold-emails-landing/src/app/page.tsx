import Image from "next/image";
import {
  URLS,
  SALES_FEATURES,
  SALES_STEPS,
  SALES_FAQ,
  SALES_PRICING_TIERS,
  BYOK_COST_ESTIMATES,
} from "@mcpfactory/content";

export const revalidate = 300;

interface HeroStats {
  bestCostPerOpen: { brandDomain: string | null; costPerOpenCents: number } | null;
  bestCostPerReply: { brandDomain: string | null; costPerReplyCents: number } | null;
}

function formatCostCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function getHeroStats(): Promise<HeroStats | null> {
  try {
    const url = process.env.PERFORMANCE_API_URL || URLS.performance;
    const res = await fetch(`${url}/api/leaderboard`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.hero || null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const heroStats = await getHeroStats();
  return (
    <main className="min-h-screen">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="https://mcpfactory.org/logo-head.jpg"
              alt="MCP Factory"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="font-bold text-xl text-primary-600">Sales Cold Emails</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-primary-600 text-sm transition hidden sm:flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
            <a
              href={`${URLS.docs}/sales-outreach`}
              className="text-gray-600 hover:text-primary-600 text-sm transition hidden sm:block"
            >
              Docs
            </a>
            <a
              href={URLS.signIn}
              className="text-gray-600 hover:text-primary-600 text-sm font-medium transition"
            >
              Sign In
            </a>
            <a
              href={URLS.signUp}
              className="bg-primary-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-600 shadow-md"
            >
              Start Free
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="gradient-bg py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <a
            href={URLS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-6 hover:bg-gray-800 transition"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            100% Open Source
          </a>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="gradient-text">Sales Cold Emails</span>
            <br />
            <span className="text-gray-800">That Actually Work</span>
          </h1>
          <p className="text-xl text-gray-600 mb-4 max-w-2xl mx-auto">
            <span className="font-semibold text-primary-600">Done For You</span>, with{" "}
            <span className="font-semibold text-accent-600">Your Own API Keys</span>.
          </p>
          <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
            You give us your URL + target audience. We handle lead finding, email generation,
            sending, and optimization. Works with ChatGPT, Claude, and Cursor.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a
              href={URLS.signUp}
              className="px-8 py-4 bg-primary-500 text-white rounded-full hover:bg-primary-600 font-medium text-lg shadow-lg"
            >
              Start Free
            </a>
            <a
              href={URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-full hover:border-gray-300 font-medium"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              View on GitHub
            </a>
          </div>

          <p className="text-sm text-gray-500">
            500 free emails • No credit card • MIT License
          </p>
        </div>
      </section>

      {/* Open Source Banner */}
      <section className="py-8 px-4 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <div>
              <p className="font-bold">100% Open Source</p>
              <p className="text-gray-400 text-sm">MIT License • Self-host or use our cloud</p>
            </div>
          </div>
          <a
            href={URLS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 bg-white text-gray-900 rounded-full font-medium hover:bg-gray-100 text-sm"
          >
            Star on GitHub
          </a>
        </div>
      </section>

      {/* Live Performance Stats */}
      {heroStats && (heroStats.bestCostPerOpen || heroStats.bestCostPerReply) && (
        <section className="py-12 px-4 bg-gradient-to-b from-white to-primary-50 border-b border-primary-100">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Real Performance Data</p>
            <h2 className="text-2xl font-bold mb-8 text-gray-800">
              100% Transparent Results
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-6">
              <div className="bg-white rounded-xl p-6 border border-primary-200 shadow-sm">
                <p className="text-4xl font-bold text-primary-500 mb-1">
                  {heroStats.bestCostPerOpen ? formatCostCents(heroStats.bestCostPerOpen.costPerOpenCents) : "TBD"}
                </p>
                <p className="text-sm text-gray-600 mb-1">Best $/Open</p>
                {heroStats.bestCostPerOpen?.brandDomain && (
                  <p className="text-xs text-gray-400">{heroStats.bestCostPerOpen.brandDomain}</p>
                )}
              </div>
              <div className="bg-white rounded-xl p-6 border border-accent-200 shadow-sm">
                <p className="text-4xl font-bold text-accent-500 mb-1">
                  {heroStats.bestCostPerReply ? formatCostCents(heroStats.bestCostPerReply.costPerReplyCents) : "TBD"}
                </p>
                <p className="text-sm text-gray-600 mb-1">Best $/Reply</p>
                {heroStats.bestCostPerReply?.brandDomain && (
                  <p className="text-xs text-gray-400">{heroStats.bestCostPerReply.brandDomain}</p>
                )}
              </div>
            </div>
            <a
              href={URLS.performance}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium transition"
            >
              See full leaderboard &rarr;
            </a>
          </div>
        </section>
      )}

      {/* DFY + BYOK */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-800">
            What makes us different?
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl p-6 border border-primary-100">
              <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-4 border border-primary-200">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="font-bold text-xl mb-2 text-gray-800">Done For You</h3>
              <p className="text-gray-600 mb-4">
                Competitors give you tools. We do the work.
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>You say: <span className="font-mono bg-white/80 px-2 py-0.5 rounded text-primary-700">&quot;Target CTOs at SaaS companies&quot;</span></p>
                <p>We: Find leads → Generate emails → Send → Optimize → Report</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-accent-50 to-purple-50 rounded-2xl p-6 border border-accent-100">
              <div className="w-14 h-14 bg-accent-100 rounded-xl flex items-center justify-center mb-4 border border-accent-200">
                <span className="text-3xl">🔑</span>
              </div>
              <h3 className="font-bold text-xl mb-2 text-gray-800">Bring Your Own Keys</h3>
              <p className="text-gray-600 mb-4">
                Use your own API keys. Pay only for what you use.
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>{BYOK_COST_ESTIMATES.totalPerEmail} (Apollo + Anthropic)</p>
                <p>No hidden markups. Full transparency.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">
              Everything You Need for Cold Email
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From lead finding to meeting booking. Fully automated.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {SALES_FEATURES.map((feature) => (
              <div key={feature.title} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="font-bold text-lg mb-2 text-gray-800">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">
              Send Your First Campaign in 5 Minutes
            </h2>
            <p className="text-xl text-gray-600">
              No complex setup. Just connect and go.
            </p>
          </div>

          <div className="space-y-12">
            {SALES_STEPS.map((step) => (
              <div key={step.number} className="flex gap-6">
                <div className="w-12 h-12 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-lg shrink-0 shadow-md">
                  {step.number}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-xl mb-2 text-gray-800">{step.title}</h3>
                  <p className="text-gray-600 mb-2">{step.description}</p>
                  {step.code && (
                    <code className="text-sm bg-gray-100 text-primary-700 px-3 py-1.5 rounded-lg block overflow-x-auto">
                      {step.code}
                    </code>
                  )}
                  {step.example && (
                    <p className="text-gray-500 italic bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                      {step.example}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">
              Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600">
              Start for free, then scale as you grow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SALES_PRICING_TIERS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 ${
                  plan.popular
                    ? "bg-primary-500 text-white shadow-lg ring-2 ring-primary-500"
                    : "bg-white border border-gray-200"
                }`}
              >
                {plan.popular && (
                  <div className="text-xs font-medium text-primary-200 mb-2">Most Popular</div>
                )}
                <h3 className={`font-bold text-xl mb-1 ${plan.popular ? "text-white" : "text-gray-800"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.popular ? "text-primary-100" : "text-gray-500"}`}>
                  {plan.description}
                </p>
                <div className={`text-3xl font-bold mb-1 ${plan.popular ? "text-white" : "text-gray-800"}`}>
                  ${plan.price}
                  <span className={`text-sm font-normal ${plan.popular ? "text-primary-200" : "text-gray-500"}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`text-sm mb-6 ${plan.popular ? "text-primary-100" : "text-gray-500"}`}>
                  {plan.emails} emails
                </p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className={`text-sm flex items-center gap-2 ${plan.popular ? "text-white" : "text-gray-600"}`}>
                      <span className={plan.popular ? "text-primary-200" : "text-green-500"}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href={URLS.signUp}
                  className={`block text-center py-2 px-4 rounded-full font-medium text-sm ${
                    plan.popular
                      ? "bg-white text-primary-600 hover:bg-primary-50"
                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-gray-500 mt-8 text-sm">
            + BYOK costs: Apollo ({BYOK_COST_ESTIMATES.apolloPerLead}) + Anthropic ({BYOK_COST_ESTIMATES.anthropicPerEmail})
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-6">
            {SALES_FAQ.map((item) => (
              <div key={item.question} className="border border-gray-200 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-2 text-gray-800">{item.question}</h3>
                <p className="text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 gradient-bg">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800">
            Ready to Send Better Cold Emails?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Start with 500 free emails. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={URLS.signUp}
              className="inline-block px-8 py-4 bg-primary-500 text-white rounded-full hover:bg-primary-600 font-medium text-lg shadow-lg"
            >
              Start Free
            </a>
            <a
              href={URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-full hover:bg-gray-800 font-medium text-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image
              src="https://mcpfactory.org/logo-head.jpg"
              alt="MCP Factory"
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="font-bold text-white text-lg">MCP Factory</span>
          </div>
          <p className="text-sm mb-4">Open-source cold email automation</p>
          <div className="flex justify-center gap-6 text-sm">
            <a href={URLS.landing} className="hover:text-primary-400 transition">
              Main Site
            </a>
            <a href={URLS.docs} className="hover:text-primary-400 transition">
              Docs
            </a>
            <a
              href={URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-400 transition"
            >
              GitHub
            </a>
          </div>
          <p className="text-xs mt-6">© 2025 MCP Factory. MIT License. 100% Open Source.</p>
        </div>
      </footer>
    </main>
  );
}
