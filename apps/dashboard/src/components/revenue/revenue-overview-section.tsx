"use client";

import type { ReactNode } from "react";
import { PipelineActivityChart } from "@/components/revenue/pipeline-activity-chart";
import { ConversionsTabs } from "@/components/revenue/conversions-tabs";
import { RevenueCostSummary } from "@/components/revenue/revenue-cost-summary";
import { Skeleton } from "@/components/skeleton";
import type { BrandOptimizationGoal, CostByName, PipelineActivityResponse } from "@/lib/api";
import type { RevenueOverview, SignalSeries } from "@/lib/revenue-view";

function formatOutcomeCount(n: number | null): string {
  if (n === null) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Outreach overview block — expected monthly outcome headline, 7-day outreach
 * activity chart, and the Organizations / Leads / Events conversion tabs (same set
 * as the dedicated Conversions page; each table paginates 20/page). Pure render —
 * the page owns the gate + query.
 */
export function RevenueOverviewSection({
  data,
  costBreakdown,
  todayCostBreakdown,
  dailyBudgetCents,
  brandId,
  featureSlug,
  basePath,
  headerAction,
  topRow,
  pipelineActivity,
  pipelineActualSeries,
  optimizationGoal,
  visitToMeetingPct,
  visitToSignupPct,
  expectedOutcome,
  costBottomCard,
  revenuePending = false,
  activityPending = false,
  costPending = false,
  todayCostPending = false,
  hideHeader = false,
  conversions,
}: {
  data?: RevenueOverview;
  pipelineActivity?: PipelineActivityResponse;
  pipelineActualSeries?: {
    outreach?: SignalSeries;
    opens?: SignalSeries;
    clicks?: SignalSeries;
    signups?: SignalSeries;
    salesMeetings?: SignalSeries;
  };
  optimizationGoal: BrandOptimizationGoal;
  visitToMeetingPct: number | null | undefined;
  visitToSignupPct: number | null | undefined;
  costBreakdown: CostByName[];
  todayCostBreakdown?: CostByName[];
  dailyBudgetCents?: number | null;
  brandId: string;
  featureSlug: string;
  /** /orgs/:orgId/brands/:brandId/features/:slug — for the Top-campaigns links. */
  basePath: string;
  /** Optional control rendered on the right side of the section header. */
  headerAction?: ReactNode;
  /** Optional row rendered under the header, above the Pipeline-revenue hero. */
  topRow?: ReactNode;
  /** Optional bottom card rendered under the cost-efficiency stat cards. */
  costBottomCard?: ReactNode;
  /** features-service `/revenue` reveal — headline and conversions. */
  revenuePending?: boolean;
  /** features-service pipeline-activity reveal — forecast for the graph. */
  activityPending?: boolean;
  /** Goal-specific expected monthly outcome, replacing the old revenue headline. */
  expectedOutcome?: {
    value: number | null;
    label: string;
  };
  /** runs-service cost-breakdown reveal — the Total-spent figure only. */
  costPending?: boolean;
  /** runs-service same-day actual spend reveal — the Budget spent today figure. */
  todayCostPending?: boolean;
  /** Hide the "Outreach & Conversions" header (the Signups page provides its own
   *  header + Run Campaign action). */
  hideHeader?: boolean;
  /** Replace the default Organizations/Leads conversion tabs (the Signups page
   *  supplies its own engaged-leads table: opened / clicked / signed up). */
  conversions?: ReactNode;
}) {
  // Static-shell-first: the section header, card frames, titles and the tab bar
  // render on the first paint; only the data regions skeleton while loading.
  // `revenueLoading` folds `revenuePending` with a defensive `!data` guard — it
  // drives every region fed by features-service `/revenue`; the Total-spent figure
  // (runs-service) reveals on its own `costPending` so it never waits on revenue.
  const revenueLoading = revenuePending || !data;
  const activityLoading = activityPending || !pipelineActivity;
  const outcomeLoading = expectedOutcome === undefined;
  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-gray-800">Outreach &amp; Conversions</h2>
            <p className="text-sm text-gray-500">Clicks and conversions from the outreach we run for you.</p>
          </div>
          {headerAction && (
            <div className="w-full lg:w-auto lg:flex-shrink-0">{headerAction}</div>
          )}
        </div>
      )}

      {topRow}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Headline + activity chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-medium text-gray-800">Outreach activity</h3>
            <div className="text-right">
              {outcomeLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <p className="text-2xl font-bold text-gray-900 leading-none">
                  {formatOutcomeCount(expectedOutcome.value)}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">{expectedOutcome?.label ?? "expected / month"}</p>
            </div>
          </div>
          {activityLoading ? (
            <Skeleton className="h-[260px] w-full rounded" />
          ) : (
            <PipelineActivityChart
              data={pipelineActivity}
              pipelineActualSeries={pipelineActualSeries}
              optimizationGoal={optimizationGoal}
              visitToMeetingPct={visitToMeetingPct}
              visitToSignupPct={visitToSignupPct}
            />
          )}
        </div>

        {/* Cost summary — actual spend and source breakdown.
            Bottom card defaults to the brand-wide Top-3 cost-source list (the old
            Top-campaigns-by-ROI card was dropped with the campaign concept — there's
            no per-campaign detail page to link to anymore). */}
        <RevenueCostSummary
          costBreakdown={costBreakdown}
          todayCostBreakdown={todayCostBreakdown}
          dailyBudgetCents={dailyBudgetCents}
          pending={revenueLoading}
          costPending={costPending}
          todayCostPending={todayCostPending}
          bottomCard={costBottomCard}
        />
      </div>

      {/* Conversions — the default Organizations / Leads tabs, OR a caller-
          supplied replacement (the Signups page passes its own engaged-leads
          table: opened / clicked / signed up). */}
      {conversions === undefined ? <ConversionsTabs data={data} pending={revenueLoading} /> : conversions}
    </div>
  );
}
