/**
 * Offer Overview.
 *
 * The SAME component the brand root renders, which is deliberate and is the repo's
 * established pattern for a scoped surface (`CustomerAudiencesPage({ campaignId })`,
 * `EngagedLeadsPage({ campaignId })`): one page, an optional scope read off the
 * route, never a second copy that drifts. The component reads `offerId` from
 * `useParams()`, so mounting it here is what scopes every read to this offer and
 * swaps the brand's Offers list for this offer's campaigns and audiences.
 */
export { default } from "@/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page";
