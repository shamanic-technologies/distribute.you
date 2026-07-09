"use client";

import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
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
  getCrossOrgCostProjection,
  getCrossOrgCostPerOutcomeTrend,
  getCrossOrgLifetimeCostPerOutcome,
  getCrossOrgWorkflowCostPerOutcome,
  type CrossOrgObjective,
  type CrossOrgTrendPoint,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { ScoreCard } from "@/components/visibility/score-card";
import { Skeleton } from "@/components/skeleton";

const FEATURE_SLUG = "sales-cold-email-outreach";

// The maximization objectives, cross-org. `key` is the canonical camelCase the
// features-service trend + per-workflow endpoints accept; `noun` is the outcome.
const OBJECTIVES: { key: CrossOrgObjective; label: string; noun: string }[] = [
  { key: "websiteVisit", label: "Cost per click (CPC)", noun: "click" },
  { key: "positiveReply", label: "Cost per positive reply", noun: "positive reply" },
  { key: "signup", label: "Cost per signup", noun: "signup" },
  { key: "formSubmission", label: "Cost per form submission", noun: "form submission" },
  { key: "meetingBooked", label: "Cost per meeting", noun: "meeting" },
  { key: "purchase", label: "Cost per purchase", noun: "purchase" },
];

// Trailing display days for the moving-average series (matches the Details chart
// so the two sections share one cached query per objective).
const TREND_DAYS = 90;
// The stock-style weekly change window.
const GROWTH_DAYS = 7;

const usd2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** USD from a backend USD number; "—" when null (never a false $0). */
function fmtUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return usd2(value);
}

/**
 * Stock-ticker price format: 2 decimals under $10 ($5.78), rounded whole dollars
 * at/above $10 ($12). "—" when null (never a false $0).
 */
function fmtStock(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value < 10
    ? value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The most recent backed window value = the current cross-org moving average (100-avg). */
function latestCost(points: CrossOrgTrendPoint[] | undefined): number | null {
  if (!points) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].costPerOutcomeUsd !== null) return points[i].costPerOutcomeUsd;
  }
  return null;
}

/**
 * Stock-style weekly change: latest backed point vs the closest backed point
 * ~GROWTH_DAYS before it, as a signed fraction. Null when either side is
 * missing. This is a display delta over the two points the sparkline already
 * draws — no hidden metric derived from raw events.
 */
function growth7d(points: CrossOrgTrendPoint[] | undefined): number | null {
  if (!points || points.length === 0) return null;
  let latestIdx = -1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].costPerOutcomeUsd !== null) {
      latestIdx = i;
      break;
    }
  }
  if (latestIdx < 0) return null;
  const latest = points[latestIdx];
  const latestMs = new Date(`${latest.date}T00:00:00.000Z`).getTime();
  const targetMs = latestMs - GROWTH_DAYS * 24 * 60 * 60 * 1000;
  // Walk back from the latest point to the first backed point at/before the target day.
  let prev: CrossOrgTrendPoint | null = null;
  for (let i = latestIdx - 1; i >= 0; i--) {
    if (points[i].costPerOutcomeUsd === null) continue;
    prev = points[i];
    if (new Date(`${points[i].date}T00:00:00.000Z`).getTime() <= targetMs) break;
  }
  if (!prev || prev.costPerOutcomeUsd === null || prev.costPerOutcomeUsd === 0) return null;
  const a = latest.costPerOutcomeUsd as number;
  const b = prev.costPerOutcomeUsd as number;
  return (a - b) / b;
}

/** Stock-style change badge: ▲ green when up, ▼ red when down (per the ticker convention). */
function GrowthBadge({ growth }: { growth: number | null }) {
  if (growth === null || growth === 0) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const up = growth > 0;
  const cls = up ? "text-green-600" : "text-red-600";
  const arrow = up ? "▲" : "▼";
  const pct = (Math.abs(growth) * 100).toFixed(1);
  return (
    <span className={`text-xs font-medium ${cls}`} title={`${up ? "+" : "-"}${pct}% vs last week`}>
      {arrow} {pct}% <span className="text-gray-400 font-normal">wk</span>
    </span>
  );
}

