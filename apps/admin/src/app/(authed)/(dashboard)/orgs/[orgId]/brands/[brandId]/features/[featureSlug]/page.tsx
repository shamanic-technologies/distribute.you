"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { Skeleton } from "@/components/skeleton";

/**
 * Feature landing → default sub-tab redirect.
 *
 * The bare feature URL is not a page itself; it picks the right default tab:
 *   - revenue feature (sales-cold-email) → Overview (GA)
 *   - everyone else → Campaigns (the list now lives at `/campaigns`)
 */
export default function FeatureIndexPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;
  const base = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`;

  useEffect(() => {
    router.replace(
      isRevenueFeature(featureSlug) ? `${base}/overview` : `${base}/campaigns`,
    );
  }, [base, featureSlug, router]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <Skeleton className="h-6 w-40 rounded" />
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
