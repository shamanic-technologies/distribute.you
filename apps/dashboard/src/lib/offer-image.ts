/**
 * WHERE a surface gets an offer's image, when all it holds is an offer id.
 *
 * The offer's own row (brand-service) carries the image. Three surfaces already
 * read that row and can pass it straight to `OfferMark` — the top bar
 * (`getBrandOffer`), the tenant switcher and the Offers table (`listBrandOffers`).
 * The lead surfaces cannot: lead-service serves an offer as `{offerId, name}`,
 * and it carries no image.
 *
 * Leaving those on the glyph would mean one offer wearing two different marks on
 * one screen, which is the coherence this repo keeps recording as a bug. So they
 * resolve the image from the brand's own offer LIST — a display lookup over a
 * query the tenant switcher already polls on every brand page (`["brandOffers",
 * brandId]`, `enabled: !!brandId`), so it dedupes to no request at all. It is a
 * lookup, never a derivation: nothing here computes or invents a value.
 *
 * An offer the list does not carry (created in another tab, or the list still in
 * flight) resolves to `null` and the mark keeps its glyph — the same reading as
 * an offer that has no image yet.
 */
export function offerImageLookup(
  offers: { offerId: string; imageUrl?: string | null }[] | undefined,
): (offerId: string | null | undefined) => string | null {
  const byId = new Map<string, string | null>();
  for (const o of offers ?? []) byId.set(o.offerId, o.imageUrl ?? null);
  return (offerId) => (offerId ? byId.get(offerId) ?? null : null);
}
