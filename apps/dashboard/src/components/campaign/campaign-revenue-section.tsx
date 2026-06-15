"use client";

import { RevenueChart } from "@/components/revenue/revenue-chart";
import { RevenueCostSummary } from "@/components/revenue/revenue-cost-summary";
import { ConversionsTabs } from "@/components/revenue/conversions-tabs";
import { CampaignBudgetCard } from "@/components/campaign/campaign-budget-card";
import { Skeleton } from "@/components/skeleton";
import type { Campaign, CostByName } from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";

function formatUsd(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Campaign-scoped revenue layout — mirrors the feature Overview (DIS-229): a
 * "Pipeline revenue over time" line chart with a cost/budget stats column on top
 * (Row 1), and the shared Organizations / Leads / Events conversion tabs below
 * (Row 2).
 *
 * `pending` (campaign-scoped /revenue) drives the line chart, CAC/ROI, conversions.
 */
export function CampaignRevenueSection({
  data,
  pending,
  costBreakdown,
  campaign,
}: {
  data?: RevenueOverview;
  pending: boolean;
  costBreakdown: CostByName[];
  campaign: Campaign;
}) {
  return (
    <div className="space-y-4">
      {/* Row 1 — pipeline revenue over time + cost/budget stats column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-medium text-gray-800">Pipeline revenue over time</h3>
            <div className="text-right">
              {pending ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <p className="text-2xl font-bold text-gray-900 leading-none">
                  {formatUsd(data?.totalPipelineUsd ?? null)}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">expected pipeline</p>
            </div>
          </div>
          {pending || !data ? (
            <Skeleton className="h-[260px] w-full rounded" />
          ) : (
            <RevenueChart series={data.timeSeries} />
          )}
        </div>

        <RevenueCostSummary
          costBreakdown={costBreakdown}
          costEconomics={data?.costEconomics}
          pending={pending}
          bottomCard={<CampaignBudgetCard campaign={campaign} />}
        />
      </div>

      {/* Row 2 — Organizations / Leads / Events conversions (same as Overview) */}
      <ConversionsTabs data={data} pending={pending} />
    </div>
  );
}
