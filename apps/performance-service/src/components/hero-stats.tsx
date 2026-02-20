import { URLS } from "@mcpfactory/content";
import { formatWorkflowName, formatPercent, type HeroStats } from "@/lib/fetch-leaderboard";

export function HeroStatsSection({ hero }: { hero: HeroStats }) {
  return (
    <section className="py-16 px-4 gradient-bg">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-block bg-accent-100 text-accent-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-accent-200">
          100% Transparent
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-800">
          Real Performance, <span className="gradient-text">Real Data</span>
        </h1>
        <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
          We publish every metric from every campaign. No cherry-picking, no hidden numbers.
          See exactly how our workflows perform for real clients.
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl p-8 border border-primary-200 shadow-sm">
            <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Best Conversion Rate</p>
            <p className="text-5xl font-bold text-primary-500 mb-2">
              {formatPercent(hero.bestConversionWorkflow.conversionRate)}
            </p>
            <p className="text-sm text-gray-500">
              visits + replies per email sent
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Workflow: {formatWorkflowName(hero.bestConversionWorkflow.workflowName)}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-accent-200 shadow-sm">
            <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Best Value</p>
            <p className="text-5xl font-bold text-accent-500 mb-2">
              {hero.bestValueWorkflow.conversionsPerDollar === 0 ? "—" : hero.bestValueWorkflow.conversionsPerDollar.toFixed(1)}
            </p>
            <p className="text-sm text-gray-500">
              conversions per $1 spent
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Workflow: {formatWorkflowName(hero.bestValueWorkflow.workflowName)}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-8">
          Conversions = website visits + replies. Updated hourly.{" "}
          <a href={URLS.github} className="underline hover:text-gray-600">Methodology is open source.</a>
        </p>
      </div>
    </section>
  );
}
