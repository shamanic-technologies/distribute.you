import Image from "next/image";
import type { FeatureGroupData, BrandLeaderboardEntry } from "@/lib/performance/fetch-leaderboard";
import { formatPercent, formatCostCents } from "@/lib/performance/fetch-leaderboard";
import { computeBestStats } from "@/lib/performance/best-stats";

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

interface PerformancePreviewProps {
  featureGroups: FeatureGroupData[];
}

function getTopBrands(featureGroups: FeatureGroupData[]): BrandLeaderboardEntry[] {
  const seen = new Set<string>();
  const all: BrandLeaderboardEntry[] = [];

  for (const group of featureGroups) {
    for (const brand of group.brands) {
      if (!brand.brandId || seen.has(brand.brandId)) continue;
      if (brand.costPerReplyCents === null || brand.costPerReplyCents <= 0) continue;
      seen.add(brand.brandId);
      all.push(brand);
    }
  }

  return all
    .sort((a, b) => (a.costPerReplyCents ?? Infinity) - (b.costPerReplyCents ?? Infinity))
    .slice(0, 3);
}

export function PerformancePreview({ featureGroups }: PerformancePreviewProps) {
  const topBrands = getTopBrands(featureGroups);

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

      {topBrands.length > 0 && (
        <div className="mt-4 rounded-xl p-5 border border-gray-200 bg-white">
          <h3 className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-4">
            Top performing brands
          </h3>
          <div className="space-y-3">
            {topBrands.map((brand, i) => {
              const label = brand.brandName || brand.brandDomain || "Unknown";
              return (
                <div key={brand.brandId} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 font-mono w-4">{i + 1}</span>
                  {brand.brandDomain && LOGO_DEV_TOKEN ? (
                    <Image
                      src={`https://img.logo.dev/${brand.brandDomain}?token=${LOGO_DEV_TOKEN}&size=64`}
                      alt={label}
                      width={24}
                      height={24}
                      className="rounded"
                      unoptimized
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase">
                      {label.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 flex-1">{label}</span>
                  <span className="text-sm font-mono text-gray-700">
                    {formatCostCents(brand.costPerReplyCents)}
                    <span className="text-[10px] text-gray-400 ml-1">/reply</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
