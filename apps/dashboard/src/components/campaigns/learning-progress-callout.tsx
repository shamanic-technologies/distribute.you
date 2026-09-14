"use client";

import { useState } from "react";

import type { LearningPhase } from "@/lib/revenue-view";
import { CampaignControlsModal } from "@/components/campaigns/campaign-controls-modal";

/**
 * A thin band saying how long is left before a scope's numbers can be priced.
 *
 * EVERY FIGURE HERE IS SERVED. The band divides nothing, picks no minimum and joins no
 * second read: features-service states the verdict, the days, the progress and what
 * raising the ceiling would buy, on the same payload the figures beside it ride
 * (`learningPhase`, v0.165.0). That is not a style preference — the browser used to
 * assemble this itself out of three services, and it picked its expected price by taking
 * the CHEAPEST figure across every workflow, which selects by construction the workflow
 * that spent the least and produced NOTHING. Ten of that floor is a spend target roughly
 * five times too small, so the countdown reached zero long before the outcomes did and
 * the band read `Learning: 0 days left` above a tag still saying to wait.
 *
 * Five verdicts, and the middle three are exactly what the browser could not express:
 *
 *  - `priced` / `unmeasured` — nothing to say, so nothing renders.
 *  - `learning` — still gathering with spend left. The countdown, and the one lever.
 *  - `learning_limited` — the spend target is REACHED and the outcomes have not arrived.
 *    There is no honest number of days here, so the band states the wait instead.
 *  - `paused` — nothing is running, so nothing is gathering. Days-left would be priced
 *    against a daily spend that is not happening.
 *
 * Deliberately ONE number and ONE offer. It carried a line explaining the reservoir
 * behind it — this much to spend, this much a day, plus two weeks of replies — and that
 * line was three clauses long on a band whose whole job is to be read at a glance.
 *
 * The lever names BOTH figures and states what it buys in the unit the band is in
 * (days saved), not the unit it would leave behind: "about 42 days" makes a reader
 * subtract, and a reader who has to subtract does not press the button. Which ceilings
 * to offer is the producer's answer too (`ceilingScenarios`), so the band no longer
 * assumes doubling is the only rung worth naming.
 *
 * The charter's TERTIARY, like the `Learning` tag it belongs to — one accent across a
 * campaign's surfaces, and the band and the tag can never read as two different states
 * of one thing. It carries `tone-tile`, so on a customer's dashboard it wears THEIR
 * tertiary; the fill, the text, the border and BOTH halves of the bar each have their
 * own rotation rule, or the band renders several hues at once. Every class is in the
 * `html.dark` remapped set (`bg-orange-50` / `text-orange-600` / `text-orange-700` /
 * `border-orange-200` / `bg-orange-200`), so it does not paint a light block on the
 * dark surface, and the border runs the full perimeter at 1px per the no-side-accent
 * rule.
 */
export function LearningProgressCallout({
  phase,
  brandId,
  offerId,
}: {
  phase: LearningPhase;
  brandId: string;
  /** Scope the budget modal to one offer. Omitted at brand grain. */
  offerId?: string;
}) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [prefillUsd, setPrefillUsd] = useState<number | undefined>(undefined);

  const line = learningLine(phase);
  // `priced` and `unmeasured` say nothing here: the first has its figures, and the
  // second is the producer stating it cannot answer — a date nobody can stand behind
  // is worse than no date, and the surfaces underneath already say the figures are
  // being withheld.
  if (!line) return null;

  // Raising the ceiling only buys time while there is spend left to get through, so the
  // lever rides `daysRemaining` rather than the status: on `learning_limited` the money
  // is already in and the wait is the provider's, not ours.
  const scenarios =
    phase.daysRemaining != null
      ? phase.ceilingScenarios.filter((s) => s.daysRemaining < phase.daysRemaining!)
      : [];
  const best = scenarios.length > 0 ? scenarios[scenarios.length - 1] : null;
  const saved = best != null ? phase.daysRemaining! - best.daysRemaining : null;

  return (
    <>
      <div className="tone-tile mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="text-sm font-semibold text-orange-700">{line}</div>
          {best != null && saved != null && saved > 0 && (
            <button
              type="button"
              onClick={() => {
                setPrefillUsd(best.dailyCeilingUsd);
                setBudgetOpen(true);
              }}
              className="text-xs font-medium text-orange-700 underline underline-offset-2 hover:no-underline"
            >
              Invest {fmtWholeUsd(best.dailyCeilingUsd)}/day instead of{" "}
              {fmtWholeUsd(phase.dailyCeilingUsd ?? 0)}/day → save {saved}{" "}
              {saved === 1 ? "day" : "days"} of learning
            </button>
          )}
        </div>

        {/* The bar. `aria-hidden` because the sentence above it already states the
            position, so a screen reader would otherwise hear the same thing twice.
            `progressPct` is SERVED — outcomes over the bar they are measured against,
            which is what the countdown is counting down to. */}
        {phase.progressPct != null && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-orange-200" aria-hidden>
            <div
              className="h-full rounded-full bg-orange-600 transition-[width] duration-500"
              style={{ width: `${phase.progressPct}%` }}
            />
          </div>
        )}
      </div>

      {budgetOpen && (
        <CampaignControlsModal
          brandId={brandId}
          offerId={offerId}
          campaignId={phase.campaignId ?? undefined}
          // The band offered a figure, so the form opens on it. Asking again for the
          // amount the button just named is the question asked twice.
          prefillBudgetUsd={prefillUsd}
          onClose={() => setBudgetOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The one sentence the band states, or null when it states nothing.
 *
 * Kept beside the component rather than in a lib because it is COPY, and the three
 * verdicts that speak read differently on purpose: a countdown, a wait, and a stop.
 * An unknown status renders nothing — the producer is free to name a sixth verdict, and
 * inventing a sentence for one we have never seen is worse than staying quiet.
 */
function learningLine(phase: LearningPhase): string | null {
  switch (phase.status) {
    case "learning": {
      if (phase.daysRemaining == null) return null;
      const days = phase.daysRemaining;
      return `Learning: ${days} ${days === 1 ? "day" : "days"} left`;
    }
    case "learning_limited":
      // The money is in and the outcomes are still landing. There is no number of days
      // to state, so the band states the reason instead — which is the whole thing the
      // browser could not express, and why it printed a countdown that had expired.
      return `Learning: the budget is spent, waiting on results for up to ${phase.outcomeLagDays} days`;
    case "paused":
      return "Learning is paused: nothing is running, so no new results are landing";
    default:
      return null;
  }
}

/**
 * Whole dollars, always.
 *
 * Every figure here is a daily ceiling, and cents on one are noise a reader has to skip
 * past — the same reading the daily-budget rule already applies across the dashboard.
 * This band states no amount anyone was charged, so it is outside the billing carve-out
 * that keeps exact amounts exact.
 */
function fmtWholeUsd(usd: number): string {
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}
