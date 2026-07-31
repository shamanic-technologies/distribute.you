"use client";

import { ClockIcon } from "@heroicons/react/20/solid";
import type { BrandOptimizationGoal } from "@/lib/api";
import { outcomeNoun, outcomeNounPlural } from "@/lib/strategy-model";
import { LEARNING_WINDOW_OUTCOMES } from "@/lib/first-outcome-reassurance";

interface FirstOutcomeReassuranceBannerProps {
  /** Headline subject — the brand Overview says "Your campaign", the campaign page "This campaign". */
  subject: string;
  /** The brand's optimization goal; names the outcome the customer is actually waiting for. */
  goal: BrandOptimizationGoal;
}

/**
 * The learning-window notice shown at the top of an Overview before the brand's first
 * outcome lands. ONE component for the brand Overview and the campaign Overview — the
 * two shipped as byte-parallel copies, which is exactly how a goal-aware sentence ends
 * up correct on one page and stale on the other.
 *
 * The copy names the brand's OWN outcome (`outcomeNounPlural`) rather than a fixed funnel
 * step: telling a positive-replies brand to wait for its first site visits describes
 * something it does not buy. The gate that hides this banner reads the same goal's count
 * (`goalOutcomeCount`), so the sentence and the disappearance agree.
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
  const outcomes = outcomeNounPlural(goal);
  const outcome = outcomeNoun(goal);
  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-cyan-700 ring-1 ring-cyan-200">
          <ClockIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{subject} is running.</p>
          <p className="mt-0.5 leading-6">
            We are sending and learning from the first leads. It typically takes 2 to 4
            weeks before the first {outcomes} appear here.
          </p>
          <p className="mt-1 leading-6">
            Plan on about {LEARNING_WINDOW_OUTCOMES}x the expected cost per {outcome}{" "}
            before you judge the results.
          </p>
        </div>
      </div>
    </div>
  );
}
