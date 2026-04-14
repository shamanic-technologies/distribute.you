import type { FeatureGroupData } from "@/lib/performance/fetch-leaderboard";
import { formatPercent, formatCostCents } from "@/lib/performance/fetch-leaderboard";
import { computeBestStats } from "@/lib/performance/best-stats";

interface PerformancePreviewProps {
  featureGroups: FeatureGroupData[];
}

export function PerformancePreview({ featureGroups }: PerformancePreviewProps) {
  return (
    <div>
      <div className="grid md:grid-cols-3 gap-4">
        {featureGroups.map((group) => {
          const best = computeBestStats(group.workflows, group.brands, "brand");
          const hasData = best.replyRate > 0 || best.costPerReplyCents !== null;

          return (
            <div
              key={group.featureSlug}
              className="rounded-xl p-5 border border-gray-200 bg-white"
            >
              <h3 className="font-semibold text-gray-900 text-sm mb-4">
                {group.label}
              </h3>

              {hasData ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                      % Positive Replies
                    </p>
                    <p className="text-2xl font-bold text-gray-900 font-mono">
                      {formatPercent(best.replyRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                      $ per Positive Reply
                    </p>
                    <p className="text-2xl font-bold text-gray-900 font-mono">
                      {formatCostCents(best.costPerReplyCents)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Data coming soon</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center mt-4">
        <a
          href="/performance"
          className="text-sm text-brand-600 hover:text-brand-700 font-medium transition inline-flex items-center gap-1"
        >
          See all performance data
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
