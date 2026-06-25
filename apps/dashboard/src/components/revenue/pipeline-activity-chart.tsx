"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BrandOptimizationGoal,
  PipelineActivityMetric,
  PipelineActivityResponse,
} from "@/lib/api";
import type { SignalSeries } from "@/lib/revenue-view";

/**
 * Outreach activity — per-day BARS of the three outreach signals (outreach, opens,
 * and the goal's engagement: clicks for signups / positive replies for meetings),
 * across the past (actuals from the /revenue snapshot) + today + forecast days
 * (expected from pipeline-activity). 7/30/90-day window toggle. Each metric stacks
 * actual + remaining-expected so a single day reads as one bar per metric.
 */

type ChartMetricKey = "outreach" | "opens" | "clicks" | "repliedPositive";

const RANGES = [7, 30, 90] as const;

type MetricDef = {
  key: ChartMetricKey;
  label: string;
  actual: string;
  expected: string;
};

const OUTREACH: MetricDef = { key: "outreach", label: "Outreach", actual: "#334155", expected: "#cbd5e1" };
const OPENS: MetricDef = { key: "opens", label: "Opens", actual: "#4f46e5", expected: "#c7d2fe" };
const CLICKS: MetricDef = { key: "clicks", label: "Clicks", actual: "#0891b2", expected: "#bae6fd" };
const POSITIVE_REPLIES: MetricDef = {
  key: "repliedPositive",
  label: "Positive replies",
  actual: "#dc2626",
  expected: "#fecaca",
};

/** Bars with NO pipeline-activity forecast (no projection rate) get expected = 0. */
const FORECASTABLE: ReadonlySet<ChartMetricKey> = new Set(["outreach", "opens", "clicks"]);

type PipelineActualSeries = Partial<Record<string, SignalSeries | undefined>>;

type ChartDatum = {
  date: string;
  label: string;
  isToday: boolean;
  isFuture: boolean;
  raw: Record<ChartMetricKey, { actual: number; expected: number }>;
} & Record<`${ChartMetricKey}Actual`, number> &
  Record<`${ChartMetricKey}ExpectedRemaining`, number>;

function finite(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
}

