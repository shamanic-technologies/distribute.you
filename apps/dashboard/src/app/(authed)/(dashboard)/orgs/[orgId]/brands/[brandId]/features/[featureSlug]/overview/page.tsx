"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useFeatureFlag } from "@/lib/use-feature-flag";
import { FEATURE_GATES } from "@/lib/feature-gates";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { getFeatureRevenue } from "@/lib/api";
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
    { enabled },
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
        <RevenueOverviewSection data={data} conversionsHref={`${basePath}/conversions`} />
      )}
    </div>
  );
}
