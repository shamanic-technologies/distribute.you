/**
 * A declined charge is already on the wire and nothing renders it.
 *
 * stripe-service mirrors the raw Stripe PaymentIntent, `last_payment_error`
 * included, and api-service passes the list through untouched — so the reason a
 * card was refused (`card_declined` / `insufficient_funds`, plus the sentence
 * Stripe wrote for the cardholder) reaches the browser on every poll. The
 * payments table showed those intents as a grey "Incomplete" badge with no
 * reason, which is indistinguishable from an abandoned checkout.
 *
 * This is what turns that list into the one question a customer has: has a
 * charge been refused since the last one that went through.
 *
 * Two exclusions carry the whole rule:
 *
 *  - A payment that SUCCEEDED is never a failure, even when it carries a
 *    `last_payment_error`. Stripe keeps the error of an earlier attempt on the
 *    same intent, so a card that was declined and then accepted on a retry
 *    still has one; reading it would report a failure the customer already
 *    fixed.
 *  - An intent with NO error object is not a failure either. An abandoned
 *    checkout also rests at `requires_payment_method`, and telling someone
 *    their payment failed because they closed a tab is worse than saying
 *    nothing.
 *
 * Everything is measured against the newest SUCCEEDED payment rather than
 * against the newest payment overall: what matters is whether the money is
 * flowing now, not what the most recent row happens to be.
 */

/** Shown when Stripe sent no cardholder-facing message with the decline. */
export const GENERIC_DECLINE_MESSAGE = "Your card was declined.";

/** The fields of a `Payment` this reads. Structural on purpose — keeps the
 *  module import-free so it carries real unit tests. */
export interface PaymentFailureInput {
  status: string;
  createdAt: string;
  amountCents: number;
  declineMessage: string | null;
  declineCode: string | null;
}

export interface PaymentFailure {
  /** The refused charge's amount, so a retry asks for what was owed. */
  amountCents: number;
  /** Stripe's own cardholder-facing sentence, verbatim. */
  message: string;
  /** `decline_code` when Stripe sent one, else its `code`. Diagnostics only. */
  code: string | null;
  /** ISO 8601 — when the most recent refusal happened. */
  at: string;
  /** How many charges have been refused since the last successful one. */
  attempts: number;
}

function isDeclined(p: PaymentFailureInput): boolean {
  if (p.status === "succeeded") return false;
  return Boolean(p.declineMessage || p.declineCode);
}

/**
 * The most recent refusal since the last payment that went through, or `null`
 * when the money is flowing. `payments` may arrive in any order.
 */
export function latestPaymentFailure(payments: PaymentFailureInput[]): PaymentFailure | null {
  let lastSuccessAt: string | null = null;
  for (const p of payments) {
    if (p.status !== "succeeded") continue;
    if (lastSuccessAt === null || p.createdAt > lastSuccessAt) lastSuccessAt = p.createdAt;
  }

  const declines = payments.filter(
    (p) => isDeclined(p) && (lastSuccessAt === null || p.createdAt > lastSuccessAt)
  );
  if (declines.length === 0) return null;

  const newest = declines.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  return {
    amountCents: newest.amountCents,
    message: newest.declineMessage?.trim() || GENERIC_DECLINE_MESSAGE,
    code: newest.declineCode ?? null,
    at: newest.createdAt,
    attempts: declines.length,
  };
}

/**
 * "12 attempts have failed since Aug 29" — the count is what tells a customer
 * this is a standing problem rather than one unlucky charge. A single failure
 * says so without a number, which reads better than "1 attempt".
 */
export function paymentFailureAttemptsLine(failure: PaymentFailure): string {
  const since = new Date(failure.at);
  const day = Number.isNaN(since.getTime())
    ? null
    : since.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (failure.attempts <= 1) {
    return day ? `Last attempted ${day}.` : "";
  }
  const many = `${failure.attempts} payment attempts have failed`;
  return day ? `${many}, most recently ${day}.` : `${many}.`;
}
