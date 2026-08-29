import { LearningToneProvider } from "@/components/learning-tag";
import BrandOverviewPage from "@/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page";

/**
 * Offer Overview.
 *
 * The SAME component the brand root renders, which is deliberate and is the repo's
 * established pattern for a scoped surface (`CustomerAudiencesPage({ campaignId })`,
 * `EngagedLeadsPage({ campaignId })`): one page, an optional scope read off the
 * route, never a second copy that drifts. The component reads `offerId` from
 * `useParams()`, so mounting it here is what scopes every read to this offer and
 * swaps the brand's Offers list for this offer's campaigns and audiences.
 *
 * The tone is stated HERE rather than inside the component precisely because the
 * component is shared: an offer reads in the brand's PRIMARY, and a `tone` set in
 * `page.tsx` one level up would repaint the brand Overview with it. The campaigns
 * table inside keeps its own accent by construction — it states campaigns, so it
 * pins itself back to the tertiary wherever it is mounted.
 */
export default function OfferOverviewRoute() {
  return (
    <LearningToneProvider tone="primary">
      <BrandOverviewPage />
    </LearningToneProvider>
  );
}