function dateObject(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, delta: number): string {
  const d = dateObject(date);
  d.setUTCDate(d.getUTCDate() + delta);
  return formatIsoDate(d);
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

/**
 * Past+today calendar dates for the window, left-edge CLAMPED to the first day the
 * brand has actual data — so a brand launched today shows only today (+ forecast),
 * never empty leading days. Window = [max(today−range+1, firstDataDate) … today].
 */
function buildWindowDates(
  today: string,
  rangeDays: number,
  firstDataDate: string | undefined,
): string[] {
  const windowStart = addDays(today, -(rangeDays - 1));
  let start = firstDataDate && firstDataDate > windowStart ? firstDataDate : windowStart;
  if (start > today) start = today;
  const out: string[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) out.push(d);
  return out;
}

function buildDailyCountMap(series: SignalSeries | undefined): Map<string, number> {
  return new Map((series?.daily ?? []).map((d) => [d.date, finite(d.count)] as const));
}

function activeMetrics(optimizationGoal: BrandOptimizationGoal): MetricDef[] {
  return optimizationGoal === "signups"
    ? [OUTREACH, OPENS, CLICKS]
    : [OUTREACH, OPENS, POSITIVE_REPLIES];
}

function forecastExpected(
  metrics: Record<string, PipelineActivityMetric> | undefined,
  key: ChartMetricKey,
): number {
  if (!metrics || !FORECASTABLE.has(key)) return 0;
  return finite(metrics[key]?.expected);
}

function buildChartData({
  data,
  pipelineActualSeries,
  rangeDays,
  optimizationGoal,
}: {
  data: PipelineActivityResponse;
  pipelineActualSeries: PipelineActualSeries | undefined;
  rangeDays: number;
  optimizationGoal: BrandOptimizationGoal;
}): ChartDatum[] {
  const today = data.days.find((day) => day.isToday)?.date ?? formatIsoDate(new Date());
  const metrics = activeMetrics(optimizationGoal);
  const maps: Partial<Record<ChartMetricKey, Map<string, number>>> = {};
  for (const metric of metrics) {
    maps[metric.key] = buildDailyCountMap(pipelineActualSeries?.[metric.key]);
  }
  const forecastByDate = new Map(data.days.map((day) => [day.date, day.metrics]));

  // First day the brand has ANY actual signal — clamps the window's left edge.
  let firstDataDate: string | undefined;
  for (const metric of metrics) {
    for (const date of maps[metric.key]?.keys() ?? []) {
      if (!firstDataDate || date < firstDataDate) firstDataDate = date;
    }
  }

  const pastDates = buildWindowDates(today, rangeDays, firstDataDate); // includes today (last entry)
  const futureDates = data.days
    .filter((day) => day.date > today)
    .map((day) => day.date);

  return [...pastDates, ...futureDates].map((date) => {
    const isToday = date === today;
    const isFuture = date > today;
    const forecastMetrics = forecastByDate.get(date);
    const raw = {} as ChartDatum["raw"];
    const datum: Partial<ChartDatum> = {
      date,
      label: isToday ? "Today" : formatDate(date),
      isToday,
      isFuture,
      raw,
    };
    for (const metric of metrics) {
      const actual = isFuture ? 0 : finite(maps[metric.key]?.get(date));
      // Today shows ACTUAL-so-far only (no expected ghost); only future days carry
      // the forecast. Past days are pure actuals.
      const expected = isFuture ? forecastExpected(forecastMetrics, metric.key) : 0;
      const expectedRemaining = isFuture ? expected : 0;
      raw[metric.key] = { actual, expected };
      datum[`${metric.key}Actual`] = actual;
      datum[`${metric.key}ExpectedRemaining`] = expectedRemaining;
    }
    return datum as ChartDatum;
  });
}

function ChartTooltip({
  active,
  payload,
  metrics,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  metrics: MetricDef[];
}) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-2 font-medium text-gray-800">
        {day.isToday ? "Today" : formatDate(day.date)}
      </p>
      <div className="space-y-1.5">
        {metrics.map((metric) => {
          const value = day.raw[metric.key];
          // Past + today → ACTUAL so far; only future days read as "expected".
          const showActual = !day.isFuture;
          const display = showActual ? value.actual : value.expected;
          const color = showActual ? metric.actual : metric.expected;
          return (
            <div key={metric.key} className="grid grid-cols-[10px_96px_1fr] items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-gray-500">{metric.label}</span>
              <span className="font-medium text-gray-800">
                {Math.round(display).toLocaleString("en-US")}
                {!showActual && value.expected > 0 && (
                  <span className="ml-1 font-normal text-gray-400">expected</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineActivityChart({
  data,
  pipelineActualSeries,
  optimizationGoal,
}: {
  data: PipelineActivityResponse;
  pipelineActualSeries?: PipelineActualSeries;
  optimizationGoal: BrandOptimizationGoal;
  /** Kept for call-site compatibility; projection no longer happens client-side. */
  visitToMeetingPct?: number | null;
  visitToSignupPct?: number | null;
}) {
  const metrics = activeMetrics(optimizationGoal);
  const [rangeDays, setRangeDays] = useState<(typeof RANGES)[number]>(7);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(
    () => buildChartData({ data, pipelineActualSeries, rangeDays, optimizationGoal }),
    [data, pipelineActualSeries, rangeDays, optimizationGoal],
  );

  // Keep the live edge (today + forecast) in view — wider windows would otherwise
  // scroll the meaningful right side off-screen behind the empty older past days.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [rangeDays, chartData.length]);

  if (data.days.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
        No activity yet.
      </div>
    );
  }

  // ~26px per day-group keeps grouped bars legible; scrolls horizontally past the
  // viewport for the 30/90-day windows.
  const minWidth = Math.max(760, chartData.length * 26);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-500">
          {metrics.map((metric) => (
            <span key={metric.key} className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-2.5 w-4 overflow-hidden rounded-sm border border-white/60">
                <span className="h-full flex-1" style={{ backgroundColor: metric.actual }} />
                <span className="h-full flex-1" style={{ backgroundColor: metric.expected }} />
              </span>
              {metric.label}
            </span>
          ))}
        </div>
        <div className="inline-flex w-fit rounded-lg border border-gray-200 bg-gray-50 p-1">
          {RANGES.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRangeDays(days)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                rangeDays === days
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              Past {days} days
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="overflow-x-auto">
        <div className="h-[300px]" style={{ minWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 16, left: 0, bottom: 0 }}
              barCategoryGap="18%"
              barGap={3}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                minTickGap={16}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                tickFormatter={formatAxis}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip metrics={metrics} />}
                cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              />
              {metrics.map((metric) => (
                <Bar
                  key={`${metric.key}-actual`}
                  dataKey={`${metric.key}Actual`}
                  stackId={metric.key}
                  fill={metric.actual}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={20}
                  isAnimationActive={false}
                />
              ))}
              {metrics.map((metric) => (
                <Bar
                  key={`${metric.key}-expected`}
                  dataKey={`${metric.key}ExpectedRemaining`}
                  stackId={metric.key}
                  fill={metric.expected}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={20}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
