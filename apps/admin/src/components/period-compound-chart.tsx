"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatGrowthPct } from "@/lib/format-number";
import { chartDomain } from "@/lib/chart-domain";

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
  referenceValue,
  excludeFirstFromScale = false,
}: {
  data: PeriodCompoundPoint[];
  valueLabel: string;
  growthLabel: string;
  /** Tooltip value formatter (default: integer with thousand separators). */
  formatValue?: (n: number) => string;
  /** Y-axis tick formatter (default: same as formatValue). */
  formatAxis?: (n: number) => string;
  /**
   * Draw a solid horizontal line at this value. For retention it is 100: above
   * it the existing base grew on its own, below it the base shrank, and that
   * boundary is the only thing the chart is really asked.
   */
  referenceValue?: number;
  /**
   * Leave the FIRST bar out of the axis ceiling. Weekly retention's first
   * measurable week retains against a tiny base, so it lands in the hundreds of
   * percent and squashes every later week into a strip at the floor. It runs off
   * the top instead, marked clipped, with its real value still in the tooltip.
   */
  excludeFirstFromScale?: boolean;
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
  // An empty growth label means the caller has no growth series to show (a rate
  // of a rate reads as nothing on a retention chart). Rendering the line anyway
  // made recharts fall back to the dataKey, so the legend read "cmgrSolid".
  const showGrowth = growthLabel !== "";
  const scaled = referenceValue !== undefined || excludeFirstFromScale;
  const domain = chartDomain(
    data.map((d) => d.value),
    { excludeFirst: excludeFirstFromScale, floor: referenceValue }
  );
  const clipped = new Set(domain.clippedIndices);
  const chartData = data.map((d, i) => ({
    ...d,
    isCurrent: i === lastIndex,
    // Solid line runs to the last CONCLUDED period; the dashed tail spans the last
    // concluded period → the current one (they meet at index lastIndex - 1).
    cmgrSolid: i <= lastIndex - 1 ? d.cmgrPct : null,
    cmgrTail: i >= lastIndex - 1 ? d.cmgrPct : null,
    isClipped: clipped.has(i),
    // Plot the CAPPED value so a clipped bar's top stays inside the plot area
    // and the break mark can be drawn on it. `value` keeps the true number, so
    // the tooltip is unaffected and nothing is misreported.
    plotted: scaled ? Math.min(d.value, domain.max) : d.value,
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
            domain={scaled ? [0, domain.max] : undefined}
            allowDataOverflow={scaled}
            tickFormatter={(value) => axisFormat(Number(value))}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          {showGrowth ? (
          <YAxis
            yAxisId="growth"
            orientation="right"
            tickFormatter={(value) => `${Math.round(Number(value))}%`}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          ) : null}
          <Tooltip content={<ChartTooltip valueLabel={valueLabel} formatValue={formatValue} />} cursor={{ fill: "#f8fafc" }} />
          <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
          {referenceValue !== undefined ? (
            <ReferenceLine
              yAxisId="value"
              y={referenceValue}
              stroke="#475569"
              strokeWidth={1.5}
              ifOverflow="visible"
            />
          ) : null}
          <Bar
            yAxisId="value"
            dataKey="plotted"
            name={valueLabel}
            radius={[3, 3, 0, 0]}
            maxBarSize={48}
            shape={(props: unknown) => {
              const p = props as {
                x: number; y: number; width: number; height: number;
                fill?: string; stroke?: string; strokeWidth?: number; strokeDasharray?: string;
                background?: { y?: number };
                payload?: { isClipped?: boolean };
              };
              const bar = (
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.width}
                  height={Math.max(0, p.height)}
                  rx={3}
                  fill={p.fill}
                  stroke={p.stroke}
                  strokeWidth={p.strokeWidth}
                  strokeDasharray={p.strokeDasharray}
                />
              );
              if (!p.payload?.isClipped) return bar;
              // The break mark: two slashes across the top of a bar that runs
              // past the ceiling, so a truncated bar reads as truncated rather
              // than as a bar that happens to reach the top.
              // The bar is plotted at the capped value, so its top is inside
              // the plot area and the mark lands where the reader can see it.
              const markY = p.y;
              const cx = p.x + p.width / 2;
              return (
                <g>
                  {bar}
                  <rect x={p.x} y={markY} width={p.width} height={11} fill="#fff" />
                  <text
                    x={cx}
                    y={markY + 10}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={700}
                    fill={BAR_COLOR}
                  >
                    //
                  </text>
                </g>
              );
            }}
          >
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
          {showGrowth ? (
          <>
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
          </>
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
