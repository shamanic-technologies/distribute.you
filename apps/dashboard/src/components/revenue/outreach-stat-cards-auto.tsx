"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { fetchFeatureStats, getBrandSalesEconomics } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";

/**
 * Self-contained outreach stat-card row for every brand- and campaign-scoped
 * content page (leads, emails, journalists, outlets, articles, quote-pitches,
 * visibility-runs, …). Reads its scope from the route params — `id` present →
 * campaign-scoped stats, else brand-scoped — and fetches its own featureStats,
 * cost, and sales-economics funnel. All three queries reuse the same keys the
 * Overview/Campaigns pages use, so React Query dedupes to a single poll per
 * scope (no extra network cost on a page that already shows them).
 *
 * The dedicated Overview, Campaigns-list, and Campaign-detail surfaces wire
 * `OutreachStatCards` directly (they already hold the stats); this wrapper is for
 * the entity pages that otherwise carry no stats.
 */
export function OutreachStatCardsAuto() {
  const params = useParams();
  const brandId = params.brandId as string;
  const campaignId = params.id as string | undefined;
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug);

  const { data: featureStatsData } = useAuthQuery(
    campaignId
      ? ["featureStats", featureSlug, "campaign", campaignId]
      : ["featureStats", featureSlug, brandId],
    () =>
      fetchFeatureStats(featureSlug, campaignId ? { campaignId } : { brandId }),
    { enabled, ...pollOptions },
  );

  // Brand funnel config gates the Meetings/Signups beta pairs. Shares the brand
  // settings + campaign-creation query key → one fetch.
  const { data: economicsData } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
    { enabled, ...pollOptions },
  );

  const statsRevealed = useCoordinatedReveal([featureStatsData !== undefined]);

  if (!enabled) return null;

  const featureStats = featureStatsData?.stats ?? {};
  const totalCostCents = featureStatsData?.systemStats?.totalCostInUsdCents ?? 0;
  const funnelStages = economicsData?.salesEconomics?.funnelStages;

  return (
    <OutreachStatCards
      stats={featureStats}
      totalCostCents={totalCostCents}
      pending={!statsRevealed}
      funnelStages={funnelStages}
    />
  );
}
