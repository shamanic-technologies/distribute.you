// "Land on last-visited brand" — pure helpers shared by the edge middleware
// (proxy.ts) and the org landing page client fallback. Dependency-free: no
// next/server, no react, so both the edge runtime and the browser bundle can
// import it.
//
// Strategy (CLAUDE.md: "routing decisions belong at the EDGE … a client
// useEffect + push after a fetch is the flash anti-pattern"): the last brand a
// user opened in an org is remembered in an org-scoped httpOnly cookie, written
// by the middleware when it sees a brand URL go by. On a bare `/orgs/:orgId`
// request the middleware reads that cookie and redirects pre-paint — zero
// flash, zero data fetch. The destination brand page owns the stale-cookie
// (brand later deleted) fallback, mirroring Clerk's invalid-active-org pattern
// (it leaves the target unchanged and the page renders a recovery UI).

/** Cookie remembering the last brand opened in a given org. Org-scoped so an
 *  org switch never reads the previous tenant's brand. */
export function lastBrandCookieName(orgId: string): string {
  return `last-brand-${orgId}`;
}

const ORG_LANDING_RE = /^\/orgs\/([^/]+)\/?$/;
const BRAND_PATH_RE = /^\/orgs\/([^/]+)\/brands\/([^/]+)(?:\/.*)?$/;

/** Match the bare org landing URL `/orgs/:orgId` (no trailing path segments).
 *  Sub-routes like `/orgs/:orgId/brands` stay reachable (no match → no
 *  redirect). */
export function matchOrgLanding(pathname: string): { orgId: string } | null {
  const m = ORG_LANDING_RE.exec(pathname);
  return m ? { orgId: m[1] } : null;
}

/** Match any brand URL `/orgs/:orgId/brands/:brandId` (with or without a
 *  trailing sub-route) so navigating deep inside a brand still refreshes the
 *  remembered brand. The bare brand list `/orgs/:orgId/brands` does NOT match. */
export function matchBrandPath(
  pathname: string,
): { orgId: string; brandId: string } | null {
  const m = BRAND_PATH_RE.exec(pathname);
  return m ? { orgId: m[1], brandId: m[2] } : null;
}

/**
 * Resolve which brand the bare org URL should land on, given the org's brands
 * and the last-visited brand id (cookie value, or null when absent). Pure.
 *   1. last-visited brand still exists → it
 *   2. else the org has >= 1 brand      → the first brand (decision B)
 *   3. else (no brands)                 → null (the onboarding gate owns this)
 */
export function resolveLandingBrand(
  brands: ReadonlyArray<{ id: string }>,
  lastBrandId: string | null,
): string | null {
  if (lastBrandId && brands.some((b) => b.id === lastBrandId)) return lastBrandId;
  return brands[0]?.id ?? null;
}

/**
 * One step deeper than `resolveLandingBrand`: once the user lands on a brand,
 * skip the brand overview straight into the feature when the brand has exactly
 * ONE feature to act on (public release ships a single GA feature, so the
 * overview is a pass-through with no real choice). Pure — wired into the brand
 * overview page, which already fetches both inputs.
 *
 * @param gaImplementedFeatures the GA + implemented features visible to ALL
 *   viewers (caller filters on `f.implemented && GA_BRAND_FEATURES.has(slug)`,
 *   NOT the alpha-gated viewer-visible set — that depends on a PostHog flag that
 *   may not have resolved at redirect time, which would flash). When a 2nd
 *   feature ships GA this is length 2 → returns null → the overview renders
 *   again, no code change needed.
 * @param campaigns the brand's campaigns (across features).
 *
 * Returns:
 *   - exactly 1 GA feature → its slug + whether it still needs a first campaign
 *     (no campaign references that slug → `needsCampaign: true` → route to the
 *     Create Campaign page; else route to the feature).
 *   - 0 or 2+ GA features → null (let the overview render; nothing to skip to).
 */
export function resolveFeatureLanding(
  gaImplementedFeatures: ReadonlyArray<{ slug: string }>,
  campaigns: ReadonlyArray<{ featureSlug?: string | null }>,
): { featureSlug: string; needsCampaign: boolean } | null {
  if (gaImplementedFeatures.length !== 1) return null;
  const featureSlug = gaImplementedFeatures[0].slug;
  const needsCampaign = !campaigns.some((c) => c.featureSlug === featureSlug);
  return { featureSlug, needsCampaign };
}
