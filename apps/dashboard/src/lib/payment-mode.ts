/**
 * Prepaid or postpaid, as the Billing page offers it.
 *
 * billing-service owns the rule (its lib/payment-mode): POSTPAID runs on a credit line
 * and needs a card it can charge with nobody on the page, PREPAID spends only what was
 * paid in and needs no card. Switching postpaid to prepaid collects what is owed FIRST
 * and refuses with a stable `code` when it cannot. This module only decides what the
 * page SAYS about those rules; it decides none of them.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

export type PaymentMode = "prepaid" | "postpaid";

/** The fields of the billing account this module reads. */
export interface PaymentModeAccount {
  payment_mode?: string | null;
  has_payment_method: boolean;
  auto_reload_supported?: boolean;
}

/** The org's mode as billing states it, or null when the account does not say. */
export function paymentModeOf(account: PaymentModeAccount | null | undefined): PaymentMode | null {
  const mode = account?.payment_mode;
  return mode === "prepaid" || mode === "postpaid" ? mode : null;
}

/**
 * Why the org cannot move to POSTPAID from here, or null when it can.
 *
 * billing does not refuse this switch, it stops the org's campaigns the moment it
 * lands without a chargeable card. So the page refuses first, with the reason, rather
 * than letting one click stop every campaign.
 */
export function postpaidBlocker(account: PaymentModeAccount | null | undefined): string | null {
  if (!account) return null;
  if (!account.has_payment_method) {
    return "Add a card first. Postpaid is charged to the card on file.";
  }
  if (account.auto_reload_supported === false) {
    return "This card cannot be charged automatically, so postpaid needs another card.";
  }
  return null;
}

/** The refusal codes billing answers a switch to prepaid with (HTTP 409). */
export type PaymentModeRefusalCode =
  | "outstanding_balance_no_card"
  | "outstanding_balance_charge_declined"
  | "outstanding_balance_below_minimum_charge";

/**
 * What to say when a switch fails. Keyed on the STATUS and billing's machine `code`,
 * never on its English, and never the raw body (that is how a JSON blob reaches a
 * customer). `owedCents` is billing's own figure, formatted by the caller.
 */
export function paymentModeRefusalMessage(
  status: number | null,
  code: unknown,
  owed: string | null,
): string {
  if (status === 409) {
    const amount = owed ? `${owed} ` : "";
    switch (code) {
      case "outstanding_balance_no_card":
        return `You owe ${amount}and there is no card we can charge for it. Add a card or add credit, then switch to prepaid.`;
      case "outstanding_balance_charge_declined":
        return `Your card was declined for the ${amount}you owe, so you are still on postpaid. Change your card or add credit, then try again.`;
      case "outstanding_balance_below_minimum_charge":
        return `You owe ${amount}which is less than a card can be charged. Add credit to bring your balance to zero, then switch to prepaid.`;
    }
  }
  return "We could not change how you pay. Please try again.";
}
