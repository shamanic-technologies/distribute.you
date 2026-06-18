"use client";

import { useMemo, type ReactNode } from "react";
import { getPlatformPrices, type CostByName } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { ProviderLogo } from "@/components/provider-logo";
import { Skeleton } from "@/components/skeleton";
import type { CostEconomics } from "@/lib/revenue-view";

/**
 * Cost & efficiency summary for the feature Overview — total spend, the top-3
 * cost sources (provider logo + share, no $ amounts), and the two cost/revenue
 * efficiency metrics:
 *   - Cost of acquisition = total cost ÷ expected revenue (a %; lower is better)
 *   - ROI                 = expected revenue ÷ total cost (a × multiple)
 *
 * The two ratios come straight from features-service (`costEconomics` on
 * /revenue) — the single source per DIS-232. Total spend + the top-3 provider
 * breakdown stay client-side (the provider-domain decomposition lives in the
 * cost breakdown, not in features-service).
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

function InfoHint({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center align-middle">
      <svg
        className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500 cursor-help"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="9" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2} d="M12 16v-4M12 8h.01" />
      </svg>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function RevenueCostSummary({
  costBreakdown = [],
  costEconomics,
  pending = false,
  costPending,
  bottomCard,
}: {
  costBreakdown?: CostByName[];
  costEconomics?: CostEconomics;
  pending?: boolean;
  /** Reveal gate for the Total-spent figure (runs-service cost breakdown) when it
   *  resolves on a DIFFERENT chain than `costEconomics` (features-service). The
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
      .map((c) => ({ name: c.costName ?? "Unknown", cents: parseFloat(c.totalCostInUsdCents) || 0 }))
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

  // CAC % + ROI × come from features-service (single source) — null per its
  // documented semantics (pipeline null/0, or cost 0).
  const cacPct = costEconomics?.costOfAcquisitionPct;
  const roiMultiple = costEconomics?.roiMultiple;

  // Right-of-chart column on the Overview: three stat cards (Total spent / Cost
  // of acquisition / ROI) replacing the old org/lead/event counters, plus a
  // compact top-3 cost-source list. Card markup matches the existing overview
  // stat cards so the column stays visually consistent.
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
        {/* Card frames + labels render instantly; only the value waits. */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400">Total spent</p>
          {totalSpentPending ? (
            <Skeleton className="mt-1 h-7 w-24" />
          ) : (
            <p className="mt-1 text-xl font-bold text-gray-900">{formatUsd(totalCostUsd)}</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="flex items-center gap-1 text-xs text-gray-400">
            Cost of acquisition
            <InfoHint text="Share of expected pipeline revenue spent to generate it: total cost ÷ expected revenue. Lower is better." />
          </p>
          {pending ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="mt-1 text-xl font-bold text-gray-900">
              {cacPct == null ? "—" : `${Math.round(cacPct)}%`}
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="flex items-center gap-1 text-xs text-gray-400">
            ROI
            <InfoHint text="Return multiple on spend: expected revenue ÷ total cost. 3× means each $1 spent is expected to return $3." />
          </p>
          {pending ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="mt-1 text-xl font-bold text-gray-900">
              {roiMultiple == null ? "—" : `${roiMultiple.toFixed(1)}×`}
            </p>
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
