"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BrandOptimizationGoal,
  PipelineActivityMetric,
  PipelineActivityMetricKey,
  PipelineActivityResponse,
} from "@/lib/api";
import type { SignalSeries } from "@/lib/revenue-view";

type ChartMetricKey = PipelineActivityMetricKey | "salesMeetings";

const MAX_SELECTED_METRICS = 2;
const RANGES = [7, 30, 90] as const;

const METRICS: Array<{
  key: ChartMetricKey;
  label: string;
  color: string;
}> = [
  { key: "outreach", label: "Outreach", color: "#334155" },
  { key: "opens", label: "Opens", color: "#4f46e5" },
  { key: "clicks", label: "Clicks", color: "#0891b2" },
  { key: "signups", label: "Signups", color: "#059669" },
];

const SALES_MEETINGS_METRIC = {
  key: "salesMeetings",
  label: "Sales meetings",
  color: "#dc2626",
} satisfies (typeof METRICS)[number];

type PipelineActualSeries = Partial<Record<ChartMetricKey, SignalSeries | undefined>>;

type ChartDatum = {
  date: string;
  label: string;
  phase: "actual" | "forecast";
  raw: Record<ChartMetricKey, PipelineActivityMetric>;
} & Record<`${ChartMetricKey}Actual`, number | null> &
  Record<`${ChartMetricKey}Forecast`, number | null>;

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

function buildPastDates(today: string, rangeDays: number): string[] {
  return Array.from({ length: rangeDays }, (_, i) => addDays(today, i - rangeDays + 1));
}

function buildDailyCountMap(series: SignalSeries | undefined): Map<string, number> {
  return new Map((series?.daily ?? []).map((d) => [d.date, finite(d.count)] as const));
}

function isOutcomeMetric(metric: ChartMetricKey): boolean {
  return metric === "signups" || metric === "salesMeetings";
}

function formatValue(n: number | null | undefined, metric: ChartMetricKey): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (!isOutcomeMetric(metric)) return Math.round(n).toLocaleString("en-US");
  if (n > 0 && n < 0.01) return "<0.01";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: n >= 10 ? 0 : 2,
  });
}

function formatAxis(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  if (n >= 10) return String(Math.round(n));
  if (n === 0) return "0";
  return n.toFixed(1).replace(/\.0$/, "");
}

function activeMetrics(optimizationGoal: BrandOptimizationGoal): typeof METRICS {
  if (optimizationGoal === "signups") return METRICS;
  return [...METRICS.slice(0, 3), SALES_MEETINGS_METRIC];
}

function projectedMetric(
  source: PipelineActivityMetric,
  conversionPct: number | null | undefined,
): PipelineActivityMetric {
  if (conversionPct == null || !Number.isFinite(conversionPct)) {
    return { actual: null, expected: null, conversionPct: null };
  }
  const rate = conversionPct / 100;
  return {
    actual: source.actual == null ? null : source.actual * rate,
    expected: source.expected == null ? null : source.expected * rate,
    conversionPct,
  };
}

function emptyMetrics(): Record<ChartMetricKey, PipelineActivityMetric> {
  return {
    outreach: { actual: null, expected: null },
    opens: { actual: null, expected: null },
    clicks: { actual: null, expected: null },
    signups: { actual: null, expected: null },
    salesMeetings: { actual: null, expected: null },
  };
}

function buildMetricValues(
  baseMetrics: Record<PipelineActivityMetricKey, PipelineActivityMetric>,
  optimizationGoal: BrandOptimizationGoal,
  visitToMeetingPct: number | null | undefined,
  visitToSignupPct: number | null | undefined,
): Record<ChartMetricKey, PipelineActivityMetric> {
  const projectedSalesMeetings = projectedMetric(baseMetrics.clicks, visitToMeetingPct);
  const explicitSalesMeetings = (
    baseMetrics as typeof baseMetrics & { salesMeetings?: PipelineActivityMetric }
  ).salesMeetings;
  return {
    ...baseMetrics,
    signups:
      optimizationGoal === "signups"
        ? {
            ...projectedMetric(baseMetrics.clicks, visitToSignupPct),
            expected: baseMetrics.signups.expected,
          }
        : baseMetrics.signups,
    salesMeetings: explicitSalesMeetings
      ? { ...projectedSalesMeetings, actual: explicitSalesMeetings.actual }
      : projectedSalesMeetings,
  };
}

