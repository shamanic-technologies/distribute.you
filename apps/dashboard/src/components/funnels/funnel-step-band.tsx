"use client";

import { InfoTooltip } from "@/components/visibility/metric-info";
import { LearningTag } from "@/components/learning-tag";
import { isLearning, LEARNING_MIN_OUTCOMES } from "@/lib/learning-threshold";
import { formatCentsAsUsdAdaptive } from "@/lib/format-number";
import type { FunnelStepBreakdown } from "@/lib/revenue-view";

/**
 * The funnel, walked one rung at a time.
 *
 * The four figures above this band say what the whole funnel returned. They cannot say
 * WHERE people fall out of it, which is the question a customer opening one funnel
 * actually has — and the answer to it is per rung: how many got here, what getting them
 * here cost, and what share of the rung before converted.
 *
 * Every number is SERVED. features-service builds the rungs from the same deduped leads
 * and the same committed cents as the money above (its #854), so a rung's count agrees
 * with the rows on the same response and a rate between two rungs is a rate rather than
 * two scopes divided into each other. Nothing here divides: a browser computing a
 * user-facing ratio is the compute-a-stat-in-the-browser bug, and it would drift from
 * the producer's own answer the moment either side changed scope.
 *
 * Full width UNDER the return chart rather than in the column beside it: five rungs in a
 * ~280px card is unreadable, and this is what is behind every figure above it.
 *
 * THE GATE. A cost and a rate both DIVIDE by the rung's own count, so under ten they
 * move by tens of dollars and tens of points on the next lead and read as a price we are
 * quoting. Both state `Learning` there, and the bar goes with them — a bar for a rate we
 * are refusing to print is that refusal contradicting itself.
 *
 * The COUNT is never gated. It is measured whatever its size, and it is what shows the
 * bar being approached. `0` reached is a measured answer meaning nobody got here, which
 * is the most useful thing on the band for somebody asking whether this is working; a
 * null count is "we could not measure it", and the two are kept apart.
 */

/**
 * The bar draws the SERVED conversion rate, not the absolute count.
 *
 * Scaling the bars to the biggest rung was the obvious first move and it is useless: a
 * real funnel goes 9,802 contacted to 41 replies, so every rung after the first renders
 * as an identical 14px stub and the shape a person came here to read is gone. Drawing
 * the RATE gives each rung the one comparison that means something — what share of the
 * step above made it here — and it draws a served field rather than computing one, so
 * this component divides nothing at all.
 *
 * No bar when the rate is unmeasured, and none on a rung whose figures are too thin to
 * state: a bar for a rate we are refusing to print is that refusal contradicting itself.
 */
function Bar({ pct }: { pct: number | null }) {
  if (pct == null) return <div className="h-2" />;
  const width = Math.min(100, Math.max(pct > 0 ? 2 : 0, pct));
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${width}%` }} />
    </div>
  );
}

export function FunnelStepBand({
  breakdown,
  pending,
}: {
  breakdown: FunnelStepBreakdown | null | undefined;
  pending: boolean;
}) {
  if (pending) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      </section>
    );
  }

  // Null is a real statement and it has its own reason: there is no ONE funnel to walk.
  // Every surface that renders this band is already scoped to a single funnel, so this
  // is the read failing or a channel with no funnel wired — either way, saying so beats
  // a band of dashes.
  if (!breakdown || breakdown.steps.length === 0) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-1.5">
        <h2 className="font-display text-lg font-bold text-gray-800">Step by step</h2>
        <InfoTooltip tip="Every rung of this funnel: how many people reached it, what reaching it cost, and what share of the step before it converted. A cost or a rate resting on fewer than ten people says Learning instead of a figure." />
      </div>

      <ol className="space-y-3">
        <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <span className="w-full shrink-0 text-sm text-gray-500 sm:w-44">Contacted</span>
          <span className="min-w-0 flex-1">
            {/* The base every rung below converts from, so it is the full width. */}
            <Bar pct={100} />
          </span>
          {/* `sm:contents` dissolves this wrapper at the breakpoint, so the desktop row
              stays the five-column grid it reads as while a phone gets the three
              figures on ONE line under the bar. Stacked, each cell became its own line
              and a bare dash floated on a row of its own, which reads as a fact rather
              than as the absence of one. */}
          <span className="flex items-baseline gap-3 sm:contents">
            <span className="shrink-0 text-sm font-medium text-gray-800 sm:w-20 sm:text-right">
              {breakdown.contactedRecipients.toLocaleString("en-US")}
            </span>
            <span className="hidden text-sm text-gray-400 sm:inline sm:w-44 sm:text-right">
              &mdash;
            </span>
            <span className="hidden text-sm text-gray-400 sm:inline sm:w-24 sm:text-right">
              &mdash;
            </span>
          </span>
        </li>

        {breakdown.steps.map((step) => {
          // ONE gate for both derived figures: they divide by the same count, so showing
          // one beside a tag saying we cannot stand behind the other would let a reader
          // trust a number we just disclaimed.
          const thin = isLearning(step.recipientsReached ?? undefined);
          return (
            <li
              key={step.step}
              data-testid={`funnel-step-${step.leadField}`}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="w-full shrink-0 truncate text-sm text-gray-800 sm:w-44">
                {step.step}
              </span>
              <span className="min-w-0 flex-1">
                <Bar pct={thin ? null : step.conversionFromPreviousPct} />
              </span>
              <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:contents">
                <span className="shrink-0 text-sm font-medium text-gray-800 sm:w-20 sm:text-right">
                  {step.recipientsReached == null
                    ? "—"
                    : step.recipientsReached.toLocaleString("en-US")}
                </span>
                <span className="shrink-0 text-sm sm:w-44 sm:text-right">
                  {thin ? (
                    <LearningTag />
                  ) : step.conversionFromPreviousPct == null ? (
                    <span className="hidden text-gray-400 sm:inline">&mdash;</span>
                  ) : (
                    <span className="text-gray-600">
                      {step.conversionFromPreviousPct.toFixed(1)}%{" "}
                      <span className="text-gray-400">of {step.fromStep.toLowerCase()}</span>
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm sm:w-24 sm:text-right">
                  {thin || step.costPerReachCents == null ? (
                    <span className="hidden text-gray-400 sm:inline">&mdash;</span>
                  ) : (
                    <span className="text-gray-800">
                      {formatCentsAsUsdAdaptive(step.costPerReachCents)}
                    </span>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs text-gray-400">
        A step reached by fewer than {LEARNING_MIN_OUTCOMES} people states no cost and no
        rate: both divide by that count, so they move by a lot on the next person.
      </p>
    </section>
  );
}
