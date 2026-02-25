import Image from "next/image";
import { WaitlistForm } from "@/components/waitlist-form";

import { LinkButton } from "@/components/link-button";
import { StatusIndicator } from "@/components/status-indicator";
import { Navbar } from "@/components/navbar";
import { URLS, WORKFLOW_DEFINITIONS, LANDING_PRICING, SUPPORTED_CLIENTS } from "@mcpfactory/content";

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
      <Navbar />

      {/* Hero */}
      <section className="gradient-bg py-16 md:py-24 px-4 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="text-center md:text-left">
              <div className="inline-block bg-primary-100 text-primary-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-primary-200">
                100% Open Source
              </div>
              <h1 className="font-display text-5xl md:text-6xl font-bold mb-6">
                <span className="gradient-text">From URL</span>
                <br />
                <span className="text-gray-800">to Revenue</span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-2">
                The <span className="font-semibold text-primary-500">DFY</span>,{" "}
                <span className="font-semibold text-accent-500">BYOK</span> MCP Platform
              </p>
              <p className="text-sm text-gray-400 mb-4">
                <span className="text-primary-400">Done For You</span>
                {" · "}
                <span className="text-accent-400">Bring Your Own Keys</span>
              </p>
              <p className="text-lg text-gray-500 mb-8 max-w-xl">
                You give us your URL + budget. We handle lead finding, content generation,
                outreach, optimization, and reporting. All via MCP.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start mb-8">
                <LinkButton
                  href={URLS.signUp}
                  className="px-8 py-4 bg-primary-500 text-white rounded-full hover:bg-primary-600 font-medium text-lg shadow-lg hover:shadow-xl"
                >
                  Get Started Free
                </LinkButton>
                <a
                  href={URLS.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-4 bg-white border border-gray-200 text-gray-700 rounded-full hover:border-primary-300 hover:bg-primary-50 transition font-medium shadow-sm"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  View on GitHub
                </a>
              </div>

              {/* Pricing badge */}
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <div className="bg-white/80 backdrop-blur border border-accent-200 rounded-xl px-4 py-2 shadow-sm">
                  <span className="text-accent-500 text-sm">{LANDING_PRICING.free.label}</span>
                  <span className="block font-bold text-gray-900">{LANDING_PRICING.free.display}</span>
                </div>
              </div>
            </div>

            {/* Mascot */}
            <div className="flex justify-center">
              <Image
                src="/hero.jpg"
                alt="MCP Factory Mascot"
                width={500}
                height={500}
                className="drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* What is DFY + BYOK */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-center mb-12 text-gray-800">
            What makes us different?
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl p-6 border border-primary-100">
              <div className="w-14 h-14 bg-primary-100 rounded-xl flex items-center justify-center mb-4 border border-primary-200">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="font-display text-xl font-bold mb-2 text-gray-800">DFY (Done For You)</h3>
              <p className="text-gray-600 mb-4">
                Competitors give you tools. We do the work.
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>You say: <span className="font-mono bg-white/80 px-2 py-0.5 rounded text-primary-700">&quot;acme.com, $10/day&quot;</span></p>
                <p>We: Find leads → Generate emails → Send → Optimize → Report</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-accent-50 to-secondary-50 rounded-2xl p-6 border border-accent-100">
              <div className="w-14 h-14 bg-accent-100 rounded-xl flex items-center justify-center mb-4 border border-accent-200">
                <span className="text-3xl">🔑</span>
              </div>
              <h3 className="font-display text-xl font-bold mb-2 text-gray-800">BYOK (Bring Your Own Keys)</h3>
              <p className="text-gray-600 mb-4">
                Use your own API keys. Pay only for what you use.
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>~$0.02/email (OpenAI + Apollo + Resend)</p>
                <p>No hidden markups. Full transparency.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Performance Stats */}
      {heroStats && (heroStats.bestCostPerOpen || heroStats.bestCostPerReply) && (
        <section className="py-12 px-4 bg-gradient-to-b from-white to-primary-50 border-t border-primary-100">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Real Performance Data</p>
            <h2 className="font-display text-2xl font-bold mb-8 text-gray-800">
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

      {/* Works With Section */}
      <section className="py-12 px-4 bg-gradient-to-b from-secondary-50 to-white border-t border-b border-secondary-100">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wider mb-6">Works with your favorite AI</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {SUPPORTED_CLIENTS.map((client) => (
              <a
                key={client.name}
                href={`${URLS.docs}${client.docsPath}`}
                className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-primary-300 hover:shadow-lg transition"
              >
                <div className="text-4xl mb-2">{client.emoji}</div>
                <h3 className="font-semibold text-gray-800 group-hover:text-primary-600">{client.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{client.detail}</p>
              </a>
            ))}
            <a
              href={`${URLS.docs}/integrations`}
              className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-primary-300 hover:shadow-lg transition"
            >
              <div className="text-4xl mb-2">✨</div>
              <h3 className="font-semibold text-gray-800 group-hover:text-primary-600">+ More</h3>
              <p className="text-xs text-gray-500 mt-1">Any MCP Client</p>
            </a>
          </div>
        </div>
      </section>

      {/* Workflows Grid */}
      <section className="py-16 px-4 bg-gradient-to-b from-white to-secondary-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-center mb-4 text-gray-800">Available Workflows</h2>
          <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto">
            Connect MCP Factory and start automating. Works with all major AI clients.
          </p>

          {/* Supported AI clients */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {SUPPORTED_CLIENTS.map((client) => (
              <a
                key={client.name}
                href={`${URLS.docs}${client.docsPath}`}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-700 hover:border-primary-300 hover:bg-primary-50 transition shadow-sm"
              >
                <span>{client.emoji}</span> {client.name}
              </a>
            ))}
            <span className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-4 py-2 text-sm text-gray-500">
              <span>✨</span> Any MCP Client
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WORKFLOW_DEFINITIONS.map((wf) => (
              <div key={wf.sectionKey} className="bg-white rounded-2xl border border-primary-200 ring-2 ring-primary-100 hover:ring-primary-200 p-6 hover:shadow-xl transition-all duration-300">
                <h3 className="font-display font-bold text-lg text-gray-800 mb-2">{wf.label}</h3>
                <p className="text-gray-600 text-sm mb-4">{wf.description}</p>
                <LinkButton
                  href={URLS.signUp}
                  className="text-sm bg-primary-500 text-white px-4 py-1.5 rounded-full hover:bg-primary-600 font-medium shadow-sm hover:shadow-md"
                >
                  Get Started
                </LinkButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display text-3xl font-bold text-center mb-12 text-gray-800">How it works</h2>

          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold shrink-0 shadow-md">
                1
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-gray-800">Create an account</h3>
                <p className="text-gray-600">
                  Sign up at{" "}
                  <a href={URLS.signUp} className="text-primary-600 hover:underline font-medium">
                    dashboard.mcpfactory.org
                  </a>{" "}
                  and get your API key
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold shrink-0 shadow-md">
                2
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-gray-800">Connect your AI</h3>
                <p className="text-gray-600 mb-2">Add MCP Factory to ChatGPT, Claude, or Cursor:</p>
                <code className="text-sm bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg border border-primary-100 block overflow-x-auto">
                  {URLS.mcp}
                </code>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold shrink-0 shadow-md">
                3
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-gray-800">Configure BYOK keys (optional)</h3>
                <p className="text-gray-600">Add your Apollo, Anthropic keys in the dashboard for advanced features</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold shrink-0 shadow-md">
                4
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-gray-800">Tell your AI what to do</h3>
                <p className="text-gray-600 italic bg-secondary-50 px-4 py-2 rounded-lg border border-secondary-100">
                  &quot;Launch a cold email campaign for acme.com, $10/day budget, target SaaS founders&quot;
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold shrink-0 shadow-md">
                5
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-gray-800">We handle the rest</h3>
                <p className="text-gray-600">Lead finding, email generation, sending, A/B testing, optimization, reporting</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="py-20 px-4 gradient-bg">
        <div className="max-w-xl mx-auto text-center">
          <Image src="/logo.jpg" alt="MCP Factory" width={80} height={80} className="mx-auto mb-6 rounded-xl" />
          <h2 className="font-display text-3xl font-bold mb-4 text-gray-800">Join the Waitlist</h2>
          <p className="text-gray-600 mb-8">
            Be the first to know when we launch. Get early access + lifetime discount.
          </p>
          <WaitlistForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Image src="/logo-head.jpg" alt="MCP Factory" width={32} height={32} className="rounded-md" />
            <span className="font-display font-bold text-white text-lg">MCP Factory</span>
          </div>
          <p className="text-sm mb-4">The DFY, BYOK MCP Platform</p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-sm">
            <a
              href={URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-400 transition"
            >
              GitHub
            </a>
            <a href={URLS.docs} className="hover:text-primary-400 transition">
              Docs
            </a>
            <a href="/brand" className="hover:text-primary-400 transition">
              Brand
            </a>
            <a href="#" className="hover:text-primary-400 transition">
              Privacy
            </a>
          </div>
          <div className="flex justify-center mt-6">
            <StatusIndicator />
          </div>
          <p className="text-xs mt-6">MIT License. 100% Open Source.</p>
        </div>
      </footer>
    </main>
  );
}
