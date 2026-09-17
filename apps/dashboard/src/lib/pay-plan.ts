// WHAT EACH FUNNEL COSTS ON DAY ONE, and which one is being paid for right now.
//
// The rebuilt onboarding charges per revenue funnel, one at a time: the visitor
// sees an amount, presses a CTA, the money settles, and the next funnel's screen
// opens. Skipping drops that funnel from the selection rather than deferring it,
// and the flow cannot finish with nothing paid, because a brand with no funded
// funnel is a brand nothing will ever run against.
//
// A DAY is what is charged, not a month. The product bills like Google Ads --
// you set a daily budget and are charged what the campaign spent -- so day one
// is the smallest honest commitment, and every day after it is charged as it is
// spent. That is also why the minimum run length published beside it is STATED
// and never enforced: it says how long before the result is judgeable, not how
// long anybody owes us. A consumer that renders it as a lock-in is misreading
// it.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

export interface PayableFunnel {
  key: string;
  name: string;
  /** The rungs, in the producer's own words, for the screen to state. */
  steps: readonly string[];
  /** The funnel half of the pair, for anything that needs the funnel itself. */
  funnelKey: string;
  /** The ONE channel this row buys the funnel through. */
  channelSlug: string;
  /** This pair's own day rate — never summed across a funnel's channels, because a
   *  row IS one pair and billing keys its ceiling on that triple. */
  dailyOperatingCostCents: number;
  /** How long before the result is judgeable. Stated, never enforced. */
  effectiveMinimumCommitmentDays: number;
}

/**
 * Stripe will not take a charge below its own minimum, and billing-service 400s
 * rather than rounding one up. A funnel whose day rate is under it is therefore
 * charged the minimum for its first day — the visitor is told exactly that, and
 * the surplus is credit they spend on the days after, not a fee.
 *
 * 50 cents is Stripe's USD floor. It is stated here because the screen has to
 * show the amount BEFORE the request, and discovering the floor from a 400 would
 * mean showing a number that then changes.
 */
export const STRIPE_MIN_CHARGE_CENTS = 50;

export interface DayOneCharge {
  /** What the card is actually charged. */
  amountCents: number;
  /** The funnel's own day rate, before the floor. */
  dailyOperatingCostCents: number;
  /** True when the floor is doing the work, so the screen can say why the amount
   *  is larger than the day rate beside it. */
  flooredByStripeMinimum: boolean;
}

/** What day one costs for one funnel. */
export function dayOneCharge(funnel: PayableFunnel): DayOneCharge {
  const rate = funnel.dailyOperatingCostCents;
  const amount = Math.max(rate, STRIPE_MIN_CHARGE_CENTS);
  return {
    amountCents: amount,
    dailyOperatingCostCents: rate,
    flooredByStripeMinimum: amount > rate,
  };
}

/**
 * Where the visitor is in the sequence.
 *
 * `current` is the next funnel still owed money. `null` means every picked
 * funnel has been paid or skipped, which is the only way out of the payment
 * screens.
 */
export interface PayStep {
  current: PayableFunnel | null;
  /** 1-based position among the funnels still in play, for the step counter. */
  position: number;
  /** How many are still in play: paid plus not yet decided. A skipped funnel is
   *  gone, so it is not counted. */
  total: number;
  /** Whether skipping THIS one is allowed. It is not when it is the last chance
   *  to buy anything: a flow that ends with nothing paid has sold nothing, and
   *  the visitor would land on a dashboard with no campaign behind it. */
  canSkip: boolean;
}

export function payStep(
  funnels: PayableFunnel[],
  selectedKeys: string[],
  paidKeys: string[],
): PayStep {
  // Order is the visitor's own pick order, so the screens arrive in the order
  // they chose rather than in a ranking of ours.
  const inPlay = selectedKeys
    .map((k) => funnels.find((f) => f.key === k))
    .filter((f): f is PayableFunnel => Boolean(f));

  const paid = new Set(paidKeys);
  const owed = inPlay.filter((f) => !paid.has(f.key));
  const current = owed[0] ?? null;

  return {
    current,
    position: current ? inPlay.length - owed.length + 1 : inPlay.length,
    total: inPlay.length,
    // Skipping is only ever refused on the LAST unpaid funnel of a flow that has
    // bought nothing so far.
    canSkip: !(owed.length === 1 && paid.size === 0),
  };
}

/** Everything the visitor committed to per day, across the funnels they paid
 *  for. Stated on the way out so nobody is surprised by tomorrow. */
export function committedDailyCents(funnels: PayableFunnel[], paidKeys: string[]): number {
  const paid = new Set(paidKeys);
  return funnels
    .filter((f) => paid.has(f.key))
    .reduce((sum, f) => sum + f.dailyOperatingCostCents, 0);
}

/**
 * An idempotency key for one funnel's day-one charge.
 *
 * Keyed on the ORG and the FUNNEL, never on a timestamp or a random value: a
 * visitor who presses the CTA twice, or whose connection retries, must be
 * charged once. billing-service takes the key straight through to Stripe, so the
 * same string is the same charge.
 */
export function dayOneIdempotencyKey(orgId: string, funnelKey: string): string {
  return `onboarding-day-one:${orgId}:${funnelKey}`;
}

/**
 * What a refusal means for the visitor.
 *
 * Every one of these is a distinguishable `code` billing-service raises and the
 * gateway forwards field-for-field. The two that matter are the branch: a
 * declined or unusable card sends them back to a card capture, and an upstream
 * failure is "try again" and must NEVER read as a decline. Rendering the raw
 * message instead would put a backend sentence in front of a customer, and
 * collapsing them would make both branches impossible.
 */
export type ChargeOutcome = "paid" | "needs_card" | "retry" | "declined";

export function chargeOutcomeFor(status: number, code: string | null): ChargeOutcome {
  if (status >= 200 && status < 300) return "paid";
  switch (code) {
    case "charge_declined":
      return "declined";
    case "no_chargeable_payment_method":
    case "card_not_chargeable_off_session":
      return "needs_card";
    case "charge_backoff":
    case "upstream_error":
      return "retry";
    default:
      // An unrecognised refusal is a RETRY, never a decline: telling somebody
      // their card was declined when we do not know that is the one direction
      // that costs trust, and it also sends them to re-enter a card that was
      // probably fine.
      return status === 402 ? "declined" : "retry";
  }
}

export function chargeOutcomeMessage(outcome: ChargeOutcome): string {
  switch (outcome) {
    case "paid":
      return "";
    case "declined":
      return "Your bank refused the charge. No money was taken. Try another card.";
    case "needs_card":
      return "We need a card we can charge for this one. Add one and we will take it from there.";
    case "retry":
      return "We could not reach our payment provider. Nothing was charged. Try again in a moment.";
  }
}
