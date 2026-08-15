"use client";

import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  getCrossOrgCostProjection,
  getCrossOrgCostPerOutcomeTrend,
  getCrossOrgLifetimeCostPerOutcome,
  type CrossOrgTrendPoint,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { GrowthBadge, OutcomeCard, SortableTh, Sparkline } from "@/components/feature-stats/primitives";
import {
  FEATURE_SLUG,
  TREND_DAYS,
  cmpValues,
  fmtUsd,
  growth7d,
  latestCost,
  nextSort,
  num,
  type Sort,
} from "@/lib/feature-stats-format";
import {
  OBJECTIVES,
  SALES_OBJECTIVE,
  type DisplayObjective,
} from "@/lib/feature-stats-objectives";

/**
 * Economics — the cross-org price of each outcome, one row per outcome.
 *
 * The objective-selectable zoom-in (trend chart + per-workflow cost split) is
 * its own page at `./details`, and the per-workflow cross-brand table is at
 * `./workflows`; this page states the price and nothing else.
 */
export default function FeatureStatsEconomicsPage() {
  const projection = useQuery({
    queryKey: ["crossOrgCostProjection", FEATURE_SLUG],
    queryFn: () => getCrossOrgCostProjection(FEATURE_SLUG),
    ...pollOptionsSlower,
  });

  // Lifetime (all-history) cross-org average per objective — one call, all 6.
  // Fails soft to "—" per objective (no false $0) while it or the gateway route
  // is still deploying.
  const lifetime = useQuery({
    queryKey: ["crossOrgLifetime", FEATURE_SLUG],
    queryFn: () => getCrossOrgLifetimeCostPerOutcome(FEATURE_SLUG),
    ...pollOptionsSlower,
  });

  // One moving-average series per objective. Same queryKey + params as the
  // Details page's trend query, so navigating there costs no extra fetch.
  const trends = useQueries({
    queries: OBJECTIVES.map((o) => ({
      queryKey: ["crossOrgTrend", FEATURE_SLUG, o.key],
      queryFn: () => getCrossOrgCostPerOutcomeTrend(FEATURE_SLUG, o.key, { days: TREND_DAYS }),
      ...pollOptionsSlower,
    })),
  });

  // Lifetime all-time avg by objective key. `websitePurchase` is the renamed
  // key with legacy `purchase` fallback (tolerant of whichever the deployed
  // backend serves); every objective is null-safe → "—", never a false $0.
  const lifetimeObj = lifetime.data?.avgCostPerOutcomeByObjective;
  const allTimeFor = (key: string): number | null => {
    if (!lifetimeObj) return null;
    if (key === "purchase") return lifetimeObj.websitePurchase ?? lifetimeObj.purchase ?? null;
    return (lifetimeObj as Record<string, number | null | undefined>)[key] ?? null;
  };

  // Per-objective derived summary (price = 100-avg = latest backed point; weekly change; series).
  type OutcomeSummary = {
    objective: DisplayObjective;
    pending: boolean;
    points: CrossOrgTrendPoint[];
    price: number | null;
    growth: number | null;
    allTime: number | null;
  };
  const summaries: OutcomeSummary[] = OBJECTIVES.map((o, i) => {
    const q = trends[i];
    const pts = q.data?.points ?? [];
    return {
      objective: o,
      pending: q.isPending,
      points: pts,
      price: latestCost(q.data?.points),
      growth: growth7d(q.data?.points),
      allTime: allTimeFor(o.key),
    };
  });

  // Sales (combined goal) — all-time figure only (no trend/100-avg endpoint):
  // price/growth/trend stay "—", the All-time avg column carries the figure.
  // Null-safe → renders empty until features-service populates the `sales` key.
  const salesSummary: OutcomeSummary = {
    objective: SALES_OBJECTIVE,
    pending: false,
    points: [],
    price: null,
    growth: null,
    allTime: allTimeFor("sales"),
  };
  // Cards stay trend-based (need a moving average); the summary table carries
  // the full ledger incl. the all-time-only Sales row.
  const tableSummaries: OutcomeSummary[] = [...summaries, salesSummary];

  // Summary table sort — default is the natural outcome order (null = unsorted);
  // headers are clickable to sort.
  const [sumSort, setSumSort] = useState<Sort | null>(null);
  const onSumSort = (key: string) => setSumSort(nextSort(sumSort, key));

  const sumKey: Record<string, (s: OutcomeSummary) => number | string | null | undefined> = {
    outcome: (s) => s.objective.label,
    allTime: (s) => s.allTime,
    price: (s) => s.price,
    growth: (s) => s.growth,
  };
  const sortedSummaries = sumSort
    ? [...tableSummaries].sort((a, b) => cmpValues(sumKey[sumSort.key](a), sumKey[sumSort.key](b), sumSort.dir))
    : tableSummaries;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Economics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cross-org economics — averaged across every client brand running this feature.
          {projection.data ? ` ${num(projection.data.brandCount)} brands with usable economics.` : ""}
        </p>
      </header>

      <section className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaries.map((s) => (
            <OutcomeCard
              key={s.objective.key}
              label={s.objective.label}
              price={s.price}
              growth={s.growth}
              points={s.points}
              pending={s.pending}
            />
          ))}
        </div>

        {/* Summary table — one row per outcome. */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <SortableTh label="Outcome" sortKey="outcome" sort={sumSort} onSort={onSumSort} align="left" />
                <SortableTh label="All-time avg" sortKey="allTime" sort={sumSort} onSort={onSumSort} />
                <SortableTh label="100-avg" sortKey="price" sort={sumSort} onSort={onSumSort} />
                <SortableTh label="7-day change" sortKey="growth" sort={sumSort} onSort={onSumSort} />
                <th className="px-4 py-3 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {sortedSummaries.map((s) => (
                <tr
                  key={s.objective.key}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-800">{s.objective.label}</td>
                  {/* Lifetime cross-org avg (features-service); "—" while it loads / is unbacked, never a false $0. */}
                  <td className="px-4 py-3 text-right text-gray-600">
                    {lifetime.isPending ? (
                      <Skeleton className="h-4 w-14 ml-auto" />
                    ) : (
                      fmtUsd(s.allTime)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {s.pending ? <Skeleton className="h-4 w-14 ml-auto" /> : fmtUsd(s.price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.pending ? <Skeleton className="h-4 w-12 ml-auto" /> : <GrowthBadge growth={s.growth} />}
                  </td>
                  <td className="px-4 py-3 w-40">
                    {s.pending ? (
                      <Skeleton className="h-10 w-full rounded" />
                    ) : (
                      <div className="w-36">
                        <Sparkline points={s.points} growth={s.growth} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">
          Price = the current 100-outcome moving average; all-time avg = the lifetime pooled average
          (both features-service, cross-org). 7-day change compares the price to a week ago; the
          arrow shows direction (▲ up / ▼ down) and the color is cost-semantic — a falling cost is
          green (good), a rising cost is red. A blank means no cross-org outcomes yet. Sale (CLTV) is
          the combined goal (a paying client won via the visit→paid or reply→paid path); it shows an
          all-time avg only.
        </p>
      </section>
    </div>
  );
}