/** Minimal sparkline — the moving-average series shape, no axes/grid/tooltip. */
function Sparkline({ points, growth }: { points: CrossOrgTrendPoint[]; growth: number | null }) {
  const data = points.filter((p) => p.costPerOutcomeUsd !== null);
  if (data.length < 2) {
    return <div className="h-10 flex items-center text-[10px] text-gray-300">no trend yet</div>;
  }
  const stroke = growth === null || growth === 0 ? "#94a3b8" : growth > 0 ? "#16a34a" : "#dc2626";
  return (
    <div className="h-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="costPerOutcomeUsd"
            dot={false}
            stroke={stroke}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Stock-ticker card: label, big price (100-avg), weekly change, sparkline. */
function OutcomeCard({
  label,
  price,
  growth,
  points,
  pending,
}: {
  label: string;
  price: number | null;
  growth: number | null;
  points: CrossOrgTrendPoint[];
  pending: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      {pending ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-semibold text-gray-800">{fmtStock(price)}</p>
          <GrowthBadge growth={growth} />
        </div>
      )}
      <div className="mt-2">
        {pending ? <Skeleton className="h-10 w-full rounded" /> : <Sparkline points={points} growth={growth} />}
      </div>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  noun,
}: {
  active?: boolean;
  payload?: Array<{ payload: CrossOrgTrendPoint; value: number }>;
  noun: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{formatDateShort(p.date)}</p>
      <p className="mt-1 font-semibold text-gray-900">
        {p.costPerOutcomeUsd === null ? "—" : usd2(p.costPerOutcomeUsd)} / {noun}
      </p>
      <p className="mt-0.5 text-gray-400">
        {num(p.windowOutcomeCount)} outcomes · {usd2(p.windowSpentUsd)} spend
      </p>
    </div>
  );
}

export default function SalesColdEmailOutreachStatsPage() {
  const [objective, setObjective] = useState<CrossOrgObjective>("websiteVisit");
  const active = OBJECTIVES.find((o) => o.key === objective)!;

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
  // Details section's trend query, so the selected objective's fetch dedupes.
  const trends = useQueries({
    queries: OBJECTIVES.map((o) => ({
      queryKey: ["crossOrgTrend", FEATURE_SLUG, o.key],
      queryFn: () => getCrossOrgCostPerOutcomeTrend(FEATURE_SLUG, o.key, { days: TREND_DAYS }),
      ...pollOptionsSlower,
    })),
  });

  // Per-objective derived summary (price = 100-avg = latest backed point; weekly change; series).
  const summaries = OBJECTIVES.map((o, i) => {
    const q = trends[i];
    const pts = q.data?.points ?? [];
    return {
      objective: o,
      pending: q.isPending,
      points: pts,
      price: latestCost(q.data?.points),
      growth: growth7d(q.data?.points),
      allTime: lifetime.data?.avgCostPerOutcomeByObjective[o.key] ?? null,
    };
  });

  const trend = trends[OBJECTIVES.findIndex((o) => o.key === objective)];
  const workflows = useQuery({
    queryKey: ["crossOrgWorkflowCost", FEATURE_SLUG, objective],
    queryFn: () => getCrossOrgWorkflowCostPerOutcome(FEATURE_SLUG, objective),
    ...pollOptionsSlower,
  });

  const rows = workflows.data?.workflows ?? [];
  const points = trend.data?.points ?? [];
  const currentAvg = latestCost(trend.data?.points);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Sales Cold Emails Outreach</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cross-org economics — averaged across every client brand running this feature.
          {projection.data ? ` ${num(projection.data.brandCount)} brands with usable economics.` : ""}
        </p>
      </header>

      {/* Expected economics (cross-org) — stock-ticker cards + summary table, one row per outcome. */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Expected economics (cross-org)</h2>

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
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium text-right">All-time avg</th>
                <th className="px-4 py-3 font-medium text-right">100-avg</th>
                <th className="px-4 py-3 font-medium text-right">7-day change</th>
                <th className="px-4 py-3 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
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
                      fmtStock(s.allTime)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {s.pending ? <Skeleton className="h-4 w-14 ml-auto" /> : fmtStock(s.price)}
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
          (both features-service, cross-org). 7-day change compares the price to a week ago,
          stock-ticker style (▲ up green, ▼ down red). A blank means no cross-org outcomes yet.
        </p>
      </section>

      {/* Observed cost-per-outcome — Details: the objective-selectable zoom-in (trend + per-workflow). */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Observed cost-per-outcome - Details</h2>
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
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-3 font-medium">Workflow</th>
                <th className="px-4 py-3 font-medium text-right">{active.label}</th>
                <th className="px-4 py-3 font-medium text-right">Spend</th>
                <th className="px-4 py-3 font-medium text-right">Clicks</th>
                <th className="px-4 py-3 font-medium text-right">Positive replies</th>
              </tr>
            </thead>
            <tbody>
              {workflows.isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-4 py-3" colSpan={5}>
                      <Skeleton className="h-4 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : workflows.isError ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={5}>
                    Couldn&apos;t load the workflow split (the cross-org query is slow). Retry shortly.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={5}>
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
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
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
          Cost-per-outcome and spend come straight from features-service (cross-org, all brands).
          Values populate once a workflow has spend; a blank means no cross-org outcomes of that
          type yet.
        </p>
      </section>
    </div>
  );
}
