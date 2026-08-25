"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/skeleton";
import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi } from "@/lib/format-roi";
import type { RoiHistory } from "@/lib/revenue-view";

/**
 * "Return on spend" — the brand's ROI across its whole life, one line.
 *
 * It replaces a cumulative count of one funnel signal, which answered a narrower
 * question than the page it sits on: a brand runs several funnels, and the thing every
 * one of them is judged on is what came back per dollar.
 *
 * Both legs of every point are CUMULATIVE and REALIZED — features-service dates spend by
 * runs' own cost buckets and pipeline by the per-lead event timestamps, and spreads
 * neither. The cumulative form is what makes the line readable: spend on a given day
 * buys outcomes that land days or weeks later, so a per-day ratio oscillates between
 * zero and absurd and describes nothing anyone can act on.
 */

const BREAK_EVEN = 1;

type RoiChartPoint = {
  date: string;
  label: string;
  roiMultiple: number;
  cumulativeSpendUsd: number;
  cumulativePipelineUsd: number;
};

function dateObject(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: string): string {
  return dateObject(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The fleet-wide ROI rule (`formatRoi`): one decimal under 10x, a whole number from 10x up.
 * The headline, the axis ticks, the `ROI` stat card directly above this chart, the Campaigns
 * table and the daily digest all read that ONE function, so the curve's last point and the
 * card two inches above it can never print the same figure two ways.
 *
 * Coarsening was tried once on this file ALONE and correctly reverted — at a real 11.7 the
 * headline read `12×` under a stat card reading `11.7×`. The threshold was never the
 * problem; applying it to one surface was. The axis inherits the same function for the same
 * reason: a tick disagreeing with the value it terminates on invites the reader to reconcile
 * two figures that are one figure.
 */

/**
 * A day whose cumulative spend is still zero carries `roiMultiple: null` — the brand had
 * a dated outcome before it had spent a dollar, so there is nothing to divide by. Those
 * days are DROPPED rather than plotted at zero: zero would read as "returned nothing".
 */
function buildPoints(history: RoiHistory | null | undefined): RoiChartPoint[] {
  return (history?.daily ?? [])
    .filter((d): d is typeof d & { roiMultiple: number } => d.roiMultiple != null)
    .map((d) => ({
      date: d.date,
      label: formatDate(d.date),
      roiMultiple: d.roiMultiple,
      cumulativeSpendUsd: d.cumulativeSpendUsd,
      cumulativePipelineUsd: d.cumulativePipelineUsd,
    }));
}

function RoiTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RoiChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-gray-800">{formatDate(point.date)}</p>
      <p className="text-gray-500">
        Return <span className="font-medium text-gray-800">{formatRoi(point.roiMultiple)}</span>
      </p>
      <p className="mt-1 text-gray-400">
        {formatUsdAdaptive(point.cumulativePipelineUsd)} earned on{" "}
        {formatUsdAdaptive(point.cumulativeSpendUsd)} spent
      </p>
    </div>
  );
}

export function RoiTrendCard({
  history,
  pending = false,
}: {
  /** `/revenue` `roiHistory`. Null when features-service could not build it — it is
   *  fail-soft there so a curve never 502s an Overview whose other numbers are fine. */
  history?: RoiHistory | null;
  pending?: boolean;
}) {
  const data = useMemo(() => buildPoints(history), [history]);
  const latest = data.length > 0 ? data[data.length - 1] : null;
  // Above break-even the brand is making its money back, and that reads green. Below it
  // stays the ordinary text colour rather than turning red: a young brand is under 1x by
  // construction, and painting that red calls a campaign that has not finished learning
  // a failure. Same rule as the Campaigns table's ROI column.
  const good = latest != null && latest.roiMultiple > BREAK_EVEN;
  // Pipeline whose outcome carries no timestamp sits on no day, so it is counted in the
  // headline ROI and cannot be in this curve. When there is any, the last point and the
  // ROI stat card above legitimately differ — say so rather than let a reader find it.
  const undated = history?.undatedPipelineUsd ?? 0;

  return (
    <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-800">Return on spend</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Since your first dollar spent</p>
        </div>
        <div className="text-right">
          {pending ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p
              className={`text-2xl font-bold leading-none ${good ? "text-green-600" : "text-gray-900"}`}
            >
              {latest ? formatRoi(latest.roiMultiple) : "—"}
            </p>
          )}
          <p className="text-[11px] text-gray-400 mt-1">per dollar spent</p>
        </div>
      </div>

      {pending ? (
        <Skeleton className="flex-1 min-h-[180px] w-full rounded" />
      ) : history == null ? (
        <div className="flex flex-1 min-h-[180px] items-center justify-center px-6 text-center text-sm text-gray-500">
          We could not measure your return right now. It will reappear on its own.
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-1 min-h-[180px] items-center justify-center text-sm text-gray-400">
          Nothing spent yet.
        </div>
      ) : (
        <div className="flex-1 min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="roi-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* No background grid: the one horizontal worth drawing is break-even, and
                  a grid beside it makes the line that MEANS something look like chrome.
                  Coloured from `currentColor` so it survives both themes — a hardcoded
                  hex is invisible on one of them, and the html.dark remap does not reach
                  an SVG stroke attribute. */}
              <ReferenceLine
                y={BREAK_EVEN}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-gray-400"
                label={{
                  value: "break even",
                  position: "insideTopLeft",
                  fontSize: 10,
                  fill: "#94a3b8",
                }}
              />
              <XAxis
                dataKey="label"
                minTickGap={28}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tickFormatter={(value: number) => formatRoi(value)}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip content={<RoiTooltip />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="roiMultiple"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#roi-fill)"
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {!pending && undated > 0 && (
        <p className="mt-3 text-[11px] text-gray-400">
          {formatUsdAdaptive(undated)} of your pipeline has no date on it yet, so it
          counts in your ROI above but not in this line.
        </p>
      )}
    </div>
  );
}
