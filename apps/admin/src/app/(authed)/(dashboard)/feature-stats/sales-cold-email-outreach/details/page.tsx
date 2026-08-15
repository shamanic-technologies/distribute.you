"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getCrossOrgCostPerOutcomeTrend,
  getCrossOrgWorkflowCostPerOutcome,
  type CrossOrgObjective,
  type CrossOrgWorkflowCostRow,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { ScoreCard } from "@/components/visibility/score-card";
import { Skeleton } from "@/components/skeleton";
import { SortableTh, TrendTooltip } from "@/components/feature-stats/primitives";
import {
  FEATURE_SLUG,
  TREND_DAYS,
  cmpValues,
  fmtUsd,
  formatDateShort,
  latestCost,
  nextSort,
  num,
  usd2,
  type Sort,
} from "@/lib/feature-stats-format";
import { OBJECTIVES } from "@/lib/feature-stats-objectives";

/**
 * Cost details — the objective-selectable zoom-in: the moving-average trend for
 * ONE outcome plus the per-workflow split of that same outcome's cost.
 *
 * The outcome ledger lives on the Economics page and the cross-brand workflow
 * scorecard at `../workflows`; this page answers "how has THIS outcome's price
 * moved, and which model is cheapest at it".
 */
export default function FeatureStatsDetailsPage() {
  const [objective, setObjective] = useState<CrossOrgObjective>("websiteVisit");
  const active = OBJECTIVES.find((o) => o.key === objective)!;

  // Same queryKey + params as the Economics page's per-objective trend, so the
  // selected objective's fetch dedupes across the two pages.
  const trend = useQuery({
    queryKey: ["crossOrgTrend", FEATURE_SLUG, objective],
    queryFn: () => getCrossOrgCostPerOutcomeTrend(FEATURE_SLUG, objective, { days: TREND_DAYS }),
    ...pollOptionsSlower,
  });

  const workflows = useQuery({
    queryKey: ["crossOrgWorkflowCost", FEATURE_SLUG, objective],
    queryFn: () => getCrossOrgWorkflowCostPerOutcome(FEATURE_SLUG, objective),
    ...pollOptionsSlower,
  });

  // Per-workflow table sort — DEFAULT 100-avg (recent) ascending, cheapest first;
  // nulls sink to the bottom. Every header is clickable to re-sort / flip.
  const [wfSort, setWfSort] = useState<Sort>({ key: "recent", dir: "asc" });
  const onWfSort = (key: string) => setWfSort(nextSort(wfSort, key));

  const wfKey: Record<string, (r: CrossOrgWorkflowCostRow) => number | string | null | undefined> = {
    name: (r) => r.workflowDynastyName,
    recent: (r) => r.recentCostPerOutcomeUsd,
    avg: (r) => r.costPerOutcomeUsd,
    spend: (r) => r.spentUsd,
    clicks: (r) => r.observedClicks,
    replies: (r) => r.observedPositiveReplies,
  };
  const rows = [...(workflows.data?.workflows ?? [])].sort((a, b) =>
    cmpValues(wfKey[wfSort.key](a), wfKey[wfSort.key](b), wfSort.dir),
  );

  const points = trend.data?.points ?? [];
  const currentAvg = latestCost(trend.data?.points);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Observed cost-per-outcome — Details</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pick an outcome to see how its cross-org price has moved and which workflow buys it cheapest.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="inline-flex flex-wrap rounded-lg border border-brand-200 bg-brand-50 p-0.5">
            {OBJECTIVES.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setObjective(o.key)}
                className={`px-3 py-1.5 text-xs rounded-md transition ${
                  o.key === objective
                    ? "bg-white text-brand-700 font-medium shadow-sm"
                    : "text-brand-600 hover:text-brand-800"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ScoreCard
            label={`Current ${active.label.toLowerCase()}`}
            value={fmtUsd(currentAvg)}
            subtitle={
              trend.data
                ? `Moving avg, last ~${num(trend.data.windowOutcomes)} ${active.noun}s`
                : "Moving avg"
            }
            pending={trend.isPending}
          />
        </div>

        {/* Trend chart. */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900">{active.label} over time</h3>
          <p className="mt-1 text-xs text-gray-500">
            Cross-org moving average, trailing window of ~
            {trend.data ? num(trend.data.windowOutcomes) : "100"} {active.noun}s.
          </p>
          <div className="mt-4 h-[280px]">
            {trend.isPending ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : points.length === 0 || points.every((p) => p.costPerOutcomeUsd === null) ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Not enough cross-org {active.noun}s yet to plot a trend.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e2e8f0" }}
                    minTickGap={24}
                  />
                  <YAxis
                    tickFormatter={(v) => usd2(Number(v))}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                  />
                  <Tooltip content={<TrendTooltip noun={active.noun} />} />
                  <Line
                    type="monotone"
                    dataKey="costPerOutcomeUsd"
                    dot={false}
                    activeDot={{ r: 4 }}
                    stroke="#6366f1"
                    strokeWidth={2}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Per-workflow split. */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <SortableTh label="Workflow" sortKey="name" sort={wfSort} onSort={onWfSort} align="left" />
                <SortableTh label={`${active.label} 100-avg`} sortKey="recent" sort={wfSort} onSort={onWfSort} />
                <SortableTh label={`${active.label} avg`} sortKey="avg" sort={wfSort} onSort={onWfSort} />
                <SortableTh label="Spend" sortKey="spend" sort={wfSort} onSort={onWfSort} />
                <SortableTh label="Clicks" sortKey="clicks" sort={wfSort} onSort={onWfSort} />
                <SortableTh label="Positive replies" sortKey="replies" sort={wfSort} onSort={onWfSort} />
              </tr>
            </thead>
            <tbody>
              {workflows.isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : workflows.isError ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={6}>
                    Couldn&apos;t load the workflow split (the cross-org query is slow). Retry shortly.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={6}>
                    No workflow data yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.workflowDynastySlug}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-800">{row.workflowDynastyName}</td>
                    {/* 100-avg = recent trailing-window moving average (features-service) — the primary sort column, shown first. */}
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmtUsd(row.recentCostPerOutcomeUsd)}
                    </td>
                    {/* avg = lifetime pooled cost-per-outcome. */}
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtUsd(row.costPerOutcomeUsd)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtUsd(row.spentUsd)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{num(row.observedClicks)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {num(row.observedPositiveReplies)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">
          Both cost columns come straight from features-service (cross-org, all brands): 100-avg =
          the recent trailing-window moving average, avg = the lifetime pooled rate. Default sort is
          100-avg ascending (cheapest first); click any header to re-sort or flip direction. Values
          populate once a workflow has spend; a blank means no cross-org outcomes of that type yet.
        </p>
      </section>
    </div>
  );
}
