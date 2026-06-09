"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyFunnelPoint } from "@/lib/public-stats";

type MetricKey = "landingVisitors" | "signups" | "cardsAdded" | "signupConversionPct" | "cardConversionPct";
type ChartSeries = {
  metric: MetricKey;
  color: string;
};

const METRIC_LABEL: Record<MetricKey, string> = {
  landingVisitors: "Unique visitors",
  signups: "Signups",
  cardsAdded: "Cards added",
  signupConversionPct: "Signup conversion",
  cardConversionPct: "Card conversion",
};

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatValue(value: number, metric: MetricKey): string {
  if (metric.endsWith("Pct")) return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString("en-US");
}

function ChartTooltip({
  active,
  payload,
  series,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: MetricKey; payload: DailyFunnelPoint; value: number; color?: string }>;
  series: ChartSeries[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const allowedMetrics = new Set(series.map((item) => item.metric));
  const rows = payload.filter((item) => item.dataKey && allowedMetrics.has(item.dataKey));
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{formatDateShort(point.date)}</p>
      <div className="mt-1 space-y-1">
        {rows.map((item) => {
          const metric = item.dataKey;
          if (!metric) return null;
          return (
            <p key={metric} className="flex items-center gap-2 font-semibold text-gray-900">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{formatValue(Number(item.value), metric)} {METRIC_LABEL[metric].toLowerCase()}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

export function PublicAnalyticsChart({
  data,
  metric,
  color,
  series,
}: {
  data: DailyFunnelPoint[];
  metric?: MetricKey;
  color?: string;
  series?: ChartSeries[];
}) {
  const chartSeries = series ?? (metric && color ? [{ metric, color }] : []);
  const primaryMetric = chartSeries[0]?.metric;
  if (chartSeries.length === 0 || !primaryMetric) {
    throw new Error("PublicAnalyticsChart requires either metric/color or series");
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
        No data yet.
      </div>
    );
  }

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            tickFormatter={(value) => formatValue(Number(value), primaryMetric)}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip content={<ChartTooltip series={chartSeries} />} />
          {chartSeries.length > 1 && (
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            />
          )}
          {chartSeries.map((item) => (
            <Line
              key={item.metric}
              type="monotone"
              dataKey={item.metric}
              name={METRIC_LABEL[item.metric]}
              dot={false}
              activeDot={{ r: 4 }}
              stroke={item.color}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
