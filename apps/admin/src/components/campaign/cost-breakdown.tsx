"use client";

import { useMemo } from "react";
import { getPlatformPrices, type CostByName } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { ProviderLogo } from "@/components/provider-logo";
import { Skeleton } from "@/components/skeleton";

interface CostBreakdownProps {
  costBreakdown: CostByName[];
  pending?: boolean;
}

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

function formatCostName(name: string): string {
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUsdCents(cents: number): string {
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CostBreakdownSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[200px]">
      <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut placeholder */}
        <div className="w-40 h-40 rounded-full bg-gray-100 animate-pulse flex-shrink-0 relative">
          <div className="absolute inset-5 bg-white rounded-full" />
        </div>
        {/* Legend placeholder */}
        <div className="flex-1 space-y-3 w-full min-w-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
              <div className="h-4 bg-gray-100 rounded animate-pulse flex-1" />
              <div className="h-4 w-12 bg-gray-200 rounded animate-pulse flex-shrink-0" />
              <div className="h-3 w-10 bg-gray-100 rounded animate-pulse flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CostBreakdown({ costBreakdown, pending = false }: CostBreakdownProps) {
  const segments = useMemo(() => {
    const entries = (costBreakdown ?? [])
      .map((c) => ({
        name: c.costName ?? "Unknown",
        cents: parseFloat(c.totalCostInUsdCents) || 0,
      }))
      .filter((e) => e.cents > 0)
      .sort((a, b) => b.cents - a.cents);

    const total = entries.reduce((sum, e) => sum + e.cents, 0);

    return entries.map((entry, i) => ({
      ...entry,
      percentage: total > 0 ? (entry.cents / total) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }));
  }, [costBreakdown]);

  // Static catalog → `costName -> providerDomain` for the provider logos.
  // Best-effort enrichment: on failure the cost labels still render, just without logos.
  const { data: platformPrices } = useAuthQuery(
    ["platformPrices"],
    () => getPlatformPrices(),
    { staleTime: 60 * 60 * 1000 },
  );
  const domainByCost = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of platformPrices ?? []) map.set(p.name, p.providerDomain);
    return map;
  }, [platformPrices]);

  const totalCents = segments.reduce((sum, s) => sum + s.cents, 0);

  if (!pending && totalCents === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[200px] flex flex-col">
        <h3 className="font-medium text-gray-800 mb-4">Cost Breakdown</h3>
        <p className="text-sm text-gray-500 text-center py-4 flex-1 flex items-center justify-center">No cost data yet</p>
      </div>
    );
  }

  // Build conic-gradient stops
  let cumulative = 0;
  const stops = segments.map((seg) => {
    const start = cumulative;
    cumulative += seg.percentage;
    return `${seg.color} ${start}% ${cumulative}%`;
  });

  // While pending with no data, render placeholder legend rows.
  const legendRows = pending && segments.length === 0
    ? [0, 1, 2, 3].map((i) => ({
        name: `placeholder-${i}`,
        cents: 0,
        percentage: 0,
        color: COLORS[i % COLORS.length],
      }))
    : segments;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[200px]">
      <h3 className="font-medium text-gray-800 mb-4">Cost Breakdown</h3>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut chart */}
        {pending ? (
          <Skeleton className="rounded-full flex-shrink-0 w-40 h-40" />
        ) : (
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
        )}

        {/* Legend */}
        <div className="flex-1 space-y-2 w-full min-w-0">
          {legendRows.map((seg) => (
            <div key={seg.name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <ProviderLogo domain={domainByCost.get(seg.name) ?? null} size={16} />
              <span className="text-sm text-gray-700 flex-1 truncate">
                {pending ? <Skeleton className="h-4 w-24" /> : formatCostName(seg.name)}
              </span>
              {pending ? (
                <>
                  <Skeleton className="h-4 w-12 flex-shrink-0" />
                  <Skeleton className="h-3 w-10 flex-shrink-0" />
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-800 flex-shrink-0">
                    {formatUsdCents(seg.cents)}
                  </span>
                  <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0">
                    {seg.percentage.toFixed(0)}%
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
