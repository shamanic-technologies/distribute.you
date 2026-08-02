import { Suspense } from "react";
import { InvestorDeckView } from "@/components/investors/investor-deck-view";
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";
import { fetchPublicStatsSummary } from "@/lib/public-stats";

export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * The signup timeline needs the admin key, so it is fetched server-side. It fans
 * out to PostHog, Clerk and Stripe, which is slow enough that awaiting it in the
 * page body held the whole navigation: the route could not commit until the fan
 * out returned, so clicking this entry in the sidebar did nothing at all for
 * seconds while the previous page stayed on screen.
 *
 * Suspending it moves that wait behind the boundary. The route commits at once,
 * the skeleton paints, and the deck arrives when the data does.
 */
async function DeckWithStats() {
  const stats = await fetchPublicStatsSummary("signups");
  return <InvestorDeckView timeline={stats.timeline} />;
}

export default function InvestorDeckPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <DeckWithStats />
    </Suspense>
  );
}
