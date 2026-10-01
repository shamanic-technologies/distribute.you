/**
 * The subscription plan: $99/month, a 3-day free trial, card required (owner
 * 2026-10-01). Sold to the landing's `subscription` arm, which the visitor carries in
 * the `lp_variant` cookie (set on `.distribute.you` by the landing).
 *
 * Owner's model, restated: the money paid IS the credit ($99 paid, $99 to spend; the
 * trial start grants $99 at our expense). Outbound runs at $50 a day from the start so
 * the trial shows replies before day 3, and reactive work (answering replies) may spend
 * up to +50% of that. Credit at zero stops sending, by design: no auto top-up.
 *
 * billing-service owns the subscription (checkout, trial grant, mode flip, raises);
 * this module only holds what the dashboard decides: who is in the arm, how the plan's
 * daily money is spread over the campaigns, and the words.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

export const SUBSCRIPTION_ARM = "subscription";
export const SUBSCRIPTION_MONTHLY_CENTS = 9900;
export const SUBSCRIPTION_TRIAL_DAYS = 3;
/** One step of the "add more" ladder billing accepts (9900 + k x 10000). */
export const SUBSCRIPTION_RAISE_STEP_CENTS = 10000;
/** What the plan's outbound (entry legs) may spend a day. */
export const SUBSCRIPTION_OUTBOUND_DAILY_USD = 50;
/** What reactive work may spend a day on top: +50% of the outbound. */
export const SUBSCRIPTION_REACTIVE_DAILY_USD = SUBSCRIPTION_OUTBOUND_DAILY_USD / 2;

/** True when the landing drew this visitor into the subscription arm. */
export function isSubscriptionArm(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "lp_variant") return decodeURIComponent(rest.join("=")) === SUBSCRIPTION_ARM;
  }
  return false;
}

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
  const entry = pairs.find((p) => p.fromKey === null);
  const reactive = pairs.find((p) => p.fromKey !== null);
  for (const p of pairs) out[p.key] = "0";
  if (entry) out[entry.key] = String(SUBSCRIPTION_OUTBOUND_DAILY_USD);
  if (reactive) out[reactive.key] = String(SUBSCRIPTION_REACTIVE_DAILY_USD);
  return out;
}

/** "$99", "$199": a monthly amount in whole dollars. */
export function monthlyUsd(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

/** What a checkout refusal means, keyed on billing's machine `code`, never its English. */
export function subscriptionCheckoutRefusal(code: unknown): string {
  switch (code) {
    case "subscription_exists":
      return "This account already has a subscription. Open your Billing page to see it.";
    case "existing_paying_org":
      return "This account already pays as you go, so the monthly plan is not available on it. Write to us and we will switch it.";
    case "acquirer_not_supported":
      return "Your card setup on this account cannot take a subscription. Write to us and we will sort it out.";
    default:
      return "We couldn't open the checkout. Nothing was charged. Please try again in a moment.";
  }
}
