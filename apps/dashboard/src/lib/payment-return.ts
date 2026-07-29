/**
 * Stripe never mutates a payment when the money goes back out: a fully refunded
 * charge keeps `status: "succeeded"` at its full amount forever, and the refund
 * lives on a separate object. stripe-service therefore derives, per payment,
 * `amount_returned` (minor units) = settled refunds + lost disputes. Only money
 * that has actually left counts: a pending refund, a refund that later failed or
 * was cancelled, and an open or won dispute are all excluded.
 *
 * So `amount_returned` is the only way to tell a live top-up from a returned one,
 * and it is what keeps the Payments card coherent with the Available balance
 * above it (billing-service stopped counting returned money as credit).
 *
 * A lost dispute is deliberately indistinguishable from a refund here: from the
 * customer's side the money simply came back, so nothing surfaces the word
 * dispute or chargeback.
 */
export type PaymentReturnState = "none" | "partial" | "full";

export function paymentReturnState(
  amountCents: number,
  amountReturnedCents: number
): PaymentReturnState {
  if (amountReturnedCents <= 0) return "none";
  if (amountReturnedCents >= amountCents) return "full";
  return "partial";
}

/**
 * Badge for a returned payment. `null` for "none" so the caller keeps rendering
 * the plain Stripe-status badge, byte-identically to a never-refunded payment.
 * Background tint only, no border accent.
 */
export function paymentReturnBadge(
  state: PaymentReturnState
): { label: string; className: string } | null {
  switch (state) {
    case "full":
      return { label: "Refunded", className: "bg-gray-100 text-gray-600" };
    case "partial":
      return { label: "Partially refunded", className: "bg-gray-100 text-gray-600" };
    case "none":
      return null;
  }
}
