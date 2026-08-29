import BrandOverviewPage from "@/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page";

/**
 * Offer Overview.
 *
 * The SAME component the brand root renders, which is deliberate and is the repo's
 * established pattern for a scoped surface (`CustomerAudiencesPage({ campaignId })`,
 * `EngagedLeadsPage({ campaignId })`): one page, an optional scope read off the
 * route, never a second copy that drifts. The component reads `offerId` from
 * `useParams()`, so mounting it here is what scopes every read to this offer and
 * swaps the brand's Offers list for this offer's funnels and audiences.
 *
 * It states no Learning accent of its own: the component already reads in the brand's
 * PRIMARY, because the brand grain reads in it too and this file renders the brand
 * grain's own page — restating it here would say the same thing twice. The offer's
 * other three routes DO state one, since they mount components that are also mounted
 * at the brand and campaign grains, where the accent must not follow.
 */
export default function OfferOverviewRoute() {
  return <BrandOverviewPage />;
}
