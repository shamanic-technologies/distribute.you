"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyFunnelPoint } from "@/lib/public-stats";

type MetricKey = "landingVisitors" | "signups" | "cardsAdded" | "signupConversionPct" | "cardConversionPct";

const METRIC_LABEL: Record<MetricKey, string> = {
  landingVisitors: "Landing arrivals",
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
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: DailyFunnelPoint; value: number }>;
  metric: MetricKey;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{formatDateShort(point.date)}</p>
      <p className="mt-1 font-semibold text-gray-900">
        {formatValue(Number(payload[0].value), metric)} {METRIC_LABEL[metric].toLowerCase()}
      </p>
    </div>
  );
}

export function PublicAnalyticsChart({
  data,
  metric,
  color,
}: {
  data: DailyFunnelPoint[];
  metric: MetricKey;
  color: string;
}) {
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
            tickFormatter={(value) => formatValue(Number(value), metric)}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip content={<ChartTooltip metric={metric} />} />
          <Line
            type="monotone"
            dataKey={metric}
            dot={false}
            activeDot={{ r: 4 }}
            stroke={color}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
