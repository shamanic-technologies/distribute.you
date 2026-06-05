"use client";

import { useParams } from "next/navigation";
import { useFeatureFlag } from "@/lib/use-feature-flag";
import { FEATURE_GATES } from "@/lib/feature-gates";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";

/** Revenue-centric overview for a feature — its own page + sidebar entry (above
 *  Campaigns), revenue features only (sales-cold-email today), alpha / staff-only. */
export default function FeatureOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;
  const ok = useFeatureFlag(FEATURE_GATES["conversions"].flag);

  if (!ok || !isRevenueFeature(featureSlug)) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <RevenueOverviewSection orgId={orgId} brandId={brandId} featureSlug={featureSlug} />
    </div>
  );
}
