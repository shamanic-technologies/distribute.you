"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/skeleton";
import { LearningTag } from "@/components/learning-tag";
import { formatUsdAdaptive } from "@/lib/format-number";
import { placeholderCostCurve } from "@/lib/cost-per-outcome-placeholder";
import {
  asymptoteTail,
  asymptoteTailPoints,
  type BestWorkflowFloor,
} from "@/lib/cost-per-outcome-asymptote";
import type { CostPerOutcomeHistory } from "@/lib/revenue-view";

/**
 * "Cost per <outcome>" — what one outcome has cost, day by day, beside the per-day
 * outreach bars.
 *
 * The bars on its left say how much we DID; this says what it bought. A campaign is run
 * to make one outcome cheaper, so the trajectory is the thing a customer is actually
 * watching, and until now the page could state the price today and nothing about where
 * it came from.
 *
 * CAMPAIGN-ONLY by construction: it rides the same gate the outreach bars ride, and
 * those describe one acquisition channel. A brand runs several channels and several
 * funnels at once and states no single outcome, so neither card renders there.
 *
 * Every figure is SERVED. Nothing here divides a spend by a count — the repo forbids a
 * browser-computed metric, and the reason bites exactly here: an outcome that carries no
 * timestamp is counted in the scope's total and sits on no day, so a cumulative sum taken
 * in the browser understates the denominator and this curve's last point stops matching
 * the price printed on the stat row above. One number, two ways, one screen.
 */

/**
 * One plotted point, in the SAME shape for both modes.
 *
 * Recharts takes one data array, so the placeholder and the served curve share a shape
 * rather than each carrying its own keys — otherwise every axis and series below needs a
 * branch, and each branch is a place for the two to drift apart visually.
 *
 * `date` is null on the placeholder: it has no day, which is exactly why that mode prints
 * no tick and offers no tooltip.
 */
interface PlotPoint {
  date: string | null;
  label: string;
  /** The SOLID line — what an outcome has cost. Null past today, so the line stops there. */
  value: number | null;
  /**
   * The DOTTED line — where the floor would take it. Null on every real day but the LAST,
   * where both are set so the two lines meet rather than leaving a gap at the join.
   */
  tail?: number | null;
}

/**
 * An outcome count is FRACTIONAL below an entry leg (the driver signal walked through the
 * funnel's rates), so it rounds for display rather than printing `2.4 outcomes` — while
 * never rounding a non-zero share down to `0`, which would state that nothing is missing.
 */
function formatOutcomeCount(n: number): string {
  return n > 0 && n < 1 ? "Some" : Math.round(n).toLocaleString("en-US");
}

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

/**
 * A day whose cost is `null` is DROPPED rather than plotted at zero: nothing of the
 * outcome had landed, so there was no denominator, and zero would read as "this was
 * free". Same treatment the return curve gives a day it cannot divide.
 */
function buildPoints(history: CostPerOutcomeHistory | null | undefined): PlotPoint[] {
  return (history?.daily ?? [])
    .filter((d): d is (typeof d) & { costPerOutcomeUsd: number } => d.costPerOutcomeUsd != null)
    .map((d) => ({
      date: d.date,
      label: formatDate(d.date),
      value: d.costPerOutcomeUsd,
    }));
}

function CostTooltip({
  active,
  payload,
  outcomeLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: PlotPoint }>;
  outcomeLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  // A point with no date is a PROJECTED step, not a day — it has no reading to give, and
  // this is the same guard that keeps the dotted tail out of a card built to name a day.
  if (point.date == null || point.value == null) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-gray-800">{formatDate(point.date)}</p>
      <p className="text-gray-500">
        {outcomeLabel}{" "}
        <span className="font-medium text-gray-800">{formatUsdAdaptive(point.value)}</span>
      </p>
    </div>
  );
}

