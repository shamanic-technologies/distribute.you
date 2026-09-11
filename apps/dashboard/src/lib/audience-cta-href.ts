import { tenantBasePath } from "./offer-path";
import { soleOfferId, type OfferIdentity } from "./launch-offer";

/**
 * Where "Add an audience" / "Extend audience" actually goes.
 *
 * An audience belongs to an OFFER — the proposition it was assembled to sell —
 * so its page lives at `/orgs/:orgId/brands/:brandId/offers/:offerId/audiences`.
 * The two onboarding nudges (the red blocker banner and the reminder modal) are
 * mounted on the dashboard shell, which is brand-scoped, and both built their
 * CTA as `/orgs/:orgId/brands/:brandId/audiences` — a path that does not exist.
 * So the one affordance on a banner whose whole job is to unblock outreach was a
 * 404, at every grain, including the offer and funnel routes whose own URL
 * already names the offer.
 *
 * Same failure as the lead panel's audience card (`lead-campaign-sections.tsx`):
 * a link to an ENTITY is built from where that entity lives, never from the
 * route the reader happens to be standing on.
 *
 * Resolution, in order:
 *   1. the ROUTE's own offer, present under `/offers/:offerId` (offer, funnel and
 *      campaign routes all carry it) — the reader already picked that offer;
 *   2. the brand's SOLE offer, when it has exactly one, so a brand-level reader
 *      still lands on the page rather than one hop short of it;
 *   3. the brand Overview, whose Offers table is where a reader picks.
 *
 * Step 3 covers both "no offers" and "several offers", which are one answer: we
 * do not know which proposition they mean, and guessing sends them to audiences
 * for something they never picked. It is never a dead link and never a 404 —
 * this CTA is the only way out of a hard blocker, so dropping it is not an
 * option the way it is on a row that can simply state a name.
 *
 * Only relative value imports live here, so this module carries real unit tests
 * (vitest does not resolve the "@" alias).
 */
export function audienceCtaHref({
  orgId,
  brandId,
  routeOfferId,
  offers,
}: {
  orgId: string;
  brandId: string;
  /** The `/offers/:offerId` segment of the current route, when there is one. */
  routeOfferId?: string | null;
  /**
   * The brand's offers. `undefined` while the read is in flight or failed — the
   * link then rests on the route's own offer, and falls back to the brand path,
   * which is a real page either way.
   */
  offers?: readonly OfferIdentity[];
}): string {
  const routed = routeOfferId?.trim();
  const offerId = (routed && routed.length > 0 ? routed : null) ?? (offers ? soleOfferId(offers) : null);
  const base = tenantBasePath(orgId, brandId, offerId);
  return offerId ? `${base}/audiences` : base;
}
