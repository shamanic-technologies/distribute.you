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
import { Skeleton } from "@/components/skeleton";

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-56 rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <Skeleton className="h-5 w-48 rounded mb-4" />
          <Skeleton className="h-[260px] w-full rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-6 w-12 rounded mt-2" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

/** Revenue-centric overview for a feature — its own page + sidebar entry (above
 *  Campaigns), revenue features only (sales-cold-email today), alpha / staff-only. */
export default function FeatureOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;
  const ok = useFeatureFlag(FEATURE_GATES["conversions"].flag);
  const enabled = ok && isRevenueFeature(featureSlug);

  const { data, isPending } = useAuthQuery(
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
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {isPending || !data ? (
        <OverviewSkeleton />
      ) : data.totalPipelineUsd === null ? (
        <RevenueEmptyState setupHref={`${basePath}/campaigns/new`} />
      ) : (
        <RevenueOverviewSection
          data={data}
          conversionsHref={`${basePath}/conversions`}
          costBreakdown={costData?.costs ?? []}
        />
      )}
    </div>
  );
}
