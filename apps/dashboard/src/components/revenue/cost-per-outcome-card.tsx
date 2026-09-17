"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/skeleton";
import { LearningTag } from "@/components/learning-tag";
import { formatUsdAdaptive } from "@/lib/format-number";
import { placeholderCostCurve } from "@/lib/cost-per-outcome-placeholder";
import type { CostPerOutcomePoint } from "@/lib/revenue-view";

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
  value: number;
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
function buildPoints(history: CostPerOutcomePoint[] | null | undefined): PlotPoint[] {
  return (history ?? [])
    .filter((d): d is CostPerOutcomePoint & { costPerOutcomeUsd: number } =>
      d.costPerOutcomeUsd != null,
    )
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
  if (point.date == null) return null;
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
  learning = false,
  paused = false,
  pending = false,
}: {
  /**
   * The served per-day curve. `undefined` while features-service does not yet answer it
   * for this scope; `null` when it answered that it cannot measure one.
   */
  history?: CostPerOutcomePoint[] | null;
  /**
   * What ONE outcome is, in the producer's own words (`learningPhase.outcomeStep.label`
   * — "Website visit", "Sales interest"). Never a word this card picks: the campaign's
   * outcome is whichever step its leg lands on, and that is features-service's answer.
   */
  outcomeLabel: string;
  /**
   * Too few outcomes have landed for a price to be stated. The curve is then a SHAPE with
   * no values on either axis rather than a measurement — see the placeholder module.
   */
  learning?: boolean;
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
  const latest = data.length > 0 ? data[data.length - 1] : null;
  const title = `Cost per ${outcomeLabel.toLowerCase()}`;

  // What the plot area shows, decided once so the headline and the chart cannot disagree
  // about which of the three states this card is in.
  const mode: "placeholder" | "curve" | "unavailable" = learning
    ? "placeholder"
    : data.length > 0
      ? "curve"
      : "unavailable";

  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-200 p-4 md:p-6">
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
              {latest ? formatUsdAdaptive(latest.value) : "—"}
            </p>
          )}
          <p className="mt-1 text-[11px] text-gray-400">today</p>
        </div>
      </div>

      {pending ? (
        <Skeleton className="h-[300px] w-full rounded lg:h-[200px]" />
      ) : mode === "unavailable" ? (
        // A priced campaign whose curve we do not hold yet. It says so rather than
        // borrowing the placeholder: that shape means "still learning", and stating it
        // on a campaign that is already priced would be a different claim entirely.
        <div className="flex h-[300px] items-center justify-center px-6 text-center text-sm text-gray-500 lg:h-[200px]">
          We cannot chart this yet. Your price today is on the row above.
        </div>
      ) : (
        <div className="h-[300px] lg:h-[200px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <AreaChart
              data={mode === "placeholder" ? placeholder : data}
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
              <XAxis
                dataKey="label"
                tick={mode === "placeholder" ? false : { fontSize: 11, fill: "#94a3b8" }}
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
    </div>
  );
}
