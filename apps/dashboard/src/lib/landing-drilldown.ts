// Signing in lands on the DEEPEST scope that has no choice left in it.
//
// The walk is: the last brand opened in this org (the `last-brand-{orgId}` cookie the
// edge already reads), then that brand's offer if it sells exactly ONE — the end of the
// walk, since an offer's page states its outcomes rather than a list of children. The
// step skips a page whose
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

