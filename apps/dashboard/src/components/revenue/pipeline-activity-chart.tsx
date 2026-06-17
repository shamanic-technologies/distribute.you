"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  PipelineActivityDay,
  PipelineActivityMetricKey,
  PipelineActivityResponse,
} from "@/lib/api";

const METRICS: Array<{
  key: PipelineActivityMetricKey;
  label: string;
  actual: string;
  expected: string;
}> = [
  { key: "outreach", label: "Outreach", actual: "#334155", expected: "#cbd5e1" },
  { key: "opens", label: "Opens", actual: "#4f46e5", expected: "#c7d2fe" },
  { key: "clicks", label: "Clicks", actual: "#0891b2", expected: "#bae6fd" },
  { key: "signups", label: "Signups", actual: "#059669", expected: "#bbf7d0" },
];

type ChartDatum = {
  date: string;
  label: string;
  isToday: boolean;
  raw: PipelineActivityDay["metrics"];
} & Record<`${PipelineActivityMetricKey}Actual`, number> &
  Record<`${PipelineActivityMetricKey}ExpectedRemaining`, number>;

type BarLabelProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: unknown;
  payload?: ChartDatum;
};

function finite(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
}

function dateObject(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDayLabel(day: PipelineActivityDay): string {
  if (day.isToday) return "Today";
  return dateObject(day.date).toLocaleDateString("en-US", { weekday: "short" });
}

function formatDate(date: string): string {
  return dateObject(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatValue(n: number | null | undefined, metric: PipelineActivityMetricKey): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (metric !== "signups") return Math.round(n).toLocaleString("en-US");
  if (n > 0 && n < 0.01) return "<0.01";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: n >= 10 ? 0 : 2,
  });
}

function formatAxis(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  if (n >= 10) return String(Math.round(n));
  if (n === 0) return "0";
  return n.toFixed(1).replace(/\\.0$/, "");
}

function visiblePointSize(value: unknown): number {
  return typeof value === "number" && value > 0 ? 3 : 0;
}

function numericCoord(n: number | string | undefined): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string") {
    const parsed = Number(n);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function renderBarLabel(
  props: BarLabelProps,
  metricKey: PipelineActivityMetricKey,
  kind: "actual" | "expected",
) {
  const day = props.payload;
  const x = numericCoord(props.x);
  const y = numericCoord(props.y);
  const width = numericCoord(props.width);
  if (!day || x == null || y == null || width == null) return null;

  const actual = finite(day.raw[metricKey].actual);
  const expected = finite(day.raw[metricKey].expected);
  const expectedRemaining = day[`${metricKey}ExpectedRemaining`];
  const renderedValue = typeof props.value === "number" ? props.value : 0;

  if (kind === "expected") {
    if (renderedValue <= 0 || expected <= 0) return null;
    return (
      <text
        x={x + width / 2}
        y={Math.max(10, y - 6)}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#475569"
      >
        {formatValue(expected, metricKey)}
      </text>
    );
  }

  if (actual <= 0 || expectedRemaining > 0) return null;
  return (
    <text
      x={x + width / 2}
      y={Math.max(10, y - 6)}
      textAnchor="middle"
      fontSize={10}
      fontWeight={700}
      fill="#475569"
    >
      {formatValue(actual, metricKey)}
    </text>
  );
}

function buildChartData(days: PipelineActivityDay[]): ChartDatum[] {
  return days.map((day) => {
    const datum: Partial<ChartDatum> = {
      date: day.date,
      label: formatDayLabel(day),
      isToday: day.isToday,
      raw: day.metrics,
    };

    for (const metric of METRICS) {
      const value = day.metrics[metric.key];
      const actual = day.isToday ? finite(value.actual) : 0;
      const expected = finite(value.expected);
      datum[`${metric.key}Actual`] = actual;
      datum[`${metric.key}ExpectedRemaining`] = Math.max(expected - actual, 0);
    }

    return datum as ChartDatum;
  });
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-2 font-medium text-gray-800">
        {day.isToday ? "Today" : formatDate(day.date)}
      </p>
      <div className="space-y-1.5">
        {METRICS.map((metric) => {
          const value = day.raw[metric.key];
          return (
            <div key={metric.key} className="grid grid-cols-[76px_1fr] gap-3">
              <span className="text-gray-500">{metric.label}</span>
              <span className="font-medium text-gray-800">
                {day.isToday ? `${formatValue(value.actual, metric.key)} / ` : ""}
                {formatValue(value.expected, metric.key)}
                {metric.key === "signups" && value.conversionPct != null ? (
                  <span className="ml-1 font-normal text-gray-400">
                    @ {value.conversionPct.toLocaleString("en-US", { maximumFractionDigits: 2 })}%
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PipelineActivityChart({ data }: { data: PipelineActivityResponse }) {
  if (data.days.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
        No activity forecast yet.
      </div>
    );
  }

  const chartData = buildChartData(data.days);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-500">
        {METRICS.map((metric) => (
          <span key={metric.key} className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-2.5 w-4 overflow-hidden rounded-sm border border-white/60">
              <span className="h-full flex-1" style={{ backgroundColor: metric.actual }} />
              <span className="h-full flex-1" style={{ backgroundColor: metric.expected }} />
            </span>
            {metric.label}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <div className="h-[300px] min-w-[1120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 28, right: 16, left: 0, bottom: 0 }}
              barCategoryGap="18%"
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
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
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
              {METRICS.map((metric) => (
                <Bar
                  key={`${metric.key}-actual`}
                  dataKey={`${metric.key}Actual`}
                  stackId={metric.key}
                  fill={metric.actual}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                  minPointSize={visiblePointSize}
                  isAnimationActive
                >
                  <LabelList content={(props) => renderBarLabel(props, metric.key, "actual")} />
                </Bar>
              ))}
              {METRICS.map((metric) => (
                <Bar
                  key={`${metric.key}-expected`}
                  dataKey={`${metric.key}ExpectedRemaining`}
                  stackId={metric.key}
                  fill={metric.expected}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                  minPointSize={visiblePointSize}
                  isAnimationActive
                >
                  <LabelList content={(props) => renderBarLabel(props, metric.key, "expected")} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
