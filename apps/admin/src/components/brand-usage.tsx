"use client";

import { useEffect, useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { getBrandCostsByFeature, getBrandCostBreakdown } from "@/lib/api";
import { useSourcingOrigins } from "@/lib/use-sourcing-origins";
import { foldSourcingUnderChannels } from "@/lib/sourcing-scope";
import { useFeatures } from "@/lib/features-context";
import { Skeleton } from "@/components/skeleton";

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
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCostName(name: string): string {
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Segment {
  key: string;
  name: string;
  cents: number;
  percentage: number;
  color: string;
  /** Under a channel that sources leads: its outreach half + each sourcing origin, so staff
   *  tell lead finding apart from outreach while the channel total stays what it was. */
  split?: { label: string; cents: number }[];
}

export function BrandUsageSection({ brandId, pending: pendingProp = false }: { brandId: string; pending?: boolean }) {
  const { getFeature } = useFeatures();

  const { data: featureGroupsData, isPending: featureGroupsLoading } = useAuthQuery(
    ["brandCostsByFeature", brandId],
    () => getBrandCostsByFeature(brandId),
    { refetchInterval: POLL_INTERVAL },
  );

  const { data: totalCostData, isPending: totalCostLoading } = useAuthQuery(
    ["brandCostBreakdown", { brandId }],
    () => getBrandCostBreakdown(brandId),
    { refetchInterval: POLL_INTERVAL },
  );

  // Lead-finding spend is relabelled from the outreach channel to its sourcing origin's slug
  // (2026-10-07). Fold each origin back under the channel it sources for, as a sub-row.
  const { data: sourcing, isPending: sourcingLoading, isError: sourcingIsError } = useSourcingOrigins();
  useEffect(() => {
    if (sourcingIsError) console.error("[admin] brand usage: sourcing-origins catalogue failed, sourcing rows shown unfolded", { brandId });
  }, [sourcingIsError, brandId]);

  const isPending = featureGroupsLoading || totalCostLoading || (sourcingLoading && !sourcingIsError);
  const hasData = !!(featureGroupsData || totalCostData);

  const segments: Segment[] = useMemo(() => {
    const groups = (featureGroupsData?.groups ?? []).map((g) => ({
      featureSlug: g.featureSlug,
      cents: parseFloat(g.totalCostInUsdCents) || 0,
    }));
    const origins = sourcing?.origins ?? [];
    const originName = (slug: string) => origins.find((o) => o.slug === slug)?.name ?? getFeature(slug)?.name ?? slug;
    const rows = foldSourcingUnderChannels(
      groups,
      sourcing?.originsByChannel ?? {},
      new Set(origins.map((o) => o.slug)),
    );
    const entries = rows
      .map((r) => ({
        slug: r.slug,
        name: r.slug === null ? "Other" : r.isSourcing ? `Sourcing: ${originName(r.slug)}` : (getFeature(r.slug)?.name ?? r.slug),
        cents: r.cents,
        split:
          r.sourcing.length > 0
            ? [
                { label: "Outreach", cents: r.ownCents },
                ...r.sourcing.map((o) => ({ label: `Sourcing: ${originName(o.slug)}`, cents: o.cents })),
              ].filter((x) => x.cents > 0)
            : undefined,
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
      key: entry.slug ?? "other",
      name: entry.name,
      cents: entry.cents,
      split: entry.split,
      percentage: total > 0 ? (entry.cents / total) * 100 : 0,
      color: entry.slug === null ? "#9ca3af" : COLORS[i % COLORS.length], // gray for "Other"
    }));
  }, [featureGroupsData, getFeature, sourcing]);

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

  const pending = pendingProp || (isPending && !hasData);

  if (!pending && totalCents === 0) return null;

  // Build conic-gradient stops
  let cumulative = 0;
  const stops = segments.map((seg) => {
    const start = cumulative;
    cumulative += seg.percentage;
    return `${seg.color} ${start}% ${cumulative}%`;
  });

  // Placeholder legend rows while pending with no data
  const placeholderLegend = [0, 1, 2];

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
              background: pending ? "#e5e7eb" : `conic-gradient(${stops.join(", ")})`,
            }}
          >
            <div className="absolute inset-5 bg-white rounded-full flex items-center justify-center">
              {pending ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                <span className="text-sm font-semibold text-gray-800">
                  {formatUsdCents(totalCents)}
                </span>
              )}
            </div>
          </div>

          {/* Legend — by feature */}
          <div className="flex-1 space-y-2 w-full min-w-0">
            {pending
              ? placeholderLegend.map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-200" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-12 flex-shrink-0" />
                    <Skeleton className="h-3 w-10 flex-shrink-0" />
                  </div>
                ))
              : segments.map((seg) => (
                  <div key={seg.key}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-sm text-gray-700 flex-1 truncate" title={seg.name}>
                        {seg.name}
                      </span>
                      <span className="text-sm font-medium text-gray-800 flex-shrink-0">
                        {formatUsdCents(seg.cents)}
                      </span>
                      <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0">
                        {seg.percentage.toFixed(0)}%
                      </span>
                    </div>
                    {seg.split?.map((part) => (
                      <div key={part.label} className="flex items-center gap-2 pl-5 mt-1">
                        <span className="text-xs text-gray-500 flex-1 truncate" title={part.label}>
                          {part.label}
                        </span>
                        <span className="text-xs text-gray-600 flex-shrink-0">
                          {formatUsdCents(part.cents)}
                        </span>
                        <span className="w-10 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                ))}
          </div>
        </div>

        {/* Detailed cost breakdown */}
        {(pending || totalCostBreakdown.length > 0) && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-600 mb-3">Cost Details</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
              {pending
                ? placeholderLegend.map((i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <Skeleton className="h-4 flex-1 mr-2" />
                      <Skeleton className="h-4 w-12 flex-shrink-0" />
                    </div>
                  ))
                : totalCostBreakdown.map((c) => (
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
