// Where the end of onboarding drops the customer.
//
// A signed-in landing walks DOWN the hierarchy until nothing is left to choose
// (`lib/landing-drilldown.ts`): the brand, then its offer if it sells exactly one — the
// end of the walk. The end of onboarding wants the same destination and does NOT need
// the walk to find it — the launch just created that offer's campaign, so it holds the
// answer already and can name the offer outright.
//
// That matters beyond elegance: the walk counts rows it reads from brand-service, and
// this navigation happens on a cache that was never warmed for this org (onboarding
// runs on its own in-memory query client, so nothing it fetched survives the push).
// A cold read over that path routinely outlasts the walk's own budget, which would
// land the customer on the brand Overview — the level they have no choice to make at.
//
// Degrades by NAMING LESS, never by guessing: a launch that could not name the brand's
// offer (several offers, or a read that failed) hands the landing to the walk with the
// marker instead, which is exactly what signing in does.
//
// Only relative value imports live here, so this module stays directly unit-testable
// (vitest does not resolve the "@" alias). Keep it that way.

import { landingHref } from "./landing-drilldown";

/**
 * The deepest scope this launch can name, as a path.
 *
 * - offer -> the offer page, with NO marker: it is the end of the walk, so there is
 *   nothing left for a landing to resolve.
 * - none -> the brand page WITH the marker, i.e. the plain sign-in landing.
 */
export function launchDestinationHref({
  orgId,
  brandId,
  offerId,
}: {
  orgId: string;
  brandId: string;
  offerId: string | null;
}): string {
  const brandPath = `/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}`;
  if (!offerId) return landingHref(brandPath);
  return `${brandPath}/offers/${encodeURIComponent(offerId)}`;
}
