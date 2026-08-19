/**
 * The URL shape of the tenant hierarchy, in ONE place.
 *
 * Org > Brand > Offer > Campaign, so an offer-scoped surface builds every in-app
 * link from `/orgs/:orgId/brands/:brandId/offers/:offerId`. Several components
 * were each assembling that string by hand, and inserting the offer segment is
 * exactly the kind of change that leaves one of them behind — pointing a link at a
 * route that no longer exists, which `tsc` cannot see.
 *
 * `offerId` is OPTIONAL because two surfaces legitimately have none: the brand
 * Overview itself, and the read-only `/share/<token>` mirror, which has no offer
 * segment. Omitting it returns the brand path, which is what those want.
 *
 * Alias-free (no `@/…` import), so it carries real unit tests rather than a
 * source-substring guard.
 */
export function tenantBasePath(
  orgId: string,
  brandId: string,
  offerId?: string | null,
): string {
  const brandPath = `/orgs/${orgId}/brands/${brandId}`;
  return offerId ? `${brandPath}/offers/${offerId}` : brandPath;
}
