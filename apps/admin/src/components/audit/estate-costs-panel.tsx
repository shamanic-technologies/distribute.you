"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  COST_GRAINS,
  renewalWindow,
  type CostGrain,
  type EstateDomain,
  type RenewalBucket,
} from "@/lib/estate-signals";
import { formatCents } from "@/lib/instantly-ops";
import { FX_UNAVAILABLE_NOTE, fxRateLine, type FxRateLike } from "@/lib/estate-usd";
import { Skeleton } from "@/components/skeleton";

/**
 * Costs — renewal spend falling due, seven buckets back and seven forward.
 *
 * TWO SERIES, not one, because the two halves are on DIFFERENT BASES and a
 * single bar height would be read on whichever the reader assumed: `Paid` is a
 * per-bucket sum of renewals already taken, `Upcoming` is a RUNNING COMMITMENT
 * from today forward on the weekly and monthly grains (per-bucket on daily,
 * where a cumulative line over a fortnight says nothing). The legend names both
 * bases so no bar is ambiguous, and the tooltip restates it per bucket.
 *
 * DEFAULTS TO MONTHLY, and that is measured rather than a preference. Renewals
 * are yearly events on ~74 live domains, so short windows are structurally
 * empty: on 2026-09-22 production had 0 renewals in the next 7 days, 0 in the
 * next 7 weeks and 28 in the next 7 months. A daily default renders 14 blank
 * bars and reads as a broken chart, so an empty window SAYS SO in words instead
 * of drawing zeros.
 *
 * ONE CURRENCY: US dollars. Gandi invoices in euros and everyone else in
 * dollars; instantly-service serves a USD twin for every figure, converted at
 * the ECB rate it names on the response, so the whole estate is one chart and
 * the rate is stated under it. With no rate on record there is no chart at all
 * (a euro bar drawn as dollars would be a wrong number), and the panel says why.
 *
 * Palette: `#6366f1` (upcoming) and `#0d9488` (paid). Validated with the
 * dataviz skill's own checker against BOTH surfaces — light `#ffffff` and the
 * admin dark surface `#0f172a` — all six checks PASS in each, so one palette
 * serves both modes rather than a flipped guess.
 */

const UPCOMING = "#6366f1";
const PAID = "#0d9488";

/**
 * Axis money in WHOLE currency units. Fifteen buckets leave ~30px of gutter per
 * tick, and `formatCents`' full `€3,838.00` clipped to `,838.00` — a number
 * whose leading digits are cut is worse than a coarser one, and cents on an
 * axis carry nothing. The tooltip still states the exact figure.
 */
function axisMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const GRAIN_LABEL: Record<CostGrain, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function CostTooltip({
  active,
  payload,
  grain,
}: {
  active?: boolean;
  payload?: Array<{ payload: RenewalBucket }>;
  grain: CostGrain;
}) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  if (b.pastCount === 0 && b.futureCount === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-gray-700">
        {b.label}
        {b.isCurrent ? " (now)" : ""}
      </p>
      {b.pastCount > 0 && (
        <p className="mt-1 text-gray-600">
          <span className="font-medium tabular-nums">{formatCents(b.pastCents, "USD")}</span> paid
          in this {grain === "monthly" ? "month" : grain === "weekly" ? "week" : "day"} ·{" "}
          {b.pastCount} domain{b.pastCount === 1 ? "" : "s"}
        </p>
      )}
      {b.futureCount > 0 && (
        <p className="mt-0.5 text-gray-600">
          <span className="font-medium tabular-nums">{formatCents(b.futureCents, "USD")}</span>{" "}
          {grain === "daily" ? "due" : "committed through here"} · {b.futureCount} domain
          {b.futureCount === 1 ? "" : "s"} in this bucket
        </p>
      )}
    </div>
  );
}

