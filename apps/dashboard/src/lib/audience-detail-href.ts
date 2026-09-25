import { tenantBasePath } from "./offer-path";

/**
 * Where the lead panel's audience card opens the audience, AT THE GRAIN THE
 * READER IS STANDING ON.
 *
 * The Leads page renders at three grains and each of the two offer-scoped ones
 * has its own Audiences page:
 *
 *   /brands/:b/leads                        -> (no brand Audiences page exists)
 *   /offers/:o/audiences/leads              -> /offers/:o/audiences
 *   /offers/:o/campaigns/:id/leads          -> /offers/:o/campaigns/:id/audiences
 *
 * Both render `CustomerAudiencesPage`, which reads the `?audienceId=` seed
 * on first paint, so the detail panel opens whichever one the link names. The
 * card used to name the OFFER one from every grain, so opening an audience from
 * a campaign's Leads page kicked the reader out of the campaign. `top-audiences-card.tsx` already grain-matches for
 * campaigns; this is the same rule, in one place both panel surfaces read — two
 * copies of the expression is how they came to differ from that card.
 *
 * ⚠️ THE DEEPER GRAIN ONLY APPLIES WHEN THE AUDIENCE'S OWN OFFER IS THE ROUTE'S.
 * A link to an ENTITY is built from where that entity lives (#3514): an audience
 * belongs to the offer it was assembled for, and a campaign page under a
 * DIFFERENT offer would not list it. So a mismatch falls back to the audience's
 * own offer's Audiences page — the pre-existing behaviour, which is correct
 * there. The route's offer stays the fallback for an audience that names none
 * (some predate the offer level), and no offer resolvable at all means NO link
 * rather than one pointing at a 404.
 *
 * Only relative value imports live here, so this module carries real unit tests
 * (vitest does not resolve the "@" alias).
 */
export function audienceDetailHref({
  orgId,
  brandId,
  audienceId,
  audienceOfferId,
  routeOfferId,
  campaignId,
}: {
  orgId: string;
  brandId: string;
  audienceId: string;
  /** The audience's own offer, as human-service serves it (required + nullable). */
  audienceOfferId?: string | null;
  /** The `/offers/:offerId` segment of the current route, absent on the brand one. */
  routeOfferId?: string | null;
  /** The `/campaigns/:id` segment, present only on a campaign route. */
  campaignId?: string | null;
}): string | null {
  const routeOffer = nonEmpty(routeOfferId);
  const offerId = nonEmpty(audienceOfferId) ?? routeOffer;
  if (!offerId) return null;

  const base = tenantBasePath(orgId, brandId, offerId);
  // The deeper page lives UNDER the route's offer, so it can only hold an
  // audience that belongs to that same offer.
  const sameOffer = routeOffer !== null && routeOffer === offerId;
  const scoped = sameOffer ? scopeSegment(campaignId) : "";
  return `${base}${scoped}/audiences?audienceId=${encodeURIComponent(audienceId)}`;
}

/** The campaign segment the route names, or nothing. */
function scopeSegment(campaignId?: string | null): string {
  const campaign = nonEmpty(campaignId);
  return campaign ? `/campaigns/${encodeURIComponent(campaign)}` : "";
}

function nonEmpty(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
