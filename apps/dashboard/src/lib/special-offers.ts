/**
 * Special offers (Black Friday 2026 and the like): what each one brought THIS org.
 *
 * billing-service keeps a special offer as its own object, apart from the welcome
 * credit, referral rewards and staff grants (owner: "not cumulative with other
 * offers"), and serves, per offer, the money the org paid under it and the free
 * credit it gave, as ready-made totals (gateway `GET /v1/billing/special-offers`).
 * Money is decimal cents as TEXT (`"45000.0000000000"` = $450): printed as served,
 * never summed here.
 *
 * The free credit an offer gives is also a row of billing's grants ledger, under the
 * promo code `special_offer`. That row belongs to this section, never to "Free
 * credit": `isSpecialOfferGrant` takes it out of the gifts list.
 *
 * Alias-free so it carries real unit tests. Do not add an `@/…` import.
 */
import { z } from "zod";

const SpecialOfferPaymentSchema = z
  .object({
    payment_id: z.string(),
    acquirer: z.string(),
    paid_cents: z.string(),
    paid_at: z.string(),
    free_credit_cents: z.string(),
    grant_id: z.string(),
    applied_at: z.string(),
  })
  .passthrough();

const SpecialOfferSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    starts_at: z.string(),
    ends_at: z.string(),
    paid_cents: z.string(),
    free_credit_cents: z.string(),
    payments: z.array(SpecialOfferPaymentSchema),
  })
  .passthrough();

export const SpecialOffersResponseSchema = z
  .object({
    org_id: z.string(),
    special_offers: z.array(SpecialOfferSchema),
  })
  .passthrough();

export interface SpecialOfferPayment {
  paymentId: string;
  paidCents: string;
  paidAt: string;
  freeCreditCents: string;
}

export interface SpecialOffer {
  slug: string;
  name: string;
  paidCents: string;
  freeCreditCents: string;
  payments: SpecialOfferPayment[];
}

/** Parses billing's body; throws (loud) on a shape it does not recognise. */
export function parseSpecialOffers(raw: unknown): SpecialOffer[] {
  const parsed = SpecialOffersResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] getSpecialOffers: response shape mismatch", {
      issues: parsed.error.issues,
      raw,
    });
    throw new Error("[dashboard] getSpecialOffers: invalid response shape");
  }
  return parsed.data.special_offers.map((o) => ({
    slug: o.slug,
    name: o.name,
    paidCents: o.paid_cents,
    freeCreditCents: o.free_credit_cents,
    payments: o.payments.map((p) => ({
      paymentId: p.payment_id,
      paidCents: p.paid_cents,
      paidAt: p.paid_at,
      freeCreditCents: p.free_credit_cents,
    })),
  }));
}

/** billing's promo code on the grant a special offer gives. */
export const SPECIAL_OFFER_GRANT_REASON = "special_offer";

/** True for the grant a special offer gave: it shows under the offer, never as free credit. */
export function isSpecialOfferGrant(grant: { reason: string }): boolean {
  return grant.reason === SPECIAL_OFFER_GRANT_REASON;
}

/**
 * What the Billing page draws for this read:
 * - `hidden`: no offer (or nothing known yet): the page reads exactly as before;
 * - `error`: the read failed with nothing to show: one plain sentence, never "$0";
 * - `list`: one card per offer.
 */
export type SpecialOffersView =
  | { kind: "hidden" }
  | { kind: "error" }
  | { kind: "list"; offers: SpecialOffer[] };

export function specialOffersView(query: {
  data: SpecialOffer[] | undefined;
  isError: boolean;
}): SpecialOffersView {
  if (query.data !== undefined) {
    return query.data.length > 0 ? { kind: "list", offers: query.data } : { kind: "hidden" };
  }
  return query.isError ? { kind: "error" } : { kind: "hidden" };
}