export function CostPerOutcomeCard({
  history,
  outcomeLabel,
  floor,
  learning = false,
  paused = false,
  pending = false,
}: {
  /**
   * The served curve, whole. `undefined` while the producer does not answer it for this
   * scope; `null` when it answered that it cannot build one.
   */
  history?: CostPerOutcomeHistory | null;
  /**
   * What ONE outcome is, in the producer's own words. The CURVE's own step wins when
   * there is a curve (`history.outcomeStep.label`) — that is the step the points were
   * actually computed over, so if it ever disagreed with the scope's verdict the title
   * would name a different thing from the line. This fallback is the verdict's step
   * (`learningPhase.outcomeStep.label`), which is all a learning scope has. Never a word
   * this card picks: a campaign's outcome is whichever step its leg lands on.
   */
  outcomeLabel: string;
  /**
   * Too few outcomes have landed for a price to be stated. The curve is then a SHAPE with
   * no values on either axis rather than a measurement — see the placeholder module.
   */
  learning?: boolean;
  /**
   * The floor the best workflow can put this price on — the recommended workflow's own
   * campaign-grain figure, read verbatim off the ranking ladder. Absent when the producer
   * recommends nothing, or when the floor is not below where the curve already sits.
   */
  floor?: BestWorkflowFloor | null;
  /** The campaign is stopped, so the tag reads `Paused`. The shape is drawn either way:
   *  the reason the price cannot be read is unchanged, only the reason it will stay so. */
  paused?: boolean;
  pending?: boolean;
}) {
  const data = useMemo(() => buildPoints(history), [history]);
  // Built once and shared by every learning campaign on purpose: it is an illustration of
  // a shape, so a per-campaign variation would be a difference a reader could try to read.
  const placeholder = useMemo<PlotPoint[]>(
    () => placeholderCostCurve().map((d) => ({ date: null, label: String(d.x), value: d.value })),
    [],
  );
  /**
   * The dotted continuation, and the join that makes it one line rather than two.
   *
   * Both series are carried on ONE array because recharts takes one: the real days hold
   * `value` and no `tail`, the projected steps hold `tail` and no `value`, and the LAST
   * real day holds both so the solid line hands over to the dotted one with no gap.
   */
  const tail = useMemo(() => {
    const last = history?.daily?.filter((d) => d.costPerOutcomeUsd != null).at(-1);
    if (!last || floor == null) return [];
    return asymptoteTail({
      cumulativeSpendUsd: last.cumulativeSpendUsd,
      cumulativeOutcomes: last.cumulativeOutcomes,
      floorUsd: floor.costPerOutcomeUsd,
      // Sized against the history so the real curve keeps most of the width — the tail is
      // a hint about where this goes, not the subject of the picture.
      points: asymptoteTailPoints(data.length),
    });
  }, [history, floor]);

  const plotted = useMemo<PlotPoint[]>(() => {
    if (tail.length === 0 || data.length === 0) return data;
    const joined = data.map((d, i) =>
      i === data.length - 1 ? { ...d, tail: d.value } : { ...d, tail: null },
    );
    return [
      ...joined,
      // No date and no label: these steps are not days. The axis prints nothing for them,
      // so nobody can read a WHEN off a curve that only states a WHERE.
      // A figure space per step: unique, so recharts keeps them as distinct categories
      // rather than collapsing them into one, and blank, so no tick can print a WHEN for
      // a point that is not a day. The axis is pinned to the real labels below anyway;
      // this is the second belt.
      ...tail.map((t) => ({
        date: null,
        label: "\u2007".repeat(t.step),
        value: null,
        tail: t.value,
      })),
    ];
  }, [data, tail]);

  const undated = history?.undatedOutcomes ?? 0;
  const latest = data.length > 0 ? data[data.length - 1] : null;
  const step = history?.outcomeStep?.label ?? outcomeLabel;
  const title = `Cost per ${step.toLowerCase()}`;

  // What the plot area shows, decided once so the headline and the chart cannot disagree
  // about which of the three states this card is in.
  const mode: "placeholder" | "curve" | "unavailable" = learning
    ? "placeholder"
    : data.length > 0
      ? "curve"
      : "unavailable";

  return (
    // `lg:col-span-2`: this card took the WIDE slot of the 3-column top band when it
    // and the Outcome line were swapped. Without it the band leaves an empty third
    // column — the chart is the subject there and the cost summary is the narrow one.
    // Same class `RoiTrendCard` carries for the same slot on the brand and offer.
    <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-gray-800">{title}</h3>
          <p className="mt-0.5 text-[11px] text-gray-400">Since your first dollar spent</p>
        </div>
        <div className="shrink-0 text-right">
          {pending ? (
            <Skeleton className="h-8 w-20" />
          ) : mode === "placeholder" ? (
            // The tag takes the VALUE's place rather than sitting beside one: there is no
            // price to print, and the curve underneath states nothing either.
            <LearningTag paused={paused} />
          ) : (
            <p className="text-2xl font-bold leading-none text-gray-900">
              {latest?.value != null ? formatUsdAdaptive(latest.value) : "—"}
            </p>
          )}
          <p className="mt-1 text-[11px] text-gray-400">today</p>
        </div>
      </div>

      {pending ? (
        <Skeleton className="w-full flex-1 min-h-[180px] rounded" />
      ) : mode === "unavailable" ? (
        // A priced campaign whose curve we do not hold yet. It says so rather than
        // borrowing the placeholder: that shape means "still learning", and stating it
        // on a campaign that is already priced would be a different claim entirely.
        <div className="flex flex-1 min-h-[180px] items-center justify-center px-6 text-center text-sm text-gray-500">
          We cannot chart this yet. Your price today is on the row above.
        </div>
      ) : (
        // STRETCHES rather than a fixed height: this card sits in the top band, beside
        // the cost summary, in an `items-stretch` grid — a fixed plot there leaves a gap
        // under the curve whenever the summary is taller. It carried a fixed height
        // while it sat next to the activity bars, whose own plot is fixed. The floor is
        // this wrapper's `min-h-[180px]`, the same one the two sibling trend cards in
        // this band use.
        <div className="flex-1 min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <AreaChart
              data={mode === "placeholder" ? placeholder : plotted}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="cost-per-outcome-fill" x1="0" y1="0" x2="0" y2="1">
                  {/* `currentColor` off a `text-brand-*` class rather than a hex: an SVG
                      attribute is not reached by the `html.dark` remap, and a literal
                      charter colour is the one control that stays blue on a tinted
                      dashboard. */}
                  <stop
                    offset="0%"
                    stopColor="currentColor"
                    stopOpacity={0.18}
                    className="text-brand-600"
                  />
                  <stop
                    offset="100%"
                    stopColor="currentColor"
                    stopOpacity={0}
                    className="text-brand-600"
                  />
                </linearGradient>
              </defs>
              {/* The placeholder's axes print NOTHING — no tick, no label, no line on the
                  value side. A single tick would be a value, and the whole point is that
                  this card is currently claiming none. */}
              {/* The placeholder draws NO baseline either. An axis line is the one piece
                  of chrome that reads as a measurement — it is where a value would sit —
                  and a hardcoded hex there paints a bright bar on the dark surface, since
                  an SVG stroke attribute is not reached by the `html.dark` remap. The
                  measured chart keeps its line and takes it from `currentColor` for the
                  same reason. */}
              {/* The ticks are PINNED to the real days when a tail is drawn. Left to
                  itself recharts spends slots on the projected steps — which have no day
                  to print — and the dates the reader came for vanish. */}
              <XAxis
                dataKey="label"
                tick={mode === "placeholder" ? false : { fontSize: 11, fill: "#94a3b8" }}
                ticks={tail.length > 0 ? data.map((d) => d.label) : undefined}
                minTickGap={28}
                tickLine={false}
                className="text-gray-200"
                axisLine={mode === "placeholder" ? false : { stroke: "currentColor" }}
              />
              <YAxis
                dataKey="value"
                tick={mode === "placeholder" ? false : { fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(value: number) => formatUsdAdaptive(value)}
                tickCount={mode === "placeholder" ? undefined : 5}
                interval={0}
                tickLine={false}
                axisLine={false}
                width={mode === "placeholder" ? 8 : 52}
              />
              {/* No hover card on the placeholder. A tooltip is how a reader takes a
                  reading, so offering one on a shape that states nothing hands back a
                  number we do not have — the same reason it carries no dots. */}
              {mode === "curve" && (
                <Tooltip
                  content={<CostTooltip outcomeLabel={title} />}
                  cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                />
              )}
              {/* The floor itself, dashed, named. Same grammar the return chart uses for
                  break even: the one horizontal worth drawing is the one that MEANS
                  something, and it is coloured from `currentColor` off a class because an
                  SVG stroke attribute is reached by no `html.dark` remap and a hardcoded
                  hex is wrong on one of the two themes by construction. */}
              {mode === "curve" && floor != null && tail.length > 0 && (
                <ReferenceLine
                  y={floor.costPerOutcomeUsd}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-gray-400"
                  // The PRICE only, above the line. The workflow's name goes in the line
                  // under the chart: inside the plot it runs into the tail that has
                  // flattened onto the very line it labels, and on a phone the two were
                  // printed on top of each other.
                  label={{
                    value: formatUsdAdaptive(floor.costPerOutcomeUsd),
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "#94a3b8",
                  }}
                />
              )}
              {/* The continuation. Dotted and unmarked for the reason the placeholder is:
                  it states a DESTINATION, not a set of readings, so it carries no dot and
                  no hovered point — the tooltip above already declines to answer for it
                  (`point.date == null`), which is the same guard that keeps a projected
                  step out of a card built to name a day. */}
              {mode === "curve" && tail.length > 0 && (
                <Area
                  type="monotone"
                  dataKey="tail"
                  stroke="currentColor"
                  className="text-brand-400"
                  strokeWidth={1.5}
                  strokeDasharray="2 4"
                  fill="none"
                  dot={false}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke="currentColor"
                className={mode === "placeholder" ? "text-gray-400" : "text-brand-600"}
                strokeWidth={mode === "placeholder" ? 1.5 : 2}
                strokeDasharray={mode === "placeholder" ? "2 4" : undefined}
                fill={mode === "placeholder" ? "none" : "url(#cost-per-outcome-fill)"}
                dot={false}
                activeDot={mode === "placeholder" ? false : { r: 4 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* An outcome whose signal carries no timestamp sits on no day, so it counts in the
          price on the stat row and cannot be in this line. Where there is any, the two
          legitimately differ — say so rather than let a reader find it. This is also the
          exact reason the curve had to be served: a browser summing the dated days would
          have under-counted the denominator by precisely this much. */}
      {mode === "curve" && undated > 0 && (
        <p className="mt-3 text-[11px] text-gray-400">
          {formatOutcomeCount(undated)} {undated === 1 ? "outcome has" : "outcomes have"} no
          date yet, so {undated === 1 ? "it counts" : "they count"} in your price above but
          not in this line.
        </p>
      )}

      {/* What the dotted line IS, stated in the producer's own words for the workflow.
          Outside the plot because the name needs room the chart does not have. */}
      {mode === "curve" && floor != null && tail.length > 0 && (
        <p className="mt-3 text-[11px] text-gray-400">
          Dotted: where this lands at {formatUsdAdaptive(floor.costPerOutcomeUsd)}
          {floor.workflowName ? `, what ${floor.workflowName} costs` : ""} — your best
          workflow.
        </p>
      )}

      {/* A count walked forward through the funnel's rates is a PROJECTION, and this app
          does not let a projected figure and a measured one share a label unremarked. An
          entry leg is a raw observation and says nothing. */}
      {mode === "curve" && history != null && !history.outcomeObserved && (
        <p className="mt-2 text-[11px] text-gray-400">
          Estimated from the step we can observe, at your own conversion rates.
        </p>
      )}
    </div>
  );
}