function forecastStartValue(
  datum: ChartDatum,
  metric: ChartMetricKey,
  fallback: PipelineActivityMetric,
): number | null {
  const actual = datum[`${metric}Actual`];
  if (actual != null) return actual;
  return fallback.expected == null ? null : finite(fallback.expected);
}

function buildChartData({
  data,
  pipelineActualSeries,
  rangeDays,
  optimizationGoal,
  visitToMeetingPct,
  visitToSignupPct,
}: {
  data: PipelineActivityResponse;
  pipelineActualSeries: PipelineActualSeries | undefined;
  rangeDays: number;
  optimizationGoal: BrandOptimizationGoal;
  visitToMeetingPct: number | null | undefined;
  visitToSignupPct: number | null | undefined;
}): ChartDatum[] {
  const today = data.days.find((day) => day.isToday)?.date ?? formatIsoDate(new Date());
  const maps: Partial<Record<ChartMetricKey, Map<string, number>>> = {};
  for (const metric of activeMetrics(optimizationGoal)) {
    maps[metric.key] = buildDailyCountMap(pipelineActualSeries?.[metric.key]);
  }

  const actualRows = buildPastDates(today, rangeDays).map((date) => {
    const raw = emptyMetrics();
    for (const metric of activeMetrics(optimizationGoal)) {
      raw[metric.key] = {
        actual: maps[metric.key]?.get(date) ?? 0,
        expected: null,
      };
    }
    const values = buildMetricValues(
      {
        outreach: raw.outreach,
        opens: raw.opens,
        clicks: raw.clicks,
        signups: raw.signups,
      },
      optimizationGoal,
      visitToMeetingPct,
      visitToSignupPct,
    );
    const datum: Partial<ChartDatum> = {
      date,
      label: date === today ? "Today" : formatDate(date),
      phase: "actual",
      raw: values,
    };
    for (const metric of activeMetrics(optimizationGoal)) {
      datum[`${metric.key}Actual`] = finite(values[metric.key].actual);
      datum[`${metric.key}Forecast`] = null;
    }
    return datum as ChartDatum;
  });

  const forecastRows = data.days
    .filter((day) => day.date !== today)
    .map((day) => {
      const values = buildMetricValues(
        day.metrics,
        optimizationGoal,
        visitToMeetingPct,
        visitToSignupPct,
      );
      const datum: Partial<ChartDatum> = {
        date: day.date,
        label: formatDate(day.date),
        phase: "forecast",
        raw: values,
      };
      for (const metric of activeMetrics(optimizationGoal)) {
        datum[`${metric.key}Actual`] = null;
        datum[`${metric.key}Forecast`] = values[metric.key].expected == null
          ? null
          : finite(values[metric.key].expected);
      }
      return datum as ChartDatum;
    });

  if (actualRows.length > 0 && data.days.length > 0) {
    const todayForecast = buildMetricValues(
      data.days.find((day) => day.isToday)?.metrics ?? data.days[0].metrics,
      optimizationGoal,
      visitToMeetingPct,
      visitToSignupPct,
    );
    const lastActual = actualRows[actualRows.length - 1];
    for (const metric of activeMetrics(optimizationGoal)) {
      lastActual[`${metric.key}Forecast`] = forecastStartValue(
        lastActual,
        metric.key,
        todayForecast[metric.key],
      );
    }
  }

  return [...actualRows, ...forecastRows];
}

