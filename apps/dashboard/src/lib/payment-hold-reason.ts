// Why campaign-service stopped a campaign over payment, as a kind the dashboard can word.
//
// campaign-service stops every campaign of an org billing cannot charge, and stamps the
// reason on each: `payment_declined` when the bank refused the card, `no_payment_method`
// when the org has no chargeable card at all (the customer removed it, or never added
// one). The two need different sentences, because they need different fixes: pay and
// change the card, or add one.
//
// No imports on purpose: `campaign-controls.ts` and `payment-declined.ts` both read this,
// and `payment-declined.ts` imports `campaign-controls.ts`.

export const PAYMENT_DECLINED_STOP_REASON = "payment_declined";
export const NO_PAYMENT_METHOD_STOP_REASON = "no_payment_method";

export type PaymentHoldKind = "declined" | "no_payment_method";

/** The kind a stop reason names, or null for a stop that is not about payment. */
export function paymentHoldKindForStopReason(
  reason: string | null | undefined,
): PaymentHoldKind | null {
  if (reason === PAYMENT_DECLINED_STOP_REASON) return "declined";
  if (reason === NO_PAYMENT_METHOD_STOP_REASON) return "no_payment_method";
  return null;
}
