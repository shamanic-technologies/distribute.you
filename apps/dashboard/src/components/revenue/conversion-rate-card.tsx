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
import { InfoTooltip } from "@/components/visibility/metric-info";
import type { ConversionRateHistory } from "@/lib/revenue-view";

/**
 * HOW OFTEN THIS CAMPAIGN CONVERTS, OVER ITS LIFE (features-service#992).
 *
 * The third answer in the band: the two cards beside it say WHO we wrote to and WHAT
 * wrote it, and this one says whether the writing is landing better than it was.
 *
 * ── EVERY FIGURE IS SERVED; THE BROWSER DIVIDES NOTHING ─────────────────────────────
 *
 * The rate could not be built here even in principle. A lead whose reach or whose
 * conversion carries no timestamp counts in the scope's totals while sitting on NO day,
 * so a browser-side cumulative rate divides two differently-sized populations and its
 * last point stops agreeing with the headline printed inches above it. The producer
 * serves the curve AND the scope's own rate for exactly that reason, and this file plots
 * the first and prints the second.
 *
 * ── A NULL POINT AND A ZERO POINT ARE DIFFERENT STATEMENTS ──────────────────────────
 *
 * `conversionRatePct: null` means NO DENOMINATOR — nobody had been reached yet, so there
 * is no rate. `0` is MEASURED: people were reached and none of them converted, which is
 * a real reading and is drawn. ⚠️ That polarity is the OPPOSITE of the cost curve beside
 * it, which nulls at zero OUTCOMES because a cost per nothing cannot be divided at all.
 * Both are the producer's own rule; they only look inconsistent side by side.
 *
 * ── THE WORDS ARE THE PRODUCER'S ────────────────────────────────────────────────────
 *
 * The title names the step through `outcomeStep.label`, never a noun picked here: a
 * campaign's outcome is whichever step its leg lands on. `outcomeObserved: false` means
 * the counts were walked forward through the brand's leg rates from the signal we can
 * observe, so the whole curve is a PROJECTION and the card says so — a projected figure
 * and a measured one never share a label unremarked.
 */

interface PlotPoint {
  date: string;
  label: string;
  value: number;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One decimal under 10%, none above.
 *
 * `0.1%` and `0.9%` are different answers about a campaign and both round to `0%`, which
 * is the same reason `formatSharePct` keeps a decimal down there. Above ten the decimal
 * is false precision on a figure that moves with every outcome.
 */
export function formatConversionPct(pct: number): string {
  const decimals = Math.abs(pct) < 10 ? 1 : 0;
  return `${pct.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/**
 * The days that carry a reading. A `null` point has no denominator — there is nothing to
 * plot and nothing to interpolate across, so it is DROPPED rather than charted at zero,
 * which would state that nobody converted on a day nobody was reached.
 */
function buildPoints(history: ConversionRateHistory | null | undefined): PlotPoint[] {
  if (!history) return [];
  return history.daily
    .filter((d) => d.conversionRatePct != null)
    .map((d) => ({
      date: d.date,
      label: formatDate(d.date),
      value: d.conversionRatePct as number,
    }));
}

function ConversionTooltip({
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
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium text-gray-800">{formatDate(point.date)}</p>
      <p className="text-gray-500">
        {outcomeLabel}{" "}
        <span className="font-medium text-gray-800">{formatConversionPct(point.value)}</span>
      </p>
    </div>
  );
}

export function ConversionRateCard({
  history,
  pending = false,
}: {
  /** Served whole. `undefined` while the read is in flight; `null` when the producer
   *  answered that it cannot build one for this scope. */
  history?: ConversionRateHistory | null;
  pending?: boolean;
}) {
  const data = useMemo(() => buildPoints(history), [history]);

  const step = history?.outcomeStep?.label ?? null;
  const title = step ? `Conversion to ${step.toLowerCase()}` : "Conversion rate";
  const headline = history?.scopeConversionRatePct ?? null;
  // The curve covers the DATED population alone, so it equals the headline exactly when
  // nothing is undated and legitimately differs otherwise. Stated, never reconciled away.
  const undated = (history?.undatedContacted ?? 0) + (history?.undatedOutcomes ?? 0);
  const projected = history != null && history.outcomeObserved === false;

  const tip = [
    "How often the people this campaign reached went on to convert, since its first day. Cumulative, so each point is the whole run to that date rather than that day alone.",
    projected
      ? "The outcome count is walked forward through your own conversion rates from the signal we can observe, so this curve is a projection rather than a raw count."
      : null,
    undated > 0
      ? "The line covers the people and outcomes carrying a date. The headline covers the whole campaign, so the two differ by whatever has no date on it."
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-gray-800">{title}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
            <span className="truncate">
              {projected ? "Projected, since launch" : "Since launch"}
            </span>
            <InfoTooltip tip={tip} placement="bottom" />
          </p>
        </div>
        <div className="shrink-0 text-right">
          {pending ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="text-2xl font-bold leading-none text-gray-900">
              {headline != null ? formatConversionPct(headline) : "—"}
            </p>
          )}
        </div>
      </div>

      {pending ? (
        <Skeleton className="w-full flex-1 min-h-[180px] rounded" />
      ) : data.length === 0 ? (
        // Two absences, two sentences — and NEITHER is "it converts nothing", which is a
        // measured zero and lives on a point.
        //
        // No block at all means the producer said it cannot build a curve for this scope;
        // WHY is already named by the learning band at the top of the page, so this card
        // does not re-word its reason and risk a second vocabulary for one verdict.
        // A block whose every point is null means the denominator is still empty: nobody
        // has been reached, so there is no rate to state yet.
        <div className="flex flex-1 min-h-[180px] items-center justify-center px-6 text-center text-sm text-gray-500">
          {history == null
            ? "We cannot chart this yet."
            : "We cannot chart this yet — nobody has been reached."}
        </div>
      ) : (
        <div className="flex-1 min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                {/* `currentColor` off a `text-brand-*` class rather than a hex: an SVG
                    attribute is not reached by the `html.dark` remap, and a literal
                    charter colour is the one control that stays blue on a tinted
                    dashboard. */}
                <linearGradient id="conversion-rate-fill" x1="0" y1="0" x2="0" y2="1">
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
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                minTickGap={28}
                tickLine={false}
                className="text-gray-200"
                axisLine={{ stroke: "currentColor" }}
              />
              <YAxis
                dataKey="value"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickFormatter={(value: number) => formatConversionPct(value)}
                tickCount={5}
                interval={0}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                content={<ConversionTooltip outcomeLabel={title} />}
                cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
              />
              <Area
                type="linear"
                dataKey="value"
                className="text-brand-600"
                stroke="currentColor"
                strokeWidth={2}
                fill="url(#conversion-rate-fill)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 3, className: "text-brand-600", fill: "currentColor" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