function ChartTooltip({
  active,
  payload,
  selectedMetrics,
  metrics,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
  selectedMetrics: ChartMetricKey[];
  metrics: ReturnType<typeof activeMetrics>;
}) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-2 font-medium text-gray-800">{formatDate(day.date)}</p>
      <div className="space-y-1.5">
        {selectedMetrics.map((key) => {
          const metric = metrics.find((m) => m.key === key);
          if (!metric) return null;
          const color = metric.color;
          const actualValue = day[`${key}Actual`];
          const forecastValue = day[`${key}Forecast`];
          return (
            <div key={key} className="space-y-1">
              <div className="grid grid-cols-[10px_82px_1fr] items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-gray-500">{metric.label}</span>
                <span className="font-medium text-gray-800">
                  Actual {formatValue(actualValue, metric.key)}
                </span>
              </div>
              {forecastValue != null && (
                <div className="grid grid-cols-[10px_82px_1fr] items-center gap-2 text-gray-500">
                  <span
                    className="h-0.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>Forecast</span>
                  <span>{formatValue(forecastValue, metric.key)}</span>
                </div>
              )}
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
  visitToMeetingPct,
  visitToSignupPct,
}: {
  data: PipelineActivityResponse;
  pipelineActualSeries?: PipelineActualSeries;
  optimizationGoal: BrandOptimizationGoal;
  visitToMeetingPct: number | null | undefined;
  visitToSignupPct: number | null | undefined;
}) {
  const metrics = activeMetrics(optimizationGoal);
  const outcomeMetric = optimizationGoal === "signups" ? "signups" : "salesMeetings";
  const [rangeDays, setRangeDays] = useState<(typeof RANGES)[number]>(30);
  const [selectedMetrics, setSelectedMetrics] = useState<ChartMetricKey[]>([
    "outreach",
    outcomeMetric,
  ]);

  const chartData = useMemo(
    () =>
      buildChartData({
        data,
        pipelineActualSeries,
        rangeDays,
        optimizationGoal,
        visitToMeetingPct,
        visitToSignupPct,
      }),
    [
      data,
      pipelineActualSeries,
      rangeDays,
      optimizationGoal,
      visitToMeetingPct,
      visitToSignupPct,
    ],
  );

  function toggleMetric(key: ChartMetricKey) {
    setSelectedMetrics((current) => {
      if (current.includes(key)) {
        return current.length === 1 ? current : current.filter((m) => m !== key);
      }
      return [...current.slice(-(MAX_SELECTED_METRICS - 1)), key];
    });
  }

  if (data.days.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
        No activity forecast yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.map((metric) => {
            const active = selectedMetrics.includes(metric.key);
            const total = pipelineActualSeries?.[metric.key]?.total ?? 0;
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => toggleMetric(metric.key)}
                className={`min-h-[68px] rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-gray-300 bg-white shadow-sm"
                    : "border-gray-200 bg-gray-50 hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: metric.color }}
                  />
                  {metric.label}
                </span>
                <span className="mt-2 block text-xl font-semibold text-gray-900">
                  {formatValue(total, metric.key)}
                </span>
              </button>
            );
          })}
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

      <div className="overflow-x-auto">
        <div className="h-[300px] min-w-[760px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
              <defs>
                {metrics.map((metric) => (
                  <linearGradient
                    key={metric.key}
                    id={`pipeline-${metric.key}-fill`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={metric.color} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                minTickGap={24}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={formatAxis}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={formatAxis}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    selectedMetrics={selectedMetrics}
                    metrics={metrics}
                  />
                }
                cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
              />
              {selectedMetrics.map((key, index) => {
                const metric = metrics.find((m) => m.key === key);
                if (!metric) return null;
                const yAxisId = index === 0 ? "left" : "right";
                return (
                  <Area
                    key={`${key}-actual`}
                    yAxisId={yAxisId}
                    type="monotone"
                    dataKey={`${key}Actual`}
                    stroke={metric.color}
                    strokeWidth={2}
                    fill={`url(#pipeline-${key}-fill)`}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                );
              })}
              {selectedMetrics.map((key, index) => {
                const metric = metrics.find((m) => m.key === key);
                if (!metric) return null;
                const yAxisId = index === 0 ? "left" : "right";
                return (
                  <Line
                    key={`${key}-forecast`}
                    yAxisId={yAxisId}
                    type="monotone"
                    dataKey={`${key}Forecast`}
                    stroke={metric.color}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
