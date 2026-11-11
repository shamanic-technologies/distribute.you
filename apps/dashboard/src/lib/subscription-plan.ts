/**
 * The subscription plan: $99/month, a 3-day free trial, card required (owner
 * 2026-10-01). No longer sold at signup (OFFER-RESET-1029; the homepage A/B arms that
 * sold it were deleted 2026-11-11): what is left here serves the orgs already on a plan.
 *
 * Owner's model, restated: the money paid IS the credit ($99 paid, $99 to spend; the
 * trial start grants $99 at our expense). Outbound runs at $50 a day from the start so
 * the trial shows replies before day 3, and reactive work (answering replies) may spend
 * up to +50% of that. Credit at zero stops sending, by design: no auto top-up.
 *
 * billing-service owns the subscription (checkout, trial grant, mode flip, raises);
 * this module only holds what the dashboard decides: how the plan's daily money is
 * spread over the campaigns, and the words.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

import { isProactiveFrom } from "./outbound-leg-key";

export const SUBSCRIPTION_MONTHLY_CENTS = 9900;
export const SUBSCRIPTION_TRIAL_DAYS = 3;
/**
 * The monthly amounts offered in the plan dropdown (owner 2026-10-01: the customer
 * picks what they want, several choices, never a bare "+$100"). Every value sits on
 * billing's ladder (9900 + k x 10000).
 */
export const SUBSCRIPTION_AMOUNT_OPTIONS_CENTS = [9900, 19900, 29900, 49900, 99900, 199900] as const;

/** The dropdown's choices: the offered amounts plus the plan's current one, ascending. */
export function planAmountOptions(currentCents: number | null): number[] {
  const set = new Set<number>(SUBSCRIPTION_AMOUNT_OPTIONS_CENTS);
  if (currentCents != null && currentCents > 0) set.add(currentCents);
  return [...set].sort((a, b) => a - b);
}
/** What the plan's outbound (entry legs) may spend a day. */
export const SUBSCRIPTION_OUTBOUND_DAILY_USD = 50;
/** What reactive work may spend a day on top: +50% of the outbound. */
export const SUBSCRIPTION_REACTIVE_DAILY_USD = SUBSCRIPTION_OUTBOUND_DAILY_USD / 2;

/** The fields of a campaign pair this module reads. */
export interface PlanPair {
  key: string;
  /** null on an entry leg (outbound starts it); set on a leg that answers a lead. */
  fromKey: string | null;
}

/**
 * The plan's daily money per campaign, keyed like the onboarding's budget map: the
 * first OUTBOUND campaign carries the $50, the first REACTIVE one the +50% ceiling,
 * every other campaign starts at 0. Whole dollars, as the budget inputs hold them.
 */
export function subscriptionBudgets(pairs: readonly PlanPair[]): Record<string, string> {
  const out: Record<string, string> = {};
  const entry = pairs.find((p) => isProactiveFrom(p.fromKey));
  const reactive = pairs.find((p) => !isProactiveFrom(p.fromKey));
  for (const p of pairs) out[p.key] = "0";
  if (entry) out[entry.key] = String(SUBSCRIPTION_OUTBOUND_DAILY_USD);
  if (reactive) out[reactive.key] = String(SUBSCRIPTION_REACTIVE_DAILY_USD);
  return out;
}

/** The fields of a plan this module reads (billing's per brand x offer plan). */
export interface PlanLike {
  brand_id: string | null;
  offer_id: string | null;
  status: string;
}

/**
 * True when this brand x offer has a live plan (anything but ended). A plan is per
 * brand x offer (owner 2026-10-03): an offer without one does not send on a plan org.
 */
export function offerHasLivePlan(plans: readonly PlanLike[], brandId: string, offerId: string): boolean {
  const b = brandId.toLowerCase();
  const o = offerId.toLowerCase();
  return plans.some(
    (p) => p.status !== "canceled" && p.brand_id?.toLowerCase() === b && p.offer_id?.toLowerCase() === o,
  );
}

/** What a plan start refusal means, keyed on billing's machine `code`. */
export function planStartRefusal(code: unknown): string {
  switch (code) {
    case "plan_exists_for_offer":
      return "This offer already has a plan.";
    case "first_charge_declined":
      return "Your card was not charged, so the plan did not start. Try another card.";
    case "existing_paying_org":
      return "This account pays as you go, so plans are not available on it. Write to us and we will switch it.";
    case "offer_not_found":
      return "We could not find this offer. Refresh the page and try again.";
    default:
      return "The plan did not start and nothing was charged. Try again in a moment.";
  }
}

/** "$99", "$199": a monthly amount in whole dollars. */
export function monthlyUsd(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}
