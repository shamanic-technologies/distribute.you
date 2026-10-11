/**
 * Staff credit grants that record a PAYMENT the client made to us directly (bank
 * transfer), not a gift.
 *
 * billing-service (v0.83.23) stamps such a grant with `offPlatformPaidAt` and counts
 * it as cash the client paid. Owner rule 2026-10-11: revenue is cash the client paid,
 * a granted credit is never revenue. So the Billing page must not list that grant
 * under "Free credit": Olive paid $200 and saw it as a gift. It goes to "Payments",
 * dated on the day she paid.
 *
 * Alias-free so it carries real unit tests. Do not add an `@/…` import.
 */

/** The grant fields this module reads (structural, matches `CreditGrant` in lib/api). */
export interface GrantLike {
  id: string;
  amountCents: string;
  createdAt: string;
  offPlatformPaidAt?: string | null;
}

/** The payment-row fields the Payments card reads (structural, matches `Payment`). */
export interface PaymentRowLike {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  description: string | null;
  amountReturnedCents: number;
  declineMessage: string | null;
  declineCode: string | null;
}

/** What the customer reads on a payment they made to us directly. */
export const DIRECT_PAYMENT_LABEL = "Direct payment";

export function isOffPlatformPayment(grant: GrantLike): boolean {
  return typeof grant.offPlatformPaidAt === "string" && grant.offPlatformPaidAt.length > 0;
}

/** Splits the grants ledger into real gifts and payments the client made directly. */
export function splitCreditGrants<G extends GrantLike>(
  grants: G[],
): { gifts: G[]; directPayments: G[] } {
  const gifts: G[] = [];
  const directPayments: G[] = [];
  for (const g of grants) (isOffPlatformPayment(g) ? directPayments : gifts).push(g);
  return { gifts, directPayments };
}

/** One Payments row per direct payment, dated on the day the client paid. */
export function directPaymentRows(grants: GrantLike[]): PaymentRowLike[] {
  return grants.filter(isOffPlatformPayment).map((g) => ({
    id: `grant:${g.id}`,
    // Billing serves decimal cents as text ("20000" or "20000.0000").
    amountCents: Math.round(Number(g.amountCents)),
    currency: "usd",
    status: "succeeded",
    createdAt: paidDayAsNoon(g.offPlatformPaidAt as string),
    description: DIRECT_PAYMENT_LABEL,
    amountReturnedCents: 0,
    declineMessage: null,
    declineCode: null,
  }));
}

/**
 * Staff pick a DAY; billing stores it at UTC midnight, which reads as the day before
 * anywhere west of UTC. Move a bare midnight-UTC day to noon UTC so the page prints
 * the day the client paid in every time zone. A real time of day is kept as is.
 */
export function paidDayAsNoon(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.0+)?(?:Z|\+00:00))?$/.exec(iso);
  return m ? `${m[1]}T12:00:00.000Z` : iso;
}

/** Card payments and direct payments in one list, newest first. */
export function mergePayments<P extends PaymentRowLike>(
  cardPayments: P[],
  grants: GrantLike[],
): Array<P | PaymentRowLike> {
  const all: Array<P | PaymentRowLike> = [...cardPayments, ...directPaymentRows(grants)];
  return all
    .map((p, i) => ({ p, i, t: Date.parse(p.createdAt) || 0 }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map((x) => x.p);
}
