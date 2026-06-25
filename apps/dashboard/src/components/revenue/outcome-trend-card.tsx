"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/skeleton";
import type { SignalSeries } from "@/lib/revenue-view";

/**
 * "Outcome" card — ONE cumulative line of the brand's single goal signal, from the
 * very beginning (no time-window picker). Clicks for a signups brand, positive
 * replies for a meetings brand. Renders only — the page selects which series feeds it.
 */

type OutcomePoint = { date: string; label: string; value: number };
type OutcomeChartPoint = {
  date: string;
  label: string;
  actualValue: number | null;
  projectedValue: number | null;
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

function formatAxis(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function finite(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Cumulative running total over the full daily series (ascending by date). */
function buildCumulative(series: SignalSeries | undefined): OutcomePoint[] {
  const daily = [...(series?.daily ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  let cumulative = 0;
  return daily.map((d) => {
    cumulative += finite(d.count);
    return { date: d.date, label: formatDate(d.date), value: cumulative };
  });
}

/**
 * Continues the cumulative line past today with the expected daily increments
 * (`future`, ascending, per-day). For a signups brand these are the clicks
 * forecast; for a meetings brand they're the monthly expected outcome spread
 * evenly across the forecast horizon. Rendered as a dashed segment that joins the
 * solid actual line at today.
 */
function buildChartPoints(
  series: SignalSeries | undefined,
  future: { date: string; value: number }[] | undefined,
): OutcomeChartPoint[] {
  const actual = buildCumulative(series);
  const startRun = actual.length > 0 ? actual[actual.length - 1].value : 0;
  let run = startRun;
  const projected = (future ?? []).map((f) => {
    run += finite(f.value);
    return { date: f.date, label: formatDate(f.date), value: run };
  });
  const points: OutcomeChartPoint[] = [
    ...actual.map((p) => ({
      date: p.date,
      label: p.label,
      actualValue: p.value,
      projectedValue: null as number | null,
    })),
    ...projected.map((p) => ({
      date: p.date,
      label: p.label,
      actualValue: null as number | null,
      projectedValue: p.value,
    })),
  ];
  // Join the dashed projection to the solid line at the last actual point.
  if (actual.length > 0 && projected.length > 0) {
    points[actual.length - 1].projectedValue = startRun;
  }
  return points;
}

function OutcomeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: OutcomeChartPoint }>;
  label: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const isProjected = point.actualValue == null;
  const value = point.actualValue ?? point.projectedValue ?? 0;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-gray-800">{formatDate(point.date)}</p>
      <p className="text-gray-500">
        {label}{" "}
        <span className="font-medium text-gray-800">
          {Math.round(value).toLocaleString("en-US")}
        </span>
        {isProjected && <span className="ml-1 text-gray-400">expected</span>}
      </p>
    </div>
  );
}

export function OutcomeTrendCard({
  series,
  future,
  label,
  color,
  pending = false,
}: {
  /** Cumulative source: `clicked` (signups) or `repliedPositive` (meetings). */
  series: SignalSeries | undefined;
  /** Expected daily increments past today (ascending) — the dashed forecast line. */
  future?: { date: string; value: number }[];
  /** Human label for the outcome ("Website clicks" / "Positive replies"). */
  label: string;
  /** Line + fill color. */
  color: string;
  pending?: boolean;
}) {
  const data = useMemo(() => buildChartPoints(series, future), [series, future]);
  const lastActual = [...data].reverse().find((p) => p.actualValue != null)?.actualValue;
  const total = series?.total ?? lastActual ?? 0;

  return (
    <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-800">Outcome</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{label} since launch</p>
        </div>
        <div className="text-right">
          {pending ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {total.toLocaleString("en-US")}
            </p>
          )}
          <p className="text-[11px] text-gray-400 mt-1">
            total {label.toLowerCase()}
          </p>
        </div>
      </div>

      {pending ? (
        <Skeleton className="flex-1 min-h-[180px] w-full rounded" />
      ) : data.length === 0 ? (
        <div className="flex flex-1 min-h-[180px] items-center justify-center text-sm text-gray-400">
          No {label.toLowerCase()} yet.
        </div>
      ) : (
        <div className="flex-1 min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="outcome-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                minTickGap={28}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tickFormatter={formatAxis}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={36}
                allowDecimals={false}
              />
              <Tooltip
                content={<OutcomeTooltip label={label} />}
                cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="actualValue"
                stroke={color}
                strokeWidth={2}
                fill="url(#outcome-fill)"
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="projectedValue"
                stroke={color}
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="none"
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
