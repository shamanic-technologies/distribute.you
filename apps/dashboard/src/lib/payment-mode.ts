/**
 * Prepaid, postpaid or subscription, as the Billing page states it.
 *
 * billing-service owns the rule (its lib/payment-mode): POSTPAID runs on a credit line
 * and needs a card it can charge with nobody on the page, PREPAID spends only what was
 * paid in and needs no card, SUBSCRIPTION is the $99/month plan (paid = credit, no
 * auto top-up; `lib/subscription-plan`). Staff set the mode (owner 2026-10-01: the Billing page
 * shows it as a tag, no switch). This module only reads it; it decides nothing.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

export type PaymentMode = "prepaid" | "postpaid";
/** Every mode billing can state. Only staff (or the plan's own checkout) enter `subscription`. */
export type BillingMode = PaymentMode | "subscription";

/** The fields of the billing account this module reads. */
export interface PaymentModeAccount {
  payment_mode?: string | null;
  has_payment_method: boolean;
  auto_reload_supported?: boolean;
}

/** The org's mode as billing states it, or null when the account does not say. */
export function paymentModeOf(account: PaymentModeAccount | null | undefined): BillingMode | null {
  const mode = account?.payment_mode;
  return mode === "prepaid" || mode === "postpaid" || mode === "subscription" ? mode : null;
}
