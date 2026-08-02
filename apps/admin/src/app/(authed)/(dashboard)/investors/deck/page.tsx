import { InvestorDeckView } from "@/components/investors/investor-deck-view";
import { fetchPublicStatsSummary } from "@/lib/public-stats";

// Same posture as the metrics page: the public-stats summary is fetched
// server-side (it needs the admin key), the live fleet figures are read
// client-side through the gateway.
export const dynamic = "force-dynamic";
export const revalidate = 300;

export default async function InvestorDeckPage() {
  const stats = await fetchPublicStatsSummary("signups");
  return <InvestorDeckView timeline={stats.timeline} />;
}
