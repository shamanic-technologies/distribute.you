"use client";

import { type ReactNode } from "react";
import type { Spend } from "@/lib/revenue-view";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";

// Committed-spend (= actual + provisioned) explainers. The figure can DIP when a
// reserved follow-up sends (becomes a billed charge) or is cancelled (contact
// replied / couldn't be reached) — the tooltip tells the user why it moves.
const TOTAL_SPENT_TIP =
  "What you've committed so far: money already billed plus credits reserved for follow-up emails we've scheduled. It can dip when a reserved follow-up sends or gets cancelled because a contact replied or couldn't be reached.";
const TODAY_SPENT_TIP =
  "Committed today: billed plus credits reserved for follow-ups scheduled today. It can dip when a reserved follow-up sends or gets cancelled because a contact replied or couldn't be reached.";

/**
 * The spend column beside the Overview chart: what today's budget has spent, and
 * what the whole thing has cost. Both are read VERBATIM from the
 * features-service `/revenue` `spend` block — the dashboard does not sum the
 * runs breakdown in the browser (that diverged from the displayed Total spent).
 *
 * It used to carry a third figure, a top-3 of the PROVIDERS the money went to.
 * That is gone, with nothing in its place: a customer buys an outcome, and which
 * vendors sit behind it is our supply chain rather than their result. It was
 * also the one thing on the page that said nothing about whether their money
 * was working. `spend.sources` is still on the wire and simply not read.
 */

function formatUsd(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd < 0.01) return "<$0.01";
  const fractionDigits = usd < 10 ? 2 : 0;
  return `$${usd.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

// Daily budget always renders as whole dollars (no cents), regardless of magnitude.
function formatBudgetCents(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function RevenueCostSummary({
  spend = null,
  dailyBudgetCents = null,
  budgetNote,
  pending = false,
  costPending,
  todayCostPending,
  bottomCard,
}: {
  /** features-service `/revenue` spend block — the single source for Total spent,
   *  Budget spent today, and the top-3 cost sources (+ share %). Null on a cold /
   *  pre-rollout payload → the figures render $0 / no sources. */
  spend?: Spend | null;
  dailyBudgetCents?: number | null;
  /**
   * Why there is no ceiling beside today's spend, when a caller knows the reason.
   * Appended to the tip rather than shown as a warning: an absent denominator is
   * not an error, but a reader who expects one is owed the reason instead of being
   * left to wonder whether the figure failed to load.
   */
  budgetNote?: string;
  pending?: boolean;
  /** Reveal gate for the Total-spent figure when it resolves on a DIFFERENT chain
   *  than the revenue data. The feature Overview now sources spend from `/revenue`
   *  itself, so it passes the revenue reveal here; other consumers omit it →
   *  falls back to `pending` (single reveal). */
  costPending?: boolean;
  /** Reveal gate for today's actual spend window. */
  todayCostPending?: boolean;
  /** Rendered under the spend card. There is no default: a caller that passes
   *  nothing gets nothing. The offer and campaign Overviews pass their Top-3
   *  audiences here; the brand Overview passes nothing, because an audience
   *  belongs to an offer. */
  bottomCard?: ReactNode;
}) {
  // Total-spent reveals on its own source where given; otherwise tracks `pending`.
  const totalSpentPending = costPending ?? pending;
  const budgetSpentPending = todayCostPending ?? totalSpentPending;

  // All spend figures are server-computed (features-service#396) — rendered
  // verbatim, no client reduce / share-% math.
  // Committed (= actual + provisioned). features-service keeps `totalSpentCents` (value
  // flips to committed when it lands) and renames today's field to `totalSpentTodayCents`;
  // read it in preference to the legacy `todaySpentCents` so the dashboard works across
  // the rollout. Server-provided either way — no client actual+provisioned sum.
  const totalCostUsd = (spend?.totalSpentCents ?? 0) / 100;
  const todayCommittedCents = spend?.totalSpentTodayCents ?? spend?.todaySpentCents ?? 0;

  // Right-of-chart column: what today's budget has spent and what the whole
  // thing has cost, then whatever the caller puts beneath.
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {/* Card frames + labels render instantly; only the value waits. */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs text-gray-400">Budget spent today</p>
                <InfoTooltip tip={budgetNote ? `${TODAY_SPENT_TIP} ${budgetNote}` : TODAY_SPENT_TIP} />
              </div>
              {budgetSpentPending ? (
                <Skeleton className="mt-1 h-7 w-28" />
              ) : (
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                  {formatUsd(todayCommittedCents / 100)}
                  {dailyBudgetCents != null && dailyBudgetCents > 0 ? (
                    <span className="text-sm font-medium text-gray-400">/{formatBudgetCents(dailyBudgetCents)}</span>
                  ) : null}
                </p>
              )}
            </div>
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-1">
                <p className="text-xs text-gray-400">Total spent</p>
                <InfoTooltip tip={TOTAL_SPENT_TIP} />
              </div>
              {totalSpentPending ? (
                <Skeleton className="ml-auto mt-1 h-7 w-24" />
              ) : (
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{formatUsd(totalCostUsd)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Whatever the caller puts under the spend card, or nothing.
          There is deliberately NO default. This used to fall back to a Top-3
          cost-source list — which vendor the money went to — and that answers a
          question no customer asked: they buy an outcome, and the provider mix
          behind it is our supply chain, not their result. It is also the one
          figure on the page that says nothing about whether their money is
          working. Removed with nothing in its place. */}
      {bottomCard ?? null}
    </div>
  );
}
