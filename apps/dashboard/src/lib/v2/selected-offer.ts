/**
 * Which ONE offer the v2 dashboard is about (owner 2026-10-03): the sidebar's switcher
 * picks an offer under the brand, and every page then reads that offer only. No page
 * states a brand-wide total any more, on purpose.
 *
 * The pick is remembered per brand in a cookie the browser writes, the way the last
 * brand is remembered per org. Alias-free so it carries real unit tests.
 */

export interface OfferLike {
  offerId: string;
}

export function selectedOfferCookieName(brandId: string): string {
  return `distribute-offer-${brandId}`;
}

/** The stored pick, read off a `document.cookie` string. */
export function readSelectedOfferCookie(cookie: string, brandId: string): string | null {
  const name = `${selectedOfferCookieName(brandId)}=`;
  for (const part of cookie.split(";")) {
    const p = part.trim();
    if (p.startsWith(name)) {
      const v = decodeURIComponent(p.slice(name.length));
      return v || null;
    }
  }
  return null;
}

/** A year, path-wide, readable by the page that wrote it. */
export function selectedOfferCookie(brandId: string, offerId: string): string {
  return `${selectedOfferCookieName(brandId)}=${encodeURIComponent(offerId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * The offer the dashboard reads, in order: the one the URL names (an offer's own page, or
 * the offer a mission sells), else the stored pick while it is still one of the brand's
 * live offers, else the brand's first offer. Null only when the brand has no offer.
 */
export function pickSelectedOffer<T extends OfferLike>(
  offers: readonly T[],
  { fromUrl, stored }: { fromUrl: string | null; stored: string | null },
): string | null {
  if (fromUrl) return fromUrl;
  if (stored && offers.some((o) => o.offerId === stored)) return stored;
  return offers[0]?.offerId ?? null;
}
