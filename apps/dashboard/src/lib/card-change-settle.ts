/**
 * What opening the card page will CHARGE, so the customer is told before it
 * happens rather than after.
 *
 * billing-service collects an outstanding balance at the moment a card session
 * is opened, on the card already on file, and hands the session over whatever
 * that charge does (see its lib/card-change-settlement). That is the right rule
 * and it was invisible: the click fired a real charge behind a button whose only
 * feedback was its own label, and the settle takes seconds on a live card. A
 * customer watching nothing happen abandons, and the money has already moved.
 *
 * Measured 2026-09-17 on one org: the charge took 6.3 seconds and succeeded, the
 * portal URL came back 272 ms later, and the browser had already stopped
 * listening. The second click, with nothing left to settle, answered in 294 ms
 * and opened immediately.
 *
 * So this answers the one question a confirmation needs: how much, or nothing.
 * It is alias-free on purpose (a structural argument, no imports) so it carries
 * real unit tests — keep it that way.
 */

/**
 * The acquirer rejects a smaller charge outright, so billing-service skips a
 * deficit under it and lets the month-end sweep carry it. Byte-equal to that
 * service's own `STRIPE_MIN_CHARGE_CENTS`; a warning about a charge that cannot
 * fire is a false alarm.
 */
export const MIN_SETTLE_CHARGE_CENTS = 50;

/** The slice of a billing account this rule reads. */
export interface CardChangeSettleAccount {
  /** Nothing to charge without one, so billing attempts nothing. */
  has_payment_method: boolean;
  /** Full-precision decimal string. Negative = postpaid usage running on credit. */
  balance_cents: string;
  /**
   * Off-session charging is impossible for some issuing countries (India, RBI
   * e-mandates), and billing skips the settle entirely for those. Absent on an
   * older billing deploy, which reads as supported.
   */
  auto_reload_supported?: boolean;
}

/**
 * Cents that opening the card page will charge, or `null` when it will charge
 * nothing.
 *
 * `null` covers every case billing-service SKIPS that this app can see, and the
 * distinction matters in one direction only: promising a charge that does not
 * fire teaches the customer to ignore the warning. What it cannot see (a card
 * the issuer called lost, a recent decline holding the org in backoff) makes
 * billing skip too, so the warning is at worst conservative and never a
 * surprise.
 *
 * An unreadable balance is `null` rather than 0: "we could not measure this" and
 * "you owe nothing" are different statements, and only one of them is safe to
 * put in front of somebody's money.
 */
export function cardChangeSettleCents(
  account: CardChangeSettleAccount | null | undefined,
): number | null {
  if (!account) return null;
  if (!account.has_payment_method) return null;
  // Only an explicit `false` blocks it — the field is absent on older deploys.
  if (account.auto_reload_supported === false) return null;

  const raw = account.balance_cents;
  // `Number("")` and `Number("  ")` are both 0, so a blank has to be refused
  // BEFORE the finiteness check or it reads as a settled account.
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const balance = parseFloat(raw);
  if (!Number.isFinite(balance)) return null;
  if (balance >= 0) return null;

  // Round UP, as billing does: rounding down would leave the org a fraction
  // negative and state a figure a cent under what it charges.
  const deficit = Math.ceil(-balance);
  if (deficit < MIN_SETTLE_CHARGE_CENTS) return null;
  return deficit;
}

/**
 * What billing-service reports about the settle it attempted while minting the
 * card session. Every field is optional: an older billing deploy states none of
 * them, and that reads as "nothing to say" rather than as a failure.
 *
 *   charged        the balance was taken
 *   declined       the acquirer refused the card; the balance is still owed
 *   failed         no answer from the acquirer; nothing is known to be charged
 *   not_attempted  nothing was presented (nothing owed, no chargeable card...)
 */
export interface CardSessionSettlement {
  settle_result?: string;
  settle_decline_message?: string | null;
}

/** A settle the customer must hear about BEFORE being sent to the card page. */
export type SettleProblem =
  | { kind: "declined"; message: string | null }
  | { kind: "failed" };

/**
 * The problem to state, or null when the redirect can go ahead as before.
 *
 * The redirect used to be unconditional, so a declined charge was never
 * mentioned: the customer left for the card page with no idea the balance was
 * still owed or why (prod 2026-09-22, "Your card does not support this type of
 * purchase", redirected in silence). A decline and a no-answer are kept apart
 * because they send the customer to different actions: a refused card should
 * be replaced, a card that never reached the bank may be fine.
 *
 * An unknown `settle_result` is treated as nothing to say, the same as an
 * absent one: the page still opens, which is the rule that matters.
 */
export function cardSessionSettleProblem(
  setup: CardSessionSettlement | null | undefined,
): SettleProblem | null {
  if (!setup) return null;
  if (setup.settle_result === "declined") {
    const raw = setup.settle_decline_message;
    const message = typeof raw === "string" && raw.trim() ? raw.trim() : null;
    return { kind: "declined", message };
  }
  if (setup.settle_result === "failed") return { kind: "failed" };
  return null;
}
