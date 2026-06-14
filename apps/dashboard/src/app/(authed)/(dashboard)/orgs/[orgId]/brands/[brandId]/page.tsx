"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrand, getFeatureRevenue, getBrandCostBreakdown } from "@/lib/api";
import { pollOptions, pollOptionsSlow } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { RevenueEmptyState } from "@/components/revenue/revenue-empty-state";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";

/**
 * Brand overview = the (sole) feature's Revenue & Conversions overview, rendered
 * inline at the brand root. The product ships ONE feature, so the feature level
 * was flattened into the brand — this replaces the old feature-grid + Ahrefs
 * metrics overview AND the redirect into `/features/[slug]/overview`. The
 * `?view=overview` hierarchy param is now a no-op (the brand root always shows
 * the overview).
 */
export default function BrandOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug);

  // isPending (not isLoading): a query suspended by the org-consistency gate
  // reports isLoading:false while still unresolved, which would flash "Brand
  // not found" during the org-settle window.
  const { data: brandData, isPending: brandLoading } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
    pollOptions,
  );
  const brand = brandData?.brand ?? null;

  const { data } = useAuthQuery(
    ["featureRevenue", brandId, featureSlug],
    () => getFeatureRevenue(featureSlug, brandId),
    { enabled, ...pollOptionsSlow },
  );

  // Cost breakdown (runs-service) → total spend + top-3 provider sources for the
  // Cost & efficiency card. Shares the Campaigns page's query key + 5s cadence so
  // both observers refetch the shared cache entry together (identical source mix).
  const { data: costData } = useAuthQuery(
    ["brandCostBreakdown", { brandId, featureSlug }],
    () => getBrandCostBreakdown(brandId, { featureSlug }),
    { enabled, ...pollOptions },
  );

  // Per-card reveal (NOT one page-wide barrier): revenue (features-service) and
  // total-spend (runs-service) are two different cold chains — gate each on its
  // own query so the fast cost card isn't held by the slower revenue call.
  const revenueRevealed = useCoordinatedReveal([data !== undefined]);
  const costRevealed = useCoordinatedReveal([costData !== undefined]);

  const basePath = `/orgs/${orgId}/brands/${brandId}`;

  if (!brandLoading && !brand) {
    // Reached e.g. via a stale last-brand cookie pointing at a deleted brand.
    return (
      <div className="p-4 md:p-8">
        <p className="text-gray-500 mb-3">Brand not found</p>
        <Link
          href={`/orgs/${orgId}/brands`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← Back to brands
        </Link>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </div>
    );
  }

  // Only once revenue resolves do we know the brand has no pipeline yet → full CTA.
  if (revenueRevealed && data && data.totalPipelineUsd === null) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <RevenueEmptyState setupHref={`${basePath}/campaigns/new`} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <RevenueOverviewSection
        data={revenueRevealed ? data : undefined}
        revenuePending={!revenueRevealed}
        costPending={!costRevealed}
        newCampaignHref={`${basePath}/campaigns/new`}
        costBreakdown={costData?.costs ?? []}
        brandId={brandId}
        featureSlug={featureSlug}
        basePath={basePath}
      />
    </div>
  );
}
