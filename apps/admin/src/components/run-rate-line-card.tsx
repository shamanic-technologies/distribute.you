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
import { PERIOD_NOUN, type CmgrUnit } from "@/components/cmgr-stat";
import { Skeleton } from "@/components/skeleton";
import { formatGrowthPct } from "@/lib/format-number";
import { lineDomain } from "@/lib/chart-domain";
import type { RevenueBucket } from "@/lib/revenue-buckets";
import type { RunRateSummary } from "@/lib/revenue-buckets";

/**
 * The run-rate card, in the shape the category reads: the figure first, its
 * compound rate beside it, and one line under both.
 *
 * It is a SECOND card rather than a mode on `PeriodCompoundCard`, and the split
 * is the point. That card draws a bar per period with a growth line on a second
 * axis, which is right for a FLOW — a bar's length is the quantity earned in the
 * period, and the axis has to start at zero for the lengths to mean anything. A
 * run-rate is a STOCK: no period "earns" it, the bars all reach nearly the same
 * height, and the growth line is a second series answering a question the card
 * already states in words above the plot. So this draws one line, on an axis
 * bracketing the data, with nothing else on it.
 *
 * Deliberately absent, and each for a reason:
 *  - **The growth line.** It plots the compound rate at every period, which is a
 *    cumulative rate from one fixed anchor — a converging curve whose shape says
 *    nothing a reader acts on, on a second axis in a second unit. The rate is
 *    stated once, in the headline, where it is a number rather than a shape.
 *  - **Bars.** See above; a stock has no per-period area.
 *  - **A legend.** One series needs no key.
 *  - **A previous-period series.** The category's cards overlay the equal-length
 *    window before the charted one, dotted. Ours cannot: the run-rate record
 *    starts at the first charted period, so that window is not merely empty, it
 *    is before anything was recorded. Drawing it would be invention.
 */
export function RunRateLineCard({
  label,
  subtitle,
  summary,
  buckets,
  cmgrLabel,
  cmgrUnit,
  formatValue,
  formatAxis,
  pending = false,
}: {
  label: string;
  subtitle: string;
  summary: RunRateSummary;
  buckets: RevenueBucket[];
  cmgrLabel: string;
  cmgrUnit: CmgrUnit;
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
  pending?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {pending ? (
        <Skeleton className="h-16 w-48 rounded" />
      ) : (
        <RunRateHeadline
          label={label}
          subtitle={subtitle}
          summary={summary}
          buckets={buckets}
          cmgrLabel={cmgrLabel}
          cmgrUnit={cmgrUnit}
          formatValue={formatValue}
        />
      )}
      <div className="mt-5">
        {pending ? (
          <Skeleton className="h-[240px] w-full rounded" />
        ) : (
          <RunRateLine buckets={buckets} formatValue={formatValue} formatAxis={formatAxis} label={label} />
        )}
      </div>
    </div>
  );
}

/**
 * The figure, its rate, and the anchor it grew from.
 *
 * The rate is LABELLED (`+13.2% CMGR`) rather than printed bare beside the
 * value, because the line under it states the anchor's own figure — and a bare
 * percentage next to two money values reads as the ratio between them, which a
 * compound rate is not. Labelling it is what lets both be on the card at once.
 */
