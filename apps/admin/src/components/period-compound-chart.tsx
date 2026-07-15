"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatGrowthPct } from "@/lib/format-number";

export interface PeriodCompoundPoint {
  /** X-axis label, e.g. "Jul 2026" (month) or "Jun 12" (week). */
  label: string;
  /** Bar value (count) for the period. */
  value: number;
  /** Compound growth rate since inception at this period, in percent. Null before the anchor. */
  cmgrPct: number | null;
}

const BAR_COLOR = "#6366f1";
const LINE_COLOR = "#f59e0b";

const defaultFormatValue = (n: number) => Math.round(n).toLocaleString("en-US");

function ChartTooltip({
  active,
  payload,
  valueLabel,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ payload: PeriodCompoundPoint & { isCurrent: boolean } }>;
  valueLabel: string;
  formatValue: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">
        {point.label}
        {point.isCurrent ? " (in progress)" : ""}
      </p>
      <p className="mt-1 flex items-center gap-2 font-semibold text-gray-900">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BAR_COLOR }} />
        {formatValue(point.value)} {valueLabel}
      </p>
      {point.cmgrPct !== null && (
        <p className="mt-1 flex items-center gap-2 font-semibold text-gray-900">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
          {formatGrowthPct(point.cmgrPct)} since inception
        </p>
      )}
    </div>
  );
}

/**
 * A period bar chart (value bars) with a compound-growth line (CMGR / CWGR since
 * inception). The final, still-in-progress period renders "in pencil": a hollow
 * dashed bar and a dashed line tail with a hollow dot, so a partial current
 * period reads as tentative rather than a final number.
 */
export function PeriodCompoundChart({
  data,
  valueLabel,
  growthLabel,
  formatValue = defaultFormatValue,
  formatAxis,
  tentativeCurrent = true,
}: {
  data: PeriodCompoundPoint[];
  valueLabel: string;
  growthLabel: string;
  /** Tooltip value formatter (default: integer with thousand separators). */
  formatValue?: (n: number) => string;
  /** Y-axis tick formatter (default: same as formatValue). */
  formatAxis?: (n: number) => string;
  /**
   * Draw the final period "in pencil" (hollow dashed bar + dashed line tail) to
   * signal a still-accumulating partial period. TRUE for flow metrics (realized
   * revenue). Set FALSE for a point-in-time snapshot metric (committed MRR/ARR),
   * where the current period is a real, complete value — a solid bar.
   */
  tentativeCurrent?: boolean;
}) {
  const axisFormat = formatAxis ?? formatValue;
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">
        No data yet.
      </div>
    );
  }

  const lastIndex = data.length - 1;
  const chartData = data.map((d, i) => ({
    ...d,
    isCurrent: tentativeCurrent && i === lastIndex,
    // Solid line runs to the last CONCLUDED period; the dashed tail spans the last
    // concluded period → the current one. When the current period is NOT tentative,
    // the solid line runs all the way and there is no dashed tail.
    cmgrSolid: !tentativeCurrent || i <= lastIndex - 1 ? d.cmgrPct : null,
    cmgrTail: tentativeCurrent && i >= lastIndex - 1 ? d.cmgrPct : null,
  }));

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            tickFormatter={(value) => axisFormat(Number(value))}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={52}
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
          <Tooltip content={<ChartTooltip valueLabel={valueLabel} formatValue={formatValue} />} cursor={{ fill: "#f8fafc" }} />
          <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
          <Bar yAxisId="value" dataKey="value" name={valueLabel} radius={[3, 3, 0, 0]} maxBarSize={48}>
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={d.isCurrent ? "transparent" : BAR_COLOR}
                stroke={d.isCurrent ? BAR_COLOR : undefined}
                strokeWidth={d.isCurrent ? 1.5 : 0}
                strokeDasharray={d.isCurrent ? "4 3" : undefined}
              />
            ))}
          </Bar>
          <Line
            yAxisId="growth"
            type="monotone"
            dataKey="cmgrSolid"
            name={growthLabel}
            dot={false}
            activeDot={{ r: 4 }}
            stroke={LINE_COLOR}
            strokeWidth={2}
            connectNulls={false}
          />
          <Line
            yAxisId="growth"
            type="monotone"
            dataKey="cmgrTail"
            legendType="none"
            dot={(props) => {
              const { cx, cy, index, key } = props as { cx?: number; cy?: number; index: number; key?: string };
              if (index !== lastIndex || cx == null || cy == null) return <g key={key ?? index} />;
              return <circle key={key ?? index} cx={cx} cy={cy} r={4} fill="#fff" stroke={LINE_COLOR} strokeWidth={2} />;
            }}
            activeDot={{ r: 4 }}
            stroke={LINE_COLOR}
            strokeWidth={2}
            strokeDasharray="5 4"
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
