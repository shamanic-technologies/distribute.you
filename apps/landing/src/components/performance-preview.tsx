import type { FeaturePreviewStats } from "@/lib/fetch-leaderboard";
import { formatPercent, formatCostCents } from "@/lib/fetch-leaderboard";

interface PerformancePreviewProps {
  features: FeaturePreviewStats[];
}

const FEATURE_COLORS: Record<string, { dot: string; bg: string; border: string }> = {
  "sales-cold-email-outreach": { dot: "bg-cyan-400", bg: "bg-cyan-50", border: "border-cyan-200" },
  "journalist-outreach": { dot: "bg-emerald-400", bg: "bg-emerald-50", border: "border-emerald-200" },
  "hiring-outreach": { dot: "bg-violet-400", bg: "bg-violet-50", border: "border-violet-200" },
};

const DEFAULT_COLORS = { dot: "bg-gray-400", bg: "bg-gray-50", border: "border-gray-200" };

export function PerformancePreview({ features }: PerformancePreviewProps) {
  return (
    <div>
      <div className="grid md:grid-cols-3 gap-4">
        {features.map((feature) => {
          const colors = FEATURE_COLORS[feature.featureSlug] ?? DEFAULT_COLORS;
          const hasData = feature.replyRate > 0 || feature.costPerReplyCents !== null;

          return (
            <div
              key={feature.featureSlug}
              className={`rounded-xl p-5 border ${colors.border} ${colors.bg}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <h3 className="font-semibold text-gray-900 text-sm">
                  {feature.featureLabel}
                </h3>
              </div>

              {hasData ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                      % Positive Replies
                    </p>
                    <p className="text-2xl font-bold text-gray-900 font-mono">
                      {formatPercent(feature.replyRate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
                      $ per Positive Reply
                    </p>
                    <p className="text-2xl font-bold text-gray-900 font-mono">
                      {formatCostCents(feature.costPerReplyCents)}
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
