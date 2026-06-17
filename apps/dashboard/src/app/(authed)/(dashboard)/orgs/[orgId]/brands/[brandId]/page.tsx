"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getBrand, getFeatureRevenue, getBrandCostBreakdown, fetchFeatureStats, getBrandSalesEconomics, getFeaturePipelineActivity } from "@/lib/api";
import { pollOptions, pollOptionsSlow } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { RevenueEmptyState } from "@/components/revenue/revenue-empty-state";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { BrandStatusControl } from "@/components/brand/brand-status-control";
import { DashboardPage } from "@/components/dashboard-page";
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
  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

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

  const { data: pipelineActivity } = useAuthQuery(
    ["featurePipelineActivity", brandId, featureSlug, timezone],
    () => getFeaturePipelineActivity(featureSlug, { brandId, days: 7, timezone }),
    { enabled, ...pollOptions },
  );

  // Cost breakdown (runs-service) → total spend + top-3 provider sources for the
  // Cost & efficiency card. Shares the Campaigns page's query key + 5s cadence so
  // both observers refetch the shared cache entry together (identical source mix).
  const { data: costData } = useAuthQuery(
    ["brandCostBreakdown", { brandId, featureSlug }],
    () => getBrandCostBreakdown(brandId, { featureSlug }),
    { enabled, ...pollOptions },
  );

  // Feature-level stats (Impressions / Clicks / CPC cards). Shares the Campaigns
  // page's query key + 5s cadence so both observers refetch one cache entry.
  const { data: featureStatsData } = useAuthQuery(
    ["featureStats", featureSlug, brandId],
    () => fetchFeatureStats(featureSlug, { brandId }),
    { enabled, ...pollOptions },
  );
  const featureStats = featureStatsData?.stats ?? {};
  const totalCostCents = featureStatsData?.systemStats?.totalCostInUsdCents ?? 0;

  // Brand goal config → goal-specific stat card copy.
  const { data: economicsData } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
    { enabled, ...pollOptions },
  );
  const optimizationGoal =
    economicsData?.salesEconomics?.optimizationGoal ?? "sales_meetings";

  // Per-card reveal (NOT one page-wide barrier): revenue (features-service) and
  // total-spend (runs-service) are two different cold chains — gate each on its
  // own query so the fast cost card isn't held by the slower revenue call.
  const revenueRevealed = useCoordinatedReveal([data !== undefined]);
  const activityRevealed = useCoordinatedReveal([pipelineActivity !== undefined]);
  const costRevealed = useCoordinatedReveal([costData !== undefined]);
  const statsRevealed = useCoordinatedReveal([featureStatsData !== undefined]);

  const basePath = `/orgs/${orgId}/brands/${brandId}`;

  if (!brandLoading && !brand) {
    // Reached e.g. via a stale last-brand cookie pointing at a deleted brand.
    return (
      <DashboardPage width="wide">
        <p className="text-gray-500 mb-3">Brand not found</p>
        <Link
          href={`/orgs/${orgId}/brands`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← Back to brands
        </Link>
      </DashboardPage>
    );
  }

  if (!enabled) {
    return (
      <DashboardPage width="wide">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </DashboardPage>
    );
  }

  // Only once revenue resolves do we know the brand has no pipeline yet.
  if (revenueRevealed && data && data.totalPipelineUsd === null) {
    return (
      <DashboardPage width="wide" className="space-y-4">
        <BrandStatusControl brandId={brandId} />
        <RevenueEmptyState />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage width="wide" className="space-y-4">
      <RevenueOverviewSection
        data={revenueRevealed ? data : undefined}
        pipelineActivity={activityRevealed ? pipelineActivity : undefined}
        revenuePending={!revenueRevealed}
        activityPending={!activityRevealed}
        costPending={!costRevealed}
        costBreakdown={costData?.costs ?? []}
        brandId={brandId}
        featureSlug={featureSlug}
        basePath={basePath}
        headerAction={<BrandStatusControl brandId={brandId} />}
        topRow={
          /* Outreach stat cards (GA + beta) — under the "Revenue & Conversions"
             header, directly above the Pipeline-revenue hero. Goal-specific copy
             and beta outcome pair. */
          <OutreachStatCards
            stats={featureStats}
            totalCostCents={totalCostCents}
            pending={!statsRevealed}
            optimizationGoal={optimizationGoal}
          />
        }
      />
    </DashboardPage>
  );
}
