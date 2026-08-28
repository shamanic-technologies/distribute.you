"use client";

import { useState } from "react";

import { LEARNING_MIN_OUTCOMES } from "@/lib/learning-threshold";
import {
  learningProgress,
  learningProgressIfDoubled,
  type LearningProgressInput,
} from "@/lib/learning-progress";
import { CampaignControlsModal } from "@/components/campaigns/campaign-controls-modal";

/**
 * A thin band saying how long is left before a campaign's numbers can be priced.
 *
 * The `Learning` tag already tells a reader that a figure is being withheld; what it
 * cannot tell them is when it stops. So this states one number — days — over a bar that
 * fills, and offers the one lever that moves it. Everything else a reader might want
 * (the outcome count, the price itself) is on the surface underneath; a band that
 * summarised the page would be a second place for the page to be read.
 *
 * Deliberately ONE sentence and ONE number. The arithmetic behind it is a reservoir —
 * this much to spend, this much a day — and the copy says exactly that, because a
 * reader who cannot restate the rule cannot act on it.
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
  brandId,
  offerId,
  campaignId,
  outcomeNoun,
  ...input
}: LearningProgressInput & {
  brandId: string;
  /** Scope the budget modal to one offer. Omitted at brand grain. */
  offerId?: string;
  /** Scope it to one campaign. Omitted when the band answers for a whole list. */
  campaignId?: string;
  /** What this campaign buys, singular — "sales interest", "website visit". */
  outcomeNoun: string;
}) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const progress = learningProgress(input);

  // No expected price, or nothing funding it: there is no date to state and inventing
  // one is worse than the silence. The surfaces underneath already say `Learning`.
  if (!progress) return null;

  const doubled = learningProgressIfDoubled(progress);
  const dayWord = progress.daysLeft === 1 ? "day" : "days";

  return (
    <>
      <div className="tone-tile mb-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="text-sm font-semibold text-orange-700">
            Learning: about {progress.daysLeft} {dayWord} left
          </div>
          {doubled != null && (
            <button
              type="button"
              onClick={() => setBudgetOpen(true)}
              className="text-xs font-medium text-orange-700 underline underline-offset-2 hover:no-underline"
            >
              Spend {fmtWholeUsd(progress.dailyBudgetUsd * 2)}/day instead → about {doubled}{" "}
              {doubled === 1 ? "day" : "days"}
            </button>
          )}
        </div>

        {/* The bar. `aria-hidden` because the sentence above it already states the
            number, so a screen reader would otherwise hear the same thing twice. */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-orange-200" aria-hidden>
          <div
            className="h-full rounded-full bg-orange-600 transition-[width] duration-500"
            style={{ width: `${progress.pct}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-orange-600">
          {fmtWholeUsd(progress.spentUsd)} of {fmtWholeUsd(progress.thresholdUsd)} spent, at{" "}
          {fmtWholeUsd(progress.dailyBudgetUsd)}/day. That buys the {LEARNING_MIN_OUTCOMES}{" "}
          {outcomeNoun}s we need to price it.
          {progress.settlingDaysLeft > 0 &&
            ` Replies keep landing for ${progress.settlingDaysLeft} ${
              progress.settlingDaysLeft === 1 ? "day" : "days"
            } after that.`}
        </p>
      </div>

      {budgetOpen && (
        <CampaignControlsModal
          brandId={brandId}
          offerId={offerId}
          campaignId={campaignId}
          onClose={() => setBudgetOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Whole dollars, always.
 *
 * Every figure here is a spend TARGET or a daily ceiling, and cents on either is noise
 * a reader has to skip past — the same reading the daily-budget rule already applies
 * across the dashboard. This band states no amount anyone was charged, so it is outside
 * the billing carve-out that keeps exact amounts exact.
 */
function fmtWholeUsd(usd: number): string {
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}
