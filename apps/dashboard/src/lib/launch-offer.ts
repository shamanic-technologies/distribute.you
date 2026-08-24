// Which OFFER the campaign created at the end of onboarding sells, and which
// offer the ceiling that paces it funds.
//
// A campaign is (offer x funnel x channel). The funnel and the channel were
// already stated; the offer was not, so every campaign a signup produced named
// none — and a campaign attributed to no offer belongs to no offer page, which
// is where a customer looks for it. Same for the ceiling: billing keys it on the
// same triple, and one that names no offer addresses the pair as a whole rather
// than the campaign it actually funds.
//
// There is nothing to CREATE here. brand-service gives a brand its first offer
// on the first brand-scoped write, and onboarding has already made several by
// the time it launches (the funnels write makes one, the user-fields write
// makes one) — so by launch the offer exists and this only has to read it.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias).

/** The shape this reads off a brand's offers — a superset is fine. */
export interface OfferIdentity {
  offerId: string;
}

/**
 * The one offer this launch's campaign sells, or null when there is no single
 * correct answer.
 *
 * An offer belongs to an (org, brand) PAIR, and the read this consumes is
 * already scoped to both, so a brand holding exactly one offer has exactly one
 * possible answer and needs no heuristic. Zero offers and several offers are
 * both "we do not know", and both return null: naming the wrong offer files a
 * campaign — and the money that paces it — under a proposition the customer
 * never sold through, which is worse than leaving it unattributed for a tick.
 *
 * Left unattributed, campaign-service and billing adopt the row on their own
 * cadence once the pair resolves, so null is a delay rather than a dead end.
 */
export function soleOfferId(offers: readonly OfferIdentity[]): string | null {
  if (offers.length !== 1) return null;
  const id = offers[0].offerId.trim();
  return id.length > 0 ? id : null;
}
