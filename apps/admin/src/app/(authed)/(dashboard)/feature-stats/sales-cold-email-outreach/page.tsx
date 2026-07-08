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
  getCrossOrgCostProjection,
  getCrossOrgCostPerOutcomeTrend,
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

const usd2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const num = (n: number) => Math.round(n).toLocaleString("en-US");

/** USD from a backend USD number; "—" when null (never a false $0). */
function fmtUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return usd2(value);
}

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The most recent backed window value = the current cross-org moving average. */
function latestCost(points: CrossOrgTrendPoint[] | undefined): number | null {
  if (!points) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].costPerOutcomeUsd !== null) return points[i].costPerOutcomeUsd;
  }
  return null;
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

  const trend = useQuery({
    queryKey: ["crossOrgTrend", FEATURE_SLUG, objective],
    queryFn: () => getCrossOrgCostPerOutcomeTrend(FEATURE_SLUG, objective, { days: 90 }),
    ...pollOptionsSlower,
  });

  const workflows = useQuery({
    queryKey: ["crossOrgWorkflowCost", FEATURE_SLUG, objective],
    queryFn: () => getCrossOrgWorkflowCostPerOutcome(FEATURE_SLUG, objective),
    ...pollOptionsSlower,
  });

  const projPending = projection.isPending;
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

      {/* Expected economics (projected) — the fleet-wide best-workflow projection. */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Expected economics (cross-org)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ScoreCard
            label="Cost per meeting booked"
            value={fmtUsd(projection.data?.avgCostPerMeetingBooked)}
            subtitle="Expected, cross-org avg"
            tooltip="Feature-wide expected USD cost to book one meeting: each brand's best workflow projection, meaned (unweighted) across all client brands."
            pending={projPending}
          />
          <ScoreCard
            label="Cost per purchase"
            value={fmtUsd(projection.data?.avgCostPerPurchase)}
            subtitle="Expected, cross-org avg"
            tooltip="Feature-wide expected USD cost per purchase/close, meaned across all client brands."
            pending={projPending}
          />
          <ScoreCard
            label="Client brands"
            value={projection.data ? num(projection.data.brandCount) : "—"}
            subtitle="Contributing to the averages"
            pending={projPending}
          />
        </div>
      </section>

      {/* Observed cost-per-outcome — the moving-average trend + per-workflow split,
          both driven by the objective selector. */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Observed cost-per-outcome — moving average (cross-org)
          </h2>
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
