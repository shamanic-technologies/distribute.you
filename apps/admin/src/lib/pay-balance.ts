/**
 * POSTPAID "Pay $X now" (owner 2026-10-21: « l'autotopup n'a aucun sens en post paid
 * et ne devrait pas exister, de même que add credit; on doit juste pouvoir être
 * prélevé de tout le montant »). A postpaid org starts at $0, spends on credit, and its
 * card is charged at each step of its credit line and at month end. Its one money
 * action is paying the whole amount owed now (billing-service `pay_balance`).
 *
 * Alias-free on purpose (no `@/` import) so the words carry real unit tests.
 * Byte-equal twin: apps/admin/src/lib/pay-balance.ts && apps/dashboard/src/lib/v2/pay-balance.ts.
 * billing-service owns every figure and every refusal; this module only NAMES them.
 */

/** What the postpaid card shows, read off billing's account fields, never derived. */
export interface PostpaidOwed {
  /** Whole cents owed now, rounded UP like billing's charge (null = not served). */
  owedCents: number | null;
  /** How far below $0 the balance may go before the card is charged (null = no line). */
  creditLineCents: number | null;
  /** What each crossing of the line charges (null = no line). */
  stepCents: number | null;
}

export function postpaidOwed(account: {
  amount_owed_cents?: string | null;
  credit_line_cents?: number | null;
  credit_line_step_cents?: number | null;
} | null | undefined): PostpaidOwed {
  const raw = account?.amount_owed_cents;
  const parsed = raw === undefined || raw === null ? null : parseFloat(raw);
  if (parsed !== null && !Number.isFinite(parsed)) {
    console.error("[billing v2] amount_owed_cents is not a number:", raw);
  }
  return {
    owedCents: parsed === null || !Number.isFinite(parsed) ? null : Math.max(0, Math.ceil(parsed - 1e-9)),
    creditLineCents: account?.credit_line_cents ?? null,
    stepCents: account?.credit_line_step_cents ?? null,
  };
}

/**
 * One plain sentence per refusal billing names (`code` on the error body), keyed on
 * the CODE, never on billing's message. An unknown code gets the generic sentence and
 * is logged by the caller.
 */
export const PAY_BALANCE_REFUSALS: Record<string, string> = {
  charge_declined: "Your card was declined. Change your card, then try again.",
  charge_backoff: "Your card was declined a moment ago. Try again in a few minutes.",
  no_chargeable_payment_method: "We have no card to charge. Add a card, then try again.",
  card_not_chargeable_off_session:
    "Your bank asks you to approve each payment, so we cannot charge this card from here. Add another card.",
  balance_below_minimum_charge: "This amount is too small to charge on its own. We add it to your next charge.",
  not_postpaid: "Your account pays in advance, so there is nothing to pay off.",
};

export const PAY_BALANCE_GENERIC = "We could not charge your card. Please try again.";

export function payBalanceRefusal(body: unknown): { code: string | null; message: string } {
  const code =
    body && typeof body === "object" && typeof (body as { code?: unknown }).code === "string"
      ? ((body as { code: string }).code)
      : null;
  return { code, message: (code && PAY_BALANCE_REFUSALS[code]) || PAY_BALANCE_GENERIC };
}

/** The success line, from what billing says it charged. */
export function paidLine(chargedCents: number, formatted: string): string {
  return chargedCents > 0 ? `Payment of ${formatted} received. Your balance is $0.00.` : "No balance due.";
}
