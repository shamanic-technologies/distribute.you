"use client";

import { useMemo, type ReactNode } from "react";
import { getPlatformPrices, type CostByName } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { ProviderLogo } from "@/components/provider-logo";
import { Skeleton } from "@/components/skeleton";

/**
 * Cost summary for the feature Overview — actual spend and the top-3 cost
 * sources (provider logo + share, no $ amounts).
 */

function formatCostName(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUsd(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  const fractionDigits = usd < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function RevenueCostSummary({
  costBreakdown = [],
  pending = false,
  costPending,
  bottomCard,
}: {
  costBreakdown?: CostByName[];
  pending?: boolean;
  /** Reveal gate for the Total-spent figure (runs-service cost breakdown) when it
   *  resolves on a DIFFERENT chain than the revenue data (features-service). The
   *  feature Overview passes this so Total-spent never waits on the slower revenue
   *  call; other consumers omit it → falls back to `pending` (single reveal). */
  costPending?: boolean;
  /** Replaces the default "Top cost sources" card (e.g. a campaign budget card
   *  on the campaign page, where a brand-wide cost-source split doesn't apply). */
  bottomCard?: ReactNode;
}) {
  // Total-spent reveals on its own source where given; otherwise tracks `pending`.
  const totalSpentPending = costPending ?? pending;
  const { entries, totalCents } = useMemo(() => {
    const e = costBreakdown
      .map((c) => ({ name: c.costName ?? "Unknown", cents: parseFloat(c.actualCostInUsdCents) || 0 }))
      .filter((x) => x.cents > 0)
      .sort((a, b) => b.cents - a.cents);
    return { entries: e, totalCents: e.reduce((s, x) => s + x.cents, 0) };
  }, [costBreakdown]);

  // Static catalog → costName -> providerDomain for the provider logos.
  const { data: platformPrices } = useAuthQuery(
    ["platformPrices"],
    () => getPlatformPrices(),
    { staleTime: 60 * 60 * 1000 },
  );
  const domainByCost = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of platformPrices ?? []) m.set(p.name, p.providerDomain);
    return m;
  }, [platformPrices]);

  // Total spent + top-3 provider sources stay client-side (provider-domain
  // decomposition lives in the cost breakdown, not features-service).
  const totalCostUsd = totalCents / 100;
  const top3 = entries.slice(0, 3).map((e) => ({
    ...e,
    pct: totalCents > 0 ? (e.cents / totalCents) * 100 : 0,
    domain: domainByCost.get(e.name) ?? null,
  }));

  // Right-of-chart column on the Overview: Total spent plus a compact top-3
  // cost-source list.
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {/* Card frames + labels render instantly; only the value waits. */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Total spent</p>
          {totalSpentPending ? (
            <Skeleton className="mt-1 h-7 w-24" />
          ) : (
            <p className="mt-1 text-xl font-bold text-gray-900">{formatUsd(totalCostUsd)}</p>
          )}
        </div>
      </div>

      {/* Bottom card — the campaign page swaps in its own (budget) card via
          `bottomCard`; the Overview keeps the default Top-3 cost-source list. */}
      {bottomCard !== undefined ? bottomCard : pending ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top cost sources</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      ) : top3.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top cost sources</p>
          {top3.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <ProviderLogo domain={s.domain} size={16} />
              <span className="text-sm text-gray-700 flex-1 truncate">{formatCostName(s.name)}</span>
              <span className="text-sm font-medium text-gray-800 tabular-nums">{Math.round(s.pct)}%</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
