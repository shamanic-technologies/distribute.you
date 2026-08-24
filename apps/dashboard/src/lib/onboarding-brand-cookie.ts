/**
 * The brand an unfinished onboarding is building, in a SERVER-READABLE cookie.
 *
 * WHY THIS EXISTS. The wizard keeps its progress in `sessionStorage`, which the
 * browser discards when the tab closes. `onboardingComplete` is only written at
 * the terminal launch (after the campaign is created), so a user who leaves
 * mid-flow still fails the edge gate in `proxy.ts` on their next visit — and that
 * gate redirected to a bare `/onboarding`, with no snapshot and no brand, so the
 * flow started at the welcome screen. Everything they had typed was still in
 * brand-service; the flow simply had no way to know which brand to re-hydrate.
 *
 * The cross-session resume it needs ALREADY EXISTS: `/onboarding?brandId=<id>`
 * fetches the brand, seeds the URL, replays the loading-screen hydration and
 * lands on the funnels step with services / funnels / rates / lifetime revenue
 * pre-filled. It was only reachable from `BrandSetupGate`, which fires for an org
 * that is ALREADY `onboardingComplete` (the add-a-second-brand case) — so the
 * one path that recovers a half-finished signup could never serve a first
 * signup. This cookie is what makes the edge gate able to name the brand.
 *
 * A cookie and not client storage: the redirect happens at the EDGE, pre-paint,
 * and the edge can read nothing else. Same doctrine as `last-brand-{orgId}` and
 * the tenant-identity blob — remembered state that a SERVER has to act on goes
 * in a cookie.
 *
 * Deliberately NOT httpOnly: the client is what creates the brand, so the client
 * is what writes this. The value is a brand id the URL carries a moment later.
 * No token, nothing the user cannot already see.
 *
 * SCOPED BY ORG, like `last-brand-{orgId}`. Onboarding can create a brand-new org
 * (`?new=1`), so an unscoped cookie would let a brand abandoned under org A
 * resume itself inside org B — landing the user on a brand that is not the one
 * they came to create.
 *
 * This module is import-alias-free on purpose so vitest can run it directly (the
 * `@` alias is not resolved in this repo — see CLAUDE.md).
 */

/**
 * A week. An abandoned onboarding older than that is better restarted than
 * resumed: the brand's extracted fields have gone stale and the person has most
 * likely forgotten what they picked. The cookie is deleted at launch, so this
 * only ever bounds the abandoned case.
 */
export const ONBOARDING_BRAND_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** The query param the onboarding flow already reads for a cross-session resume. */
export const ONBOARDING_BRAND_PARAM = "brandId";

/**
 * Cookie naming the brand an unfinished onboarding is building in a given org.
 * Org-scoped so a brand abandoned in one org can never resume inside another.
 */
export function onboardingBrandCookieName(orgId: string): string {
  return `onboarding-brand-${orgId}`;
}

/**
 * Where the edge gate sends a user whose onboarding is unfinished and whose
 * in-progress brand we know. The flow's own param-resume effect takes it from
 * here (fetch the brand, replay hydration, land on the funnels step).
 */
export function onboardingResumeHref(brandId: string): string {
  return `/onboarding?${ONBOARDING_BRAND_PARAM}=${encodeURIComponent(brandId)}`;
}

/**
 * `document.cookie` assignment remembering the brand this onboarding is building.
 * Pure string, so it carries real unit tests; the caller does the assignment
 * (same split as `tenantIdentityCookieAssignment`).
 */
export function onboardingBrandCookieAssignment(
  orgId: string,
  brandId: string,
): string {
  return [
    `${onboardingBrandCookieName(orgId)}=${encodeURIComponent(brandId)}`,
    "path=/",
    `max-age=${ONBOARDING_BRAND_MAX_AGE_SECONDS}`,
    "samesite=lax",
  ].join("; ");
}

