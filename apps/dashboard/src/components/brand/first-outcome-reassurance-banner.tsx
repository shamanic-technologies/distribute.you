"use client";

import { ClockIcon } from "@heroicons/react/20/solid";
import type { BrandOptimizationGoal } from "@/lib/api";
import { outcomeNoun, outcomeNounPlural } from "@/lib/strategy-model";
import { LEARNING_WINDOW_OUTCOMES } from "@/lib/first-outcome-reassurance";

interface FirstOutcomeReassuranceBannerProps {
  /** Headline subject — the brand Overview says "Your campaign", the campaign page "This campaign". */
  subject: string;
  /**
   * The goal whose outcome the customer is waiting for, when the surface HAS one.
   *
   * A campaign sells exactly one funnel, so it can name what it is buying and price a
   * learning window in it. A brand runs several at once and has no goal at all, so it
   * passes none and the copy speaks in results and in time — the two things that are
   * true whatever chain converts first.
   */
  goal?: BrandOptimizationGoal | null;
}

/**
 * The learning-window notice shown at the top of an Overview before the brand's first
 * outcome lands. ONE component for the brand Overview and the campaign Overview — the
 * two shipped as byte-parallel copies, which is exactly how a goal-aware sentence ends
 * up correct on one page and stale on the other.
 *
 * With a goal, the copy names that outcome (`outcomeNounPlural`) rather than a fixed
 * funnel step: telling a positive-replies campaign to wait for its first site visits
 * describes something it does not buy. Without one — the brand Overview, where a brand
 * runs several funnels and has no goal — it says "results", and the gate counts outcomes
 * of every kind (`brandOutcomeCount`), so the sentence and the disappearance agree
 * either way.
 *
 * The learning window is stated as a MULTIPLE of the brand's expected cost per outcome,
 * not as a dollar total. A figure like "$2,579" reads as a bill on a screen that has not
 * yet produced a single outcome; the multiple says the same thing, holds whatever the
 * brand's unit cost turns out to be, and needs no unit cost to be resolvable — so the
 * line can no longer vanish on the one brand whose cost we failed to estimate.
 */
export function FirstOutcomeReassuranceBanner({
  subject,
  goal,
}: FirstOutcomeReassuranceBannerProps) {
  // Named outcome when the surface sells one chain; "results" when it sells several.
  // Not a default goal: picking one would name a chain the brand may never have
  // declared, which is the retired-goal bug this whole line of work removed.
  const outcomes = goal ? outcomeNounPlural(goal) : "results";
  const outcome = goal ? outcomeNoun(goal) : null;
  // Neutral surface, brand-accent icon. Two reasons the cyan it replaced was
  // wrong: a reassurance callout carries no STATUS, so a hue on the whole panel
  // competes with the colours that do mean something; and `cyan` is outside the
  // closed set the `html.dark` remap covers, so this panel rendered its light
  // near-white on the dark surface. Gray is remapped, and the icon reads
  // `brand-*`, so the one coloured thing here follows the brand's own tint
  // instead of sitting on a fixed blue.
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-brand-200">
          <ClockIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{subject} is running.</p>
          <p className="mt-0.5 leading-6">
            We are sending and learning from the first leads. It typically takes 2 to 4
            weeks before the first {outcomes} appear here.
          </p>
          <p className="mt-1 leading-6">
            {outcome
              ? `Plan on about ${LEARNING_WINDOW_OUTCOMES}x the expected cost per ${outcome} before you judge the results.`
              : "Give it the full window before you judge the return."}
          </p>
        </div>
      </div>
    </div>
  );
}
