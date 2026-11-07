/**
 * The brand is the scope of every v2 page (owner 2026-11-07, AUDIENCE-PER-OFFER-1107); Offers
 * are a list. Alias-free so it carries real unit tests.
 */

export interface CampaignOfferLike {
  offerId?: string | null;
}

/**
 * The offers the brand's campaigns sell, sorted, each once. With exactly one, an offer-grain
 * features-service read IS the brand's figure; with several, nothing is added up in the browser:
 * the figure waits for its brand-grain read, or a list shows one entry per offer.
 */
export function offersOfCampaigns(campaigns: readonly CampaignOfferLike[]): string[] {
  const offers = new Set<string>();
  for (const c of campaigns) if (c.offerId) offers.add(c.offerId);
  return [...offers].sort();
}
