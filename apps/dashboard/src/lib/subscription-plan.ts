/**
 * The subscription plan: $99/month, a 3-day free trial, card required (owner
 * 2026-10-01), the default offer since 2026-10-03. Every visitor is in it unless the
 * `lp_variant` cookie (set on `.distribute.you` by the landing) names another variant.
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

/**
 * True when this visitor is sold the subscription plan. The plan is the DEFAULT offer
 * (owner 2026-10-03: "we stop talking about $1/day"), so a visitor with no
 * `lp_variant` cookie (blog, compare page, direct link, another device) is in it.
 * Only a cookie that explicitly names another variant (`control`, `instinct`,
 * `assistant`, `concierge`, set by staff testing with `?variant=`) keeps pay-as-you-go.
 */
export function isSubscriptionArm(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return true;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k !== "lp_variant") continue;
    const variant = decodeURIComponent(rest.join("=")).trim();
    return variant === "" || variant === SUBSCRIPTION_ARM;
  }
  return true;
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

/**
 * The daily budget a subscriber's NEW mission is started at, in whole dollars, or null
 * when the plan already funds a mission of the same kind on that offer.
 *
 * Same rule as `subscriptionBudgets`, one mission at a time: a plan runs ONE outbound
 * mission at $50/day and ONE reactive mission at $25/day per offer (owner 2026-10-03:
 * fixed, not a choice). A second mission of a funded kind would double the plan's spend.
 */
export function planMissionBudgetUsd(
  pair: { fromKey: string | null },
  fundedOnOffer: readonly { fromKey: string | null }[],
): number | null {
  const entry = pair.fromKey === null;
  if (fundedOnOffer.some((p) => (p.fromKey === null) === entry)) return null;
  return entry ? SUBSCRIPTION_OUTBOUND_DAILY_USD : SUBSCRIPTION_REACTIVE_DAILY_USD;
}

/** The monthly amount the visitor picked on the landing (`lp_plan`, cents), or $99. */
export function pickedPlanCents(cookieHeader: string | null | undefined): number {
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, ...rest] = part.trim().split("=");
      if (k !== "lp_plan") continue;
      const cents = Number(decodeURIComponent(rest.join("=")));
      if (Number.isInteger(cents) && cents >= SUBSCRIPTION_MONTHLY_CENTS && (cents - SUBSCRIPTION_MONTHLY_CENTS) % 10000 === 0) {
        return cents;
      }
    }
  }
  return SUBSCRIPTION_MONTHLY_CENTS;
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