export function EstateCostsPanel({
  domains,
  fx,
  isPending,
}: {
  domains: EstateDomain[];
  /** The served EUR -> USD rate. Null = no rate on record, so nothing is charted. */
  fx: FxRateLike | null;
  isPending: boolean;
}) {
  const [grain, setGrain] = useState<CostGrain>("monthly");

  // `now` is read once per render batch off the data identity, so a poll does
  // not slide the buckets under a reader mid-hover.
  const now = useMemo(() => Date.now(), [domains]);

  const window = useMemo(
    () => (domains.length > 0 ? renewalWindow(domains, grain, now) : null),
    [domains, grain, now],
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Costs</h2>
          <p className="mt-1 text-xs text-gray-500">
            Renewal payments falling due, seven buckets either side of today.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {COST_GRAINS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrain(g)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                g === grain
                  ? "bg-indigo-600 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {GRAIN_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        {isPending ? (
          <Skeleton className="h-48 w-full rounded" />
        ) : !fx ? (
          // No rate: a euro renewal cannot be drawn as dollars, and drawing only
          // the dollar half would present part of the estate as all of it.
          <p className="py-10 text-center text-sm text-amber-600">{FX_UNAVAILABLE_NOTE}</p>
        ) : !window ? (
          <p className="py-10 text-center text-sm text-gray-400">
            No live domain carries a renewal on record.
          </p>
        ) : window.empty ? (
          // Zero bars would read as a broken chart. Say WHY the window is empty.
          <p className="py-10 text-center text-sm text-gray-500">
            Renewals are yearly events, so nothing falls in this {GRAIN_LABEL[grain].toLowerCase()}{" "}
            window.{" "}
            {grain !== "monthly" && (
              <button
                type="button"
                onClick={() => setGrain("monthly")}
                className="font-medium text-indigo-600 hover:underline"
              >
                Try monthly
              </button>
            )}
          </p>
        ) : (
          <>
            {/* Two series, so a legend is always present — identity is never
                colour alone, and each entry names its own basis. */}
            <div className="flex flex-wrap items-center gap-3 pb-2 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: PAID }} />
                Paid, per {grain === "monthly" ? "month" : grain === "weekly" ? "week" : "day"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: UPCOMING }} />
                Upcoming
                {grain === "daily" ? ", per day" : ", cumulative from today"}
              </span>
              <span className="ml-auto tabular-nums">USD</span>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={window.buckets} margin={{ top: 14, right: 8, bottom: 22, left: -8 }}>
                {/* No CartesianGrid: the repo's other charts dropped it for the
                    same reason, and a recessive axis carries the scale here. */}
                {/* Angled so all fifteen buckets keep their own label: the
                    panel is a third of a row, and horizontal ticks overlapped
                    into an unreadable smear at every grain. */}
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e5e7eb" }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={40}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v: number) => axisMoney(v)}
                />
                <Tooltip
                  cursor={{ fill: "rgba(99,102,241,0.06)" }}
                  content={<CostTooltip grain={grain} />}
                />
                {/* Today, so past and future read from position as well as hue. */}
                <ReferenceLine
                  x={window.buckets.find((b) => b.isCurrent)?.label}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  label={{ value: "now", position: "top", fontSize: 10, fill: "#94a3b8" }}
                />
                <Bar dataKey="pastCents" fill={PAID} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="futureCents" fill={UPCOMING} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {!isPending && fx && window && !window.empty && (window.unpricedInWindow > 0 || window.undated > 0) && (
        // The bars UNDERSTATE by exactly this much. Stated rather than summed
        // as zero and presented as the total.
        <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-amber-600">
          {window.unpricedInWindow > 0 && (
            <>
              {window.unpricedInWindow.toLocaleString("en-US")} domain
              {window.unpricedInWindow === 1 ? "" : "s"} renewing in this window carr
              {window.unpricedInWindow === 1 ? "ies" : "y"} no price on record, so the bars
              understate.
            </>
          )}
          {window.unpricedInWindow > 0 && window.undated > 0 && " "}
          {window.undated > 0 && (
            <>
              {window.undated.toLocaleString("en-US")} more{" "}
              {window.undated === 1 ? "is priced" : "are priced"} with no renewal date, so no bucket
              can hold {window.undated === 1 ? "it" : "them"}.
            </>
          )}
        </p>
      )}

      {!isPending && fx && (
        // The rate is stated where the dollars are, never hardcoded.
        <p className="mt-2 text-[11px] text-gray-400">{fxRateLine(fx)}.</p>
      )}
    </div>
  );
}
