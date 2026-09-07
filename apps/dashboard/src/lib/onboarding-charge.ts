/**
 * What onboarding actually charges at the first checkout.
 *
 * The welcome offer is ONE $30, delivered through two sides of the same gift:
 * billing grants $30 of credit when the account is created, and this decides how
 * much cash to take for the first day's budget. So the buyer pays the part of
 * their own budget the gift does not cover, and lands with the whole budget in
 * their balance either way:
 *
 *   $30/day  ->  charge $0,   balance $30   (gift $30)
 *   $50/day  ->  charge $20,  balance $50   (gift $30)
 *   $10/day  ->  charge $0,   balance $30   (gift $30)
 *
 * The gift is exactly $30 in every row. It is never $60 (which is what granting
 * the credit AND discounting the charge without subtracting one from the other
 * would give) and never $0 (which is what discounting the charge INSTEAD of
 * granting the credit would give — the buyer would simply pay less for less).
 *
 * Nothing to charge means no payment at all: the checkout runs in setup mode and
 * only takes a card imprint, so a small first budget reaches a live campaign with
 * no money moved. That is not a separate rule to remember, it is what
 * `max(0, budget - gift)` already says at $30 and below.
 *
 * Alias-free so it carries real unit tests. Do not add an `@/…` import.
 */

import { WELCOME_CREDIT_USD } from "./welcome-offer-copy";

/** The gift, in cents. One figure, shared with every sentence that states it. */
export const WELCOME_GIFT_CENTS = WELCOME_CREDIT_USD * 100;

export interface FirstChargePlan {
  /** Cash to take now. Zero means take a card imprint and charge nothing. */
  chargeCents: number;
  /** How much of the gift this checkout consumes, shown to the buyer as a discount. */
  discountCents: number;
  /** False when there is nothing to charge, so the session is setup-mode. */
  charges: boolean;
}

/**
 * The first checkout for a daily budget.
 *
 * A budget that is absent, negative or not finite charges NOTHING rather than
 * throwing: onboarding has already refused to launch without a funded funnel, so
 * reaching here with no number is a bug upstream, and taking a guessed amount off
 * somebody's card is the one outcome worse than taking none.
 */
export function planFirstCharge(
  dailyBudgetUsd: number | null | undefined,
  giftCents: number = WELCOME_GIFT_CENTS,
): FirstChargePlan {
  const budgetCents =
    typeof dailyBudgetUsd === "number" && Number.isFinite(dailyBudgetUsd) && dailyBudgetUsd > 0
      ? Math.round(dailyBudgetUsd * 100)
      : 0;

  const discountCents = Math.min(budgetCents, Math.max(0, giftCents));
  const chargeCents = budgetCents - discountCents;

  return { chargeCents, discountCents, charges: chargeCents > 0 };
}
