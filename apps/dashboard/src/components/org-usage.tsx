"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOrgCostsByBrand, getOrgCostBreakdown, type Brand } from "@/lib/api";

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
}

export function OrgUsageSection({ brands }: { brands: Brand[] }) {
  const { data: brandGroupsData, isLoading: brandGroupsLoading } = useAuthQuery(
    ["orgCostsByBrand"],
    () => getOrgCostsByBrand(),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const { data: totalCostData, isLoading: totalCostLoading } = useAuthQuery(
    ["orgCostBreakdown"],
    () => getOrgCostBreakdown(),
    { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false },
  );

  const isLoading = brandGroupsLoading || totalCostLoading;

  const brandMap = useMemo(() => {
    const map = new Map<string, Brand>();
    for (const b of brands) map.set(b.id, b);
    return map;
  }, [brands]);

  const segments: Segment[] = useMemo(() => {
    const groups = brandGroupsData?.groups ?? [];
    const entries = groups
      .map((g) => ({
        brandId: g.brandId,
        name: g.brandId
          ? (brandMap.get(g.brandId)?.name ?? brandMap.get(g.brandId)?.domain ?? g.brandId)
          : "Other",
        cents: parseFloat(g.totalCostInUsdCents) || 0,
      }))
      .filter((e) => e.cents > 0)
      .sort((a, b) => {
        if (a.brandId === null) return 1;
        if (b.brandId === null) return -1;
        return b.cents - a.cents;
      });

    const total = entries.reduce((sum, e) => sum + e.cents, 0);

    return entries.map((entry, i) => ({
      name: entry.name,
      cents: entry.cents,
      percentage: total > 0 ? (entry.cents / total) * 100 : 0,
      color: entry.brandId === null ? "#9ca3af" : COLORS[i % COLORS.length],
    }));
  }, [brandGroupsData, brandMap]);

  const totalCostBreakdown = useMemo(() => {
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
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="h-5 w-24 bg-gray-200 rounded mb-4" />
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
    );
  }

  if (totalCents === 0) return null;

  let cumulative = 0;
  const stops = segments.map((seg) => {
    const start = cumulative;
    cumulative += seg.percentage;
    return `${seg.color} ${start}% ${cumulative}%`;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Usage</h2>
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

        {/* Legend — by brand */}
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
  );
}
