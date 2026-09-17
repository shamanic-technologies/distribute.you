"use client";

import Link from "next/link";
import { daysSinceChanged, formatReward, type RewardTask } from "@/lib/reward-tasks";

/**
 * The one thing to DO on this funnel, and what doing it pays.
 *
 * ## It renders ONLY when there is something to do
 *
 * A task that is not due renders nothing. This is the same shape as the
 * learning band and the campaign hold band above it, and the reason is the one
 * this repo keeps re-learning: a surface that names an outcome must disappear on
 * that outcome. A permanent box that says "nothing to do" 29 days out of 30 is a
 * box a reader stops looking at, and the one day it matters they will not see
 * it either.
 *
 * It is deliberately NOT a third of the Return-on-spend row. That chart is the
 * page's argument; narrowing it permanently to hold a box that is empty most of
 * the time trades the thing people came for against the thing they occasionally
 * need.
 *
 * ## It never claims a precision the ledger does not have
 *
 * client-service states HOW it knows when the numbers last changed. When it
 * compared two readings itself the age is certain and we print it. When the
 * baseline is brand-service's own last-touched timestamp — which also moves
 * when a funnel is merely switched off and on — there is no honest day count,
 * so the band says the refresh is owed and stops there. `daysSinceChanged`
 * holds that rule, with real unit tests.
 *
 * ## Colour
 *
 * The brand ramp, like every other accent on a funnel page (that page states
 * `tone="primary"`). Never a literal hex: `:root[data-brand-tint]` re-declares
 * the ramp at the open brand's hue, so the band is the customer's colour. Every
 * class it wears carries an `html.dark` AND an `html.dark[data-brand-tint]`
 * remap, checked in `globals.css` rather than assumed.
 */
export function RewardTaskBand({
  task,
  settingsHref,
  now = new Date(),
}: {
  task: RewardTask | null;
  settingsHref: string;
  now?: Date;
}) {
  // Nothing owed, nothing measured, or a read still in flight: say nothing. A
  // band that appears and then vanishes is worse than one that arrives late.
  if (!task || !task.due) return null;

  const days = daysSinceChanged(task, now);
  const reward = formatReward(task.rewardCents);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
          <GiftIcon />
          Refresh your numbers, earn {reward}
        </p>
        <p className="mt-1 text-xs text-brand-700">
          {days === null
            ? "Your conversion rates and lifetime revenue are due for a refresh."
            : `Your conversion rates and lifetime revenue last changed ${days} ${
                days === 1 ? "day" : "days"
              } ago.`}{" "}
          Every money figure on this page is worked out from them.
        </p>
      </div>
      <Link
        href={settingsHref}
        className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition hover:bg-brand-700"
      >
        Update them
      </Link>
    </div>
  );
}

/** The same gift the top-bar pill wears, drawn rather than imported: one mark
 *  does not justify a second icon set, and `currentColor` keeps it on the ramp
 *  in both themes and under a tint. */
function GiftIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 12v9H4v-9" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 21V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}
