import type { FeatureBenchmarkData } from "@/lib/benchmarks/fetch-benchmark";
import {
  formatPercent,
  formatCostCents,
  formatCostCentsWhole,
  formatCostDollars,
} from "@/lib/performance/fetch-leaderboard";
import { BrandLeaderboard } from "@/components/performance/leaderboard-table";

const BENCHMARK_URL = "/benchmarks/sales-cold-email-outreach";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-left">
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-xl md:text-2xl font-display font-bold text-gray-900 mt-1 font-mono">
        {value}
      </div>
    </div>
  );
}

export function PerformancePreview({ data }: { data: FeatureBenchmarkData }) {
  const { aggregate, brands } = data;
  const hasData = aggregate.emailsSent > 0;

  if (!hasData) {
    return (
      <p className="text-sm text-gray-400 text-center py-10">
        Performance data will appear here as cold email campaigns run. Check back soon.
      </p>
    );
  }

  return (
    <div>
      {/* Platform averages — the open dataset */}
      <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-3 text-center">
        Platform averages — every brand, every workflow
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <Stat label="Open rate" value={formatPercent(aggregate.openRate)} />
        <Stat label="Click rate" value={formatPercent(aggregate.clickRate)} />
        <Stat label="Positive reply rate" value={formatPercent(aggregate.replyRate)} />
        <Stat label="$ / open" value={formatCostCents(aggregate.costPerOpenCents)} />
        <Stat label="$ / click" value={formatCostCents(aggregate.costPerClickCents)} />
        <Stat label="$ / positive reply" value={formatCostCentsWhole(aggregate.costPerReplyCents)} />
      </div>

      <p className="text-xs text-gray-400 mb-6 text-center">
        {aggregate.participatingBrands.toLocaleString()} brands ·{" "}
        {aggregate.participatingWorkflows.toLocaleString()} workflows ·{" "}
        {aggregate.emailsSent.toLocaleString()} emails sent ·{" "}
        {formatCostDollars(aggregate.totalCostUsdCents)} spent — all-time, updated hourly.
      </p>

      {/* Top brand leaderboard — same table as the full benchmark page */}
      {brands.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
              Top brands by $ / positive reply
            </p>
            <span className="text-[11px] text-gray-400">
              {brands.length.toLocaleString()} ranked
            </span>
          </div>
          <BrandLeaderboard brands={brands} maxEntries={5} />
        </div>
      )}

      <div className="text-center mt-6">
        <a
          href={BENCHMARK_URL}
          className="text-sm text-brand-600 hover:text-brand-700 font-medium transition inline-flex items-center gap-1"
        >
          See the full benchmark — every brand &amp; workflow
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
