"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface PeriodBarGrowthPoint {
  /** X-axis label, e.g. "Jul 2026" (month), "Jun 12" (week/day). */
  label: string;
  /** Bar value (count). */
  value: number;
  /** Period-over-period growth in percent; null on the first bucket. */
  growthPct: number | null;
}

const BAR_COLOR = "#6366f1";
const LINE_COLOR = "#f59e0b";

function formatGrowth(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function ChartTooltip({
  active,
  payload,
  valueLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: PeriodBarGrowthPoint }>;
  valueLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{point.label}</p>
      <p className="mt-1 flex items-center gap-2 font-semibold text-gray-900">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BAR_COLOR }} />
        {point.value.toLocaleString("en-US")} {valueLabel}
      </p>
      {point.growthPct !== null && (
        <p className="mt-1 flex items-center gap-2 font-semibold text-gray-900">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
          {formatGrowth(point.growthPct)} growth
        </p>
      )}
    </div>
  );
}

export function PeriodBarGrowthChart({
  data,
  valueLabel,
  growthLabel,
}: {
  data: PeriodBarGrowthPoint[];
  valueLabel: string;
  growthLabel: string;
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
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            minTickGap={16}
          />
          <YAxis
            yAxisId="value"
            tickFormatter={(value) => Math.round(Number(value)).toLocaleString("en-US")}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <YAxis
            yAxisId="growth"
            orientation="right"
            tickFormatter={(value) => `${Math.round(Number(value))}%`}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip content={<ChartTooltip valueLabel={valueLabel} />} cursor={{ fill: "#f8fafc" }} />
          <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
          <Bar yAxisId="value" dataKey="value" name={valueLabel} fill={BAR_COLOR} radius={[3, 3, 0, 0]} maxBarSize={48} />
          <Line
            yAxisId="growth"
            type="monotone"
            dataKey="growthPct"
            name={growthLabel}
            dot={false}
            activeDot={{ r: 4 }}
            stroke={LINE_COLOR}
            strokeWidth={2}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
