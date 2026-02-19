import { URLS } from "@mcpfactory/content";
import { fetchLeaderboard, formatPercent, formatModelName, formatCostDollars } from "@/lib/fetch-leaderboard";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";

export const revalidate = 300;

export default async function HomePage() {
  const data = await fetchLeaderboard();

  const brands = data?.brands || [];
  const models = data?.models || [];
  const hero = data?.hero;

  // Compute aggregate summary numbers
  const totalEmails = brands.reduce((s, b) => s + b.emailsSent, 0);
  const totalOpened = brands.reduce((s, b) => s + b.emailsOpened, 0);
  const totalClicked = brands.reduce((s, b) => s + b.emailsClicked, 0);
  const totalReplied = brands.reduce((s, b) => s + b.emailsReplied, 0);
  const totalGenerated = models.reduce((s, m) => s + m.emailsGenerated, 0);
  const totalCostCents = brands.reduce((s, b) => s + b.totalCostUsdCents, 0);
  const avgOpenRate = totalEmails > 0 ? totalOpened / totalEmails : 0;
  const avgClickRate = totalEmails > 0 ? totalClicked / totalEmails : 0;
  const avgReplyRate = totalEmails > 0 ? totalReplied / totalEmails : 0;

  const hasEmails = totalEmails > 0;
  const hasActivity = totalGenerated > 0 || totalCostCents > 0;
  const hasBrands = brands.length > 0;

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="py-12 md:py-16 px-4 gradient-bg">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block bg-accent-100 text-accent-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-accent-200">
            100% Transparent
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-800">
            Real Performance, <span className="gradient-text">Real Data</span>
          </h1>
          <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
            Every metric from every campaign. No cherry-picking, no hidden numbers.
          </p>

          {hasActivity || hasEmails ? (
            <>
              {/* Key numbers row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-8">
                <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-200">
                  <p className="text-3xl font-bold text-gray-800">
                    {totalGenerated > 0 ? totalGenerated.toLocaleString() : "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Emails Generated</p>
                </div>
                <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-200">
                  <p className="text-3xl font-bold text-gray-800">
                    {totalEmails > 0 ? totalEmails.toLocaleString() : "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Emails Sent</p>
                </div>
                <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-200">
                  <p className="text-3xl font-bold text-accent-500">{formatCostDollars(totalCostCents)}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Spent</p>
                </div>
                <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-200">
                  <p className="text-3xl font-bold text-secondary-500">
                    {brands.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{brands.length === 1 ? "Brand" : "Brands"}</p>
                </div>
              </div>

              {hasEmails && (
                <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
                  <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-200">
                    <p className="text-3xl font-bold text-primary-500">{formatPercent(avgOpenRate)}</p>
                    <p className="text-xs text-gray-500 mt-1">Avg Open Rate</p>
                  </div>
                  <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-200">
                    <p className="text-3xl font-bold text-accent-500">{formatPercent(avgClickRate)}</p>
                    <p className="text-xs text-gray-500 mt-1">Avg Visit Rate</p>
                  </div>
                  <div className="bg-white/80 backdrop-blur rounded-xl p-4 border border-gray-200">
                    <p className="text-3xl font-bold text-secondary-500">{formatPercent(avgReplyRate)}</p>
                    <p className="text-xs text-gray-500 mt-1">Avg Reply Rate</p>
                  </div>
                </div>
              )}

              {/* Best conversion + best value cards */}
              {hero && hero.bestConversionModel.conversionRate > 0 && (
                <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-4">
                  <div className="bg-white rounded-2xl p-6 border border-primary-200 shadow-sm">
                    <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Best Conversion Rate</p>
                    <p className="text-4xl font-bold text-primary-500 mb-1">
                      {formatPercent(hero.bestConversionModel.conversionRate)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatModelName(hero.bestConversionModel.model)} — visits + replies per email
                    </p>
                  </div>
                  <div className="bg-white rounded-2xl p-6 border border-accent-200 shadow-sm">
                    <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Best Value</p>
                    <p className="text-4xl font-bold text-accent-500 mb-1">
                      {hero.bestValueModel.conversionsPerDollar === 0 ? "—" : hero.bestValueModel.conversionsPerDollar.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatModelName(hero.bestValueModel.model)} — conversions per $1 spent
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-2">
                Updated {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "hourly"}.{" "}
                <a href={URLS.github} className="underline hover:text-gray-600">Methodology is open source.</a>
              </p>
            </>
          ) : hasBrands ? (
            <p className="text-gray-500">
              Campaigns are being set up. Metrics will appear here shortly.
            </p>
          ) : (
            <p className="text-gray-500">
              Performance data will appear here as campaigns run. Check back soon.
            </p>
          )}
        </div>
      </section>

      {/* Leaderboard tables with tabs */}
      {hasBrands && (
        <section className="py-12 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-display text-2xl font-bold mb-1 text-gray-800">
              Leaderboard
            </h2>
            <p className="text-sm text-gray-500 mb-6">Click column headers to sort.</p>

            <LeaderboardTabs brands={brands} models={models} />
          </div>
        </section>
      )}

      {/* Why transparency */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl font-bold mb-4 text-gray-800">
            Why We Publish Everything
          </h2>
          <p className="text-gray-600 mb-6">
            Most outreach platforms hide their real numbers. We don&apos;t.
            Every campaign that runs through MCP Factory contributes to these public leaderboards.
            This means you can make informed decisions based on real data, not marketing claims.
          </p>
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            <a
              href={URLS.signUp}
              className="px-6 py-3 bg-primary-500 text-white rounded-full hover:bg-primary-600 transition font-medium"
            >
              Start a Campaign
            </a>
            <a
              href={URLS.docs}
              className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-full hover:border-primary-300 transition font-medium"
            >
              Read the Docs
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
