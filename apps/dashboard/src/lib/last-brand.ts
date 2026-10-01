// "Land on last-visited brand" — pure helpers shared by the edge middleware
// (proxy.ts) and the v2 org page. Dependency-free: no next/server, no react, so
// both the edge runtime and the browser bundle can import it.
//
// Strategy (CLAUDE.md: "routing decisions belong at the EDGE … a client
// useEffect + push after a fetch is the flash anti-pattern"): the last brand a
// user opened in an org is remembered in an org-scoped httpOnly cookie, written
// by the middleware when it sees a brand URL go by (v1 or v2). The v2 org page
// (`/v2/orgs/:orgId`) reads it server-side and redirects to that brand.

/** Cookie remembering the last brand opened in a given org. Org-scoped so an
 *  org switch never reads the previous tenant's brand. */
export function lastBrandCookieName(orgId: string): string {
  return `last-brand-${orgId}`;
}

export const HIERARCHY_VIEW_PARAM = "view";
export const HIERARCHY_VIEW_OVERVIEW = "overview";

export function explicitHierarchyHref(pathname: string): string {
  const sep = pathname.includes("?") ? "&" : "?";
  return `${pathname}${sep}${HIERARCHY_VIEW_PARAM}=${HIERARCHY_VIEW_OVERVIEW}`;
}

const BRAND_PATH_RE = /^\/orgs\/([^/]+)\/brands\/([^/]+)(?:\/.*)?$/;

/** Match any brand URL `/orgs/:orgId/brands/:brandId` (with or without a
 *  trailing sub-route) so navigating deep inside a brand still refreshes the
 *  remembered brand. The bare brand list `/orgs/:orgId/brands` does NOT match. */
export function matchBrandPath(
  pathname: string,
): { orgId: string; brandId: string } | null {
  const m = BRAND_PATH_RE.exec(pathname);
  return m ? { orgId: m[1], brandId: m[2] } : null;
}

// A bare brand URL always lands on the brand Overview. The product ships one
// primary feature at the brand level, so there's no "skip into the feature /
// route to create-campaign" decision to make — the Overview is the home. (The old
// `resolveFeatureLanding` campaign branch was removed when the campaign concept
// was hidden from the UI.)
