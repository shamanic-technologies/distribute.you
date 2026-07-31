// Public share link for one brand — pure helpers, no `@` imports, so this file
// is runtime-importable by vitest and carries real unit tests rather than
// source-substring guards.
//
// brand-service returns the raw credential and NOT a URL: it does not know where
// the public page lives, and baking a consumer's hostname into a producer
// response is how one service ends up owning another's routing. Composing the
// URL is therefore the dashboard's job, and it happens HERE, once — a second
// copy of this concatenation is how the share menu and the page it opens end up
// disagreeing about where the link points.

/** Path segment the public brand view is served under. */
export const BRAND_SHARE_PATH = "/share";

/**
 * The link to hand out for a credential.
 *
 * `origin` is passed in rather than read from `window`, so the same function
 * serves a client component and a server render. A blank token yields null —
 * "not shared" and "shared at /share/" are different statements, and the second
 * one is a URL that opens nothing.
 */
export function brandShareUrl(origin: string, token: string | null): string | null {
  if (!token || token.trim() === "") return null;
  const base = origin.replace(/\/+$/, "");
  return `${base}${BRAND_SHARE_PATH}/${encodeURIComponent(token)}`;
}

/**
 * True when the pathname is a brand route (`/orgs/:orgId/brands/:brandId`, with
 * or without a trailing sub-route).
 *
 * The share control is brand-scoped: the header renders on every page, and a
 * "share this brand" button on the billing page names nothing. Mirrors
 * `matchBrandPath` in `last-brand.ts`, which the edge middleware uses for the
 * same URL shape — kept separate only because that file is edge-runtime code and
 * this one is a display concern.
 */
const BRAND_ROUTE_RE = /^\/orgs\/([^/]+)\/brands\/([^/]+)(?:\/.*)?$/;

export function brandFromPathname(
  pathname: string | null | undefined,
): { orgId: string; brandId: string } | null {
  if (!pathname) return null;
  const m = BRAND_ROUTE_RE.exec(pathname);
  return m ? { orgId: m[1], brandId: m[2] } : null;
}
