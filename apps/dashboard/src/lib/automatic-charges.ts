/**
 * Does billing charge this org's card by itself as it spends? The ONE reader of that
 * question for every surface (launch gates, runway alerts, the payment modal, the
 * Billing page), byte-equal in apps/dashboard and apps/admin.
 *
 * - POSTPAID (owner 2026-10-21: « l'autotopup n'a aucun sens en post paid et ne
 *   devrait pas exister, de même que add credit »): there is no auto top-up. The card
 *   is charged at each step of the credit line, which billing serves as
 *   `credit_line_cents` (null when no chargeable card carries it). `has_auto_topup` and
 *   `topup_*` are never read for postpaid: billing stops serving them.
 * - PREPAID / plan: billing's own `has_auto_topup`.
 *
 * Alias-free on purpose so it carries real unit tests.
 */
export interface AutomaticChargesAccount {
  payment_mode?: string | null;
  has_auto_topup?: boolean | null;
  credit_line_cents?: number | null;
}

export function chargesAutomatically(account: AutomaticChargesAccount): boolean {
  if (account.payment_mode === "postpaid") return (account.credit_line_cents ?? 0) > 0;
  return account.has_auto_topup === true;
}
