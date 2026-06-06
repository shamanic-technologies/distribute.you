"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useFeatureFlag } from "@/lib/use-feature-flag";
import { FEATURE_GATES } from "@/lib/feature-gates";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { getFeatureRevenue, getBrandCostBreakdown } from "@/lib/api";
import { pollOptions, pollOptionsSlow } from "@/lib/query-options";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { RevenueEmptyState } from "@/components/revenue/revenue-empty-state";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";

/** Revenue-centric overview for a feature — its own page + sidebar entry (above
 *  Campaigns), revenue features only (sales-cold-email today), alpha / staff-only. */
export default function FeatureOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;
  const ok = useFeatureFlag(FEATURE_GATES["conversions"].flag);
  const enabled = ok && isRevenueFeature(featureSlug);

  const { data } = useAuthQuery(
    ["featureRevenue", brandId, featureSlug],
    () => getFeatureRevenue(featureSlug, brandId),
    { enabled, ...pollOptionsSlow },
  );

  // Cost breakdown (runs-service) → total spend + top-3 provider sources for the
  // Cost & efficiency card. Shares the Campaigns page's query key AND its 5s poll
  // cadence (`pollOptions`) — without the poll this query fetched once on mount and
  // froze, so an actively-spending campaign drifted the source mix here while the
  // Campaigns donut (which polls) stayed live → the two showed different %s. Both
  // polling means both observers refetch the shared cache entry together → always
  // identical. (`total` = actual + provisioned, so provisioned holds churn live.)
  const { data: costData } = useAuthQuery(
    ["brandCostBreakdown", { brandId, featureSlug }],
    () => getBrandCostBreakdown(brandId, { featureSlug }),
    { enabled, ...pollOptions },
  );

  // Coordinate the two cold queries: the section's static shell (header, card
  // frames, titles, tab bar) renders immediately; the data regions (headline,
  // chart, cost values, tables) reveal together once both resolve, then latch.
  const valuesRevealed = useCoordinatedReveal([data !== undefined, costData !== undefined]);

  if (!ok || !isRevenueFeature(featureSlug)) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`;

  // Only once resolved do we know the feature has no pipeline yet → full CTA.
  if (valuesRevealed && data && data.totalPipelineUsd === null) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <RevenueEmptyState setupHref={`${basePath}/campaigns/new`} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <RevenueOverviewSection
        data={valuesRevealed ? data : undefined}
        pending={!valuesRevealed}
        newCampaignHref={`${basePath}/campaigns/new`}
        costBreakdown={costData?.costs ?? []}
      />
    </div>
  );
}
