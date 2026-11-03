"use client";

import { RevenueCostSummary } from "@/components/revenue/revenue-cost-summary";
import { ConversionsTabs } from "@/components/revenue/conversions-tabs";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { CostBreakdown } from "@/components/campaign/cost-breakdown";
import { CampaignBudgetCard } from "@/components/campaign/campaign-budget-card";
import type { Campaign, CostByName, FunnelStep, StatsRegistry } from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";

/**
 * Campaign-scoped revenue layout — mirrors the feature Overview (DIS-229): the
 * cost/budget stats column on top (Row 1), the campaign funnel + cost-distribution donut on a 50/50 row (Row 2),
 * and the shared Organizations / Leads / Events conversion tabs below (Row 3).
 *
 * Two reveal sources, each card skeletons on ITS own data (static-shell-first):
 *  - `pending` (campaign-scoped /revenue): realized return, conversions.
 *  - `statsPending` (merged campaign + feature stats): funnel + cost donut.
 */
export function CampaignRevenueSection({
  data,
  pending,
  statsPending,
  funnelSteps,
  statsRecord,
  registry,
  costBreakdown,
  campaign,
}: {
  data?: RevenueOverview;
  pending: boolean;
  statsPending: boolean;
  funnelSteps?: FunnelStep[];
  statsRecord: Record<string, number>;
  registry: StatsRegistry;
  costBreakdown: CostByName[];
  campaign: Campaign;
}) {
  return (
    <div className="space-y-4">
      {/* Row 1 — cost/budget stats column */}
      <div className="grid grid-cols-1 gap-4">
        <RevenueCostSummary
          costBreakdown={costBreakdown}
          costEconomics={data?.costEconomics}
          pending={pending}
          bottomCard={<CampaignBudgetCard campaign={campaign} />}
        />
      </div>

      {/* Row 2 — campaign funnel (incl. Clicks) + cost distribution, 50/50 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {funnelSteps && (
          <FunnelMetrics
            steps={funnelSteps}
            stats={statsRecord}
            registry={registry}
            pending={statsPending}
          />
        )}
        <CostBreakdown costBreakdown={costBreakdown} pending={statsPending} />
      </div>

      {/* Row 3 — Organizations / Leads / Events conversions (same as Overview) */}
      <ConversionsTabs data={data} pending={pending} />
    </div>
  );
}