function RunRateHeadline({
  label,
  subtitle,
  summary,
  buckets,
  cmgrLabel,
  cmgrUnit,
  formatValue,
}: {
  label: string;
  subtitle: string;
  summary: RunRateSummary;
  buckets: RevenueBucket[];
  cmgrLabel: string;
  cmgrUnit: CmgrUnit;
  formatValue: (n: number) => string;
}) {
  const anchor = buckets.find((b) => b.value > 0) ?? null;
  const rising = summary.cmgrPct !== null && summary.cmgrPct > 0;

  return (
    <div>
      <p className="text-sm font-semibold text-gray-500" title={subtitle}>
        {label}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <p className="text-3xl font-semibold tracking-tight text-gray-950">
          {summary.latestUsd === null ? "—" : formatValue(summary.latestUsd)}
        </p>
        {summary.cmgrPct !== null && (
          <span className={`text-sm font-semibold ${rising ? "text-emerald-600" : "text-gray-500"}`}>
            {formatGrowthPct(summary.cmgrPct)} {cmgrLabel}
            {summary.periodsSpanned !== null &&
              ` (${PERIOD_NOUN[cmgrUnit]} #${summary.periodsSpanned})`}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm text-gray-400">
        {summary.cmgrPct === null || anchor === null
          ? // Not a dash: a dash beside a growth label reads as a rate measured at
            // nothing, where the truth is that one period is not a rate at all.
            "Not enough history yet to state a growth rate"
          : `from ${formatValue(anchor.value)} in ${anchor.label}`}
      </p>
    </div>
  );
}

/**
 * An x-axis tick anchored to its own end of the plot.
 *
 * recharts centres a tick on its point, which puts half the first label outside
 * the plot area where it is clipped — a "Jul 13" that renders as "3". Only the
 * two ends are labelled here, so each is anchored outward instead.
 */
function EndAnchoredTick(props: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  lastLabel?: string;
}) {
  const { x = 0, y = 0, payload, lastLabel } = props;
  const value = payload?.value ?? "";
  const anchor = value === lastLabel ? "end" : "start";
  return (
    <text x={x} y={y} dy={12} textAnchor={anchor} fontSize={12} fill="#94a3b8">
      {value}
    </text>
  );
}

/** Indigo, the colour every /metrics chart already draws its value series in. */
const LINE_COLOR = "#6366f1";

function LineTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; value: number } }>;
  label: string;
  formatValue: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{point.label}</p>
      <p className="mt-1 flex items-center gap-2 font-semibold text-gray-900">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
        {formatValue(point.value)} {label}
      </p>
    </div>
  );
}

function RunRateLine({
  buckets,
  formatValue,
  formatAxis,
  label,
}: {
  buckets: RevenueBucket[];
  formatValue: (n: number) => string;
  formatAxis: (n: number) => string;
  label: string;
}) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-gray-400">No data yet.</div>
    );
  }

  const domain = lineDomain(buckets.map((b) => b.value));
  // Only the ends are labelled. A run-rate card is read for its shape and its
  // span, and every label in between is ink the reader does not use — the
  // tooltip names any period they point at.
  const lastLabel = buckets[buckets.length - 1].label;
  const endTicks = buckets.length > 1 ? [buckets[0].label, lastLabel] : [buckets[0].label];

  return (
    // `text-gray-200` carries an `html.dark` remap; the grid's `currentColor`
    // resolves off it, so the lines stay faint on both themes where a hardcoded
    // hex would be invisible on one.
    <div className="h-[240px] text-gray-200">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={buckets} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          {/* One axis, so the grid resolves its ticks — the shared bar chart names
              two and had to drop its grid entirely for that reason. */}
          <CartesianGrid stroke="currentColor" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="label"
            ticks={endTicks}
            // recharts centres a tick on its point, so the first label runs off the
            // left edge and gets clipped by the plot area — "Jul 13" reads as "3".
            // The ends are anchored to the ends instead, which is also how the
            // reference card reads: one label flush left, one flush right.
            tick={<EndAnchoredTick lastLabel={lastLabel} />}
            tickLine={false}
            axisLine={{ stroke: "currentColor" }}
            interval="preserveStartEnd"
          />
          <YAxis
            orientation="right"
            domain={[domain.min, domain.max]}
            ticks={domain.ticks}
            tickFormatter={(v) => formatAxis(Number(v))}
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip content={<LineTooltip label={label} formatValue={formatValue} />} />
          <Line
            // LINEAR, not monotone: a spline invents a shape between two points,
            // and a three-month run-rate drawn as a curve reads as a trajectory
            // nobody measured. With a dense series the two are indistinguishable,
            // so there is nothing to trade away.
            type="linear"
            dataKey="value"
            stroke={LINE_COLOR}
            strokeWidth={3}
            strokeLinecap="round"
            dot={false}
            activeDot={{ r: 4, fill: LINE_COLOR, stroke: "#fff", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
