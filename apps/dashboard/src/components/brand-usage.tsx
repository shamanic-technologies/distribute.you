"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrandCostsByFeature, getBrandCostBreakdown, type FeatureCostGroup, type CostByName } from "@/lib/api";
import { useFeatures } from "@/lib/features-context";

const POLL_INTERVAL = 5_000;

const COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#84cc16", // lime
];

function formatUsdCents(cents: number): string {
  const usd = cents / 100;
  if (usd < 0.01 && usd > 0) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function formatCostName(name: string): string {
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Segment {
  name: string;
  cents: number;
  percentage: number;
  color: string;
  costBreakdown?: { name: string; cents: number }[];
}

export function BrandUsageSection({ brandId }: { brandId: string }) {
  const { getFeature } = useFeatures();

  const { data: featureGroupsData, isLoading: featureGroupsLoading } = useAuthQuery(
    ["brandCostsByFeature", brandId],
    () => getBrandCostsByFeature(brandId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const { data: totalCostData, isLoading: totalCostLoading } = useAuthQuery(
    ["brandCostBreakdown", { brandId }],
    () => getBrandCostBreakdown(brandId),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const isLoading = featureGroupsLoading || totalCostLoading;

  const segments: Segment[] = useMemo(() => {
    const groups = featureGroupsData?.groups ?? [];
    const entries = groups
      .map((g) => ({
        slug: g.featureDynastySlug,
        name: g.featureDynastySlug
          ? (getFeature(g.featureDynastySlug)?.dynastyName ?? getFeature(g.featureDynastySlug)?.name ?? g.featureDynastySlug)
          : "Other",
        cents: parseFloat(g.totalCostInUsdCents) || 0,
      }))
      .filter((e) => e.cents > 0)
      .sort((a, b) => {
        // "Other" always last
        if (a.slug === null) return 1;
        if (b.slug === null) return -1;
        return b.cents - a.cents;
      });

    const total = entries.reduce((sum, e) => sum + e.cents, 0);

    return entries.map((entry, i) => ({
      name: entry.name,
      cents: entry.cents,
      percentage: total > 0 ? (entry.cents / total) * 100 : 0,
      color: entry.slug === null ? "#9ca3af" : COLORS[i % COLORS.length], // gray for "Other"
    }));
  }, [featureGroupsData, getFeature]);

  const totalCostBreakdown: { name: string; cents: number }[] = useMemo(() => {
    const costs = totalCostData?.costs ?? [];
    return costs
      .map((c) => ({
        name: c.costName,
        cents: parseFloat(c.totalCostInUsdCents) || 0,
      }))
      .filter((e) => e.cents > 0)
      .sort((a, b) => b.cents - a.cents);
  }, [totalCostData]);

  const totalCents = segments.reduce((sum, s) => sum + s.cents, 0);

  if (isLoading) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Usage</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-40 h-40 rounded-full bg-gray-100 flex-shrink-0 relative">
              <div className="absolute inset-5 bg-white rounded-full" />
            </div>
            <div className="flex-1 space-y-3 w-full min-w-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="h-4 bg-gray-100 rounded flex-1" />
                  <div className="h-4 w-12 bg-gray-200 rounded flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (totalCents === 0) return null;

  // Build conic-gradient stops
  let cumulative = 0;
  const stops = segments.map((seg) => {
    const start = cumulative;
    cumulative += seg.percentage;
    return `${seg.color} ${start}% ${cumulative}%`;
  });

  return (
    <div className="mb-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Usage</h2>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Donut chart */}
          <div
            className="rounded-full flex-shrink-0 relative"
            style={{
              width: 160,
              height: 160,
              background: `conic-gradient(${stops.join(", ")})`,
            }}
          >
            <div className="absolute inset-5 bg-white rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-gray-800">
                {formatUsdCents(totalCents)}
              </span>
            </div>
          </div>

          {/* Legend — by feature */}
          <div className="flex-1 space-y-2 w-full min-w-0">
            {segments.map((seg) => (
              <div key={seg.name} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-sm text-gray-700 flex-1 truncate">
                  {seg.name}
                </span>
                <span className="text-sm font-medium text-gray-800 flex-shrink-0">
                  {formatUsdCents(seg.cents)}
                </span>
                <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0">
                  {seg.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed cost breakdown */}
        {totalCostBreakdown.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-600 mb-3">Cost Details</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
              {totalCostBreakdown.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 truncate mr-2">{formatCostName(c.name)}</span>
                  <span className="text-gray-800 font-medium flex-shrink-0">{formatUsdCents(c.cents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
