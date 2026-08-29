// Signing in lands on the DEEPEST scope that has no choice left in it.
//
// The walk is: the last brand opened in this org (the `last-brand-{orgId}` cookie the
// edge already reads), then that brand's offer if it sells exactly ONE, then that
// offer's sales funnel if it is sold through exactly ONE. Each step skips a page whose
// only content would be a list with a single row and a heading above it — the level
// exists because a brand CAN sell several propositions, not because every brand does.
//
// Why a MARKER param rather than "deepen whenever the bare URL is opened": a bare brand
// URL is where the sidebar's Offers entry, the offer crumb and every bookmark point, and
// a page that redirects away from itself is a page nobody can reach. So the deepening is
// gated on this marker, which only the org-landing resolution sets — the edge redirect in
// `proxy.ts` and the client fallback on the org page. Everything else lands exactly where
// it points. `?view=overview` needs no special case: the edge skips the last-brand
// redirect entirely when it is present, so the marker is never appended alongside it.
//
// Dependency-free (no next/*, no react) so the edge runtime, the browser bundle and the
// unit tests can all import it. Keep it that way.

/** Marks a URL as still being RESOLVED down the hierarchy, not as a destination. */
export const LANDING_PARAM = "land";
const LANDING_VALUE = "1";

/** Append the marker to a path, preserving any query it already carries. */
export function landingHref(pathname: string): string {
  const sep = pathname.includes("?") ? "&" : "?";
  return `${pathname}${sep}${LANDING_PARAM}=${LANDING_VALUE}`;
}

/**
 * How long a landing may wait for the answer before it stops walking and renders where
 * it stands. Sized to cover the per-query persister's IndexedDB restore (local, a tick
 * after mount) and NOT a cold features-service round trip (seconds).
 */
export const LANDING_RESOLVE_BUDGET_MS = 600;

export function hasLandingIntent(
  searchParams: Pick<URLSearchParams, "get">,
): boolean {
  return searchParams.get(LANDING_PARAM) === LANDING_VALUE;
}

/**
 * The one child to drill into, or null to stop here.
 *
 * `null` covers three genuinely different situations that all mean "this page is the
 * destination": nothing to drill into, and a real choice to make. Counting is the whole
 * rule — a list of one has no decision in it, a list of two or more does.
 *
 * Callers pass the rows the page WOULD RENDER, so skipping a page can never hide a row
 * from the reader.
 */
export function soleChildId<T>(
  rows: ReadonlyArray<T> | undefined,
  idOf: (row: T) => string,
): string | null {
  if (!rows || rows.length !== 1) return null;
  const id = idOf(rows[0]);
  return id ? id : null;
}

/** `/orgs/:orgId/brands/:brandId/offers/:offerId`, still resolving. */
export function landingOfferHref(brandPath: string, offerId: string): string {
  return landingHref(`${brandPath}/offers/${encodeURIComponent(offerId)}`);
}

/**
 * `/orgs/:orgId/brands/:brandId/offers/:offerId/funnels/:funnelKey` — the end of the
 * walk, so it carries NO marker: a funnel sells through legs, and a leg is worked by
 * whoever performs it rather than being a level with a single obvious child.
 */
export function landingFunnelHref(offerPath: string, funnelKey: string): string {
  return `${offerPath}/funnels/${encodeURIComponent(funnelKey)}`;
}
