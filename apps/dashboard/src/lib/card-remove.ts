/**
 * What removing the card on file will DO to this org, so the customer is told
 * before they ask for it rather than after.
 *
 * The product had no way to remove a card at all. stripe-service pins both
 * billing-portal configurations away from the payment-method management screen
 * (its PR #167), on the Google Ads / Meta / AWS reading that a customer REPLACES
 * a card and never removes the last one — which is right about the portal and is
 * not a complete answer, because it leaves someone who wants us to stop holding
 * their card with no path at any balance, ever.
 *
 * The owner's rule, and it is the whole design: they may always leave. We attempt
 * to collect what they owe at the moment they ask, and whether that collection
 * succeeds or fails, the card goes. Nothing is forgiven — what is owed stays owed
 * and stays owned by the existing sweeps. So there is exactly ONE rule on both
 * card buttons (attempt, never gate), rather than two that would drift.
 *
 * What this module answers is the OTHER half of the sentence: what stops. That
 * is not a constant, and stating it as one would be a lie in the common case —
 * an org sitting on credit keeps running until the credit is gone, and telling
 * them their campaigns stop now is false. The amount we would CHARGE is not
 * derived here: `cardChangeSettleCents` already owns that, both buttons read it,
 * and a second derivation is how two surfaces come to state different money for
 * one click.
 *
 * Alias-free on purpose (a structural argument, no imports) so it carries real
 * unit tests — keep it that way.
 */

/** The slice of a billing account this rule reads. */
export interface CardRemoveAccount {
  /** Spendable balance, full-precision decimal string. Negative = on credit. */
  balance_cents: string;
}

/**
 * What the customer is about to lose.
 *
 * `runs_down` — there is credit left, so outreach continues until it is spent
 * and nothing tops it up after that. `stops_now` — nothing is left to spend, so
 * removing the card is the moment it stops. `unknown` — the balance could not be
 * read, and a surface that cannot measure the consequence must not assert one.
 */
export type CardRemoveConsequence =
  | { kind: "runs_down"; availableCents: number }
  | { kind: "stops_now" }
  | { kind: "unknown" };

/**
 * Read the balance the way the settle rule does, and refuse a blank BEFORE the
 * finiteness check — `Number("")` and `Number("  ")` are both 0, so a blank that
 * fell through would read as a settled account with nothing left, which is the
 * one reading that is confidently wrong in both directions.
 */
export function cardRemoveConsequence(
  account: CardRemoveAccount | null | undefined,
): CardRemoveConsequence {
  if (!account) return { kind: "unknown" };

  const raw = account.balance_cents;
  if (typeof raw !== "string" || raw.trim().length === 0) return { kind: "unknown" };
  const balance = parseFloat(raw);
  if (!Number.isFinite(balance)) return { kind: "unknown" };

  // Rounded DOWN: a fraction of a cent buys nothing, and claiming credit the org
  // cannot spend would overstate how long they keep running.
  const available = Math.floor(balance);
  if (available > 0) return { kind: "runs_down", availableCents: available };
  return { kind: "stops_now" };
}
