"use client";

import { useMemo } from "react";
import type { CostByName } from "@/lib/api";

interface CostBreakdownProps {
  costBreakdown: CostByName[];
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
  return `$${usd.toFixed(2)}`;
}

export function CostBreakdown({ costBreakdown }: CostBreakdownProps) {
  const segments = useMemo(() => {
    const entries = costBreakdown
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

  const totalCents = segments.reduce((sum, s) => sum + s.cents, 0);

  if (totalCents === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-medium text-gray-800 mb-4">Cost Breakdown</h3>
        <p className="text-sm text-gray-500 text-center py-4">No cost data yet</p>
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-medium text-gray-800 mb-4">Cost Breakdown</h3>

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

        {/* Legend */}
        <div className="flex-1 space-y-2 w-full min-w-0">
          {segments.map((seg) => (
            <div key={seg.name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-sm text-gray-700 flex-1 truncate">
                {formatCostName(seg.name)}
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
    </div>
  );
}
