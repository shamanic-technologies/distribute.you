"use client";

import type { ReactNode } from "react";
import { PipelineActivityChart } from "@/components/revenue/pipeline-activity-chart";
import { OutcomeTrendCard } from "@/components/revenue/outcome-trend-card";
import { ConversionsTabs } from "@/components/revenue/conversions-tabs";
import { RevenueCostSummary } from "@/components/revenue/revenue-cost-summary";
import { Skeleton } from "@/components/skeleton";
import { isVisitDrivenGoal } from "@/lib/api";
import type { BrandOptimizationGoal, PipelineActivityResponse } from "@/lib/api";
import type { RevenueOverview, SignalSeries } from "@/lib/revenue-view";

/**
 * Outreach overview block — top row: the "Outcome" card (cumulative goal signal
 * since launch: clicks for signups / positive replies for meetings) beside the cost
 * summary; full-width "Outreach activity" per-day bars below; then the
 * Organizations / Leads / Events conversion tabs. Pure render — the page owns the
 * gate + query.
 */
export function RevenueOverviewSection({
  data,
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
    clicks?: SignalSeries;
    signups?: SignalSeries;
    repliedPositive?: SignalSeries;
    salesMeetings?: SignalSeries;
  };
  optimizationGoal: BrandOptimizationGoal;
  visitToMeetingPct: number | null | undefined;
  visitToSignupPct: number | null | undefined;
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
  };
  /** Reveal gate for the Total-spent figure. The spend block now rides the
   *  features-service `/revenue` payload, so the Overview passes the revenue
   *  reveal here. */
  costPending?: boolean;
  /** Reveal gate for the Budget-spent-today figure (same `/revenue` source). */
  todayCostPending?: boolean;
  /** Hide the "Outreach & Conversions" header (the Signups page provides its own
   *  header + Run Campaign action). */
  hideHeader?: boolean;
  /** Replace the default Organizations/Leads conversion tabs (the Signups page
   *  supplies its own engaged-leads table: clicked / signed up). */
  conversions?: ReactNode;
}) {
  // Static-shell-first: the section header, card frames, titles and the tab bar
  // render on the first paint; only the data regions skeleton while loading.
  // `revenueLoading` folds `revenuePending` with a defensive `!data` guard — it
  // drives every region fed by features-service `/revenue`; the Total-spent figure
  // (runs-service) reveals on its own `costPending` so it never waits on revenue.
  const revenueLoading = revenuePending || !data;
  const activityLoading = activityPending || !pipelineActivity;
  // The "Outcome" card's single cumulative line tracks the brand's goal signal:
  // website clicks for a signups brand, positive replies for a meetings brand.
  const isVisitDriven = isVisitDrivenGoal(optimizationGoal);
  const outcomeSeries = isVisitDriven
    ? pipelineActualSeries?.clicks
    : pipelineActualSeries?.repliedPositive;
  const outcomeLabel = isVisitDriven ? "Website visits" : "Positive replies";
  const outcomeColor = isVisitDriven ? "#0891b2" : "#dc2626";

  // Forward projection for the Outcome line — the expected daily increments past
  // today (today + forecast horizon). Signups read the per-day clicks forecast;
  // meetings have no per-day reply forecast, so the monthly expected outcome is
  // spread evenly across the horizon (option a).
  const finitePos = (n: number | null | undefined): number =>
    typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
  const todayIso = pipelineActivity?.days.find((d) => d.isToday)?.date;
  const futureDays = (pipelineActivity?.days ?? []).filter(
    (d) => todayIso != null && d.date > todayIso,
  );
  const monthlyExpected = finitePos(expectedOutcome?.value);
  const outcomeFuture = isVisitDriven
    ? futureDays.map((d) => ({ date: d.date, value: finitePos(d.metrics.clicks?.expected) }))
    : monthlyExpected > 0 && futureDays.length > 0
      ? futureDays.map((d) => ({ date: d.date, value: monthlyExpected / 30 }))
      : [];
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* Outcome — ONE cumulative line of the goal signal since launch. Height
            stretches to match the cost summary on its right (items-stretch). */}
        <OutcomeTrendCard
          series={outcomeSeries}
          future={outcomeFuture}
          label={outcomeLabel}
          color={outcomeColor}
          pending={activityLoading}
        />

        {/* Cost summary — server-computed spend block (Total spent / today / top
            sources), rendered verbatim from features-service `/revenue`.
            Bottom card defaults to the brand-wide Top-3 cost-source list (the old
            Top-campaigns-by-ROI card was dropped with the campaign concept — there's
            no per-campaign detail page to link to anymore). */}
        <RevenueCostSummary
          spend={data?.spend}
          dailyBudgetCents={dailyBudgetCents}
          pending={revenueLoading}
          costPending={costPending}
          todayCostPending={todayCostPending}
          bottomCard={costBottomCard}
        />
      </div>

      {/* Outreach activity — full-width per-day BARS: outreach / the goal
          engagement (clicks for signups, positive replies for meetings) across the
          past (actuals) + today + forecast, with the 7/30/90-day window toggle. */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <h3 className="font-medium text-gray-800 mb-4">Outreach activity</h3>
        {activityLoading ? (
          <Skeleton className="h-[300px] lg:h-[200px] w-full rounded" />
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

      {/* Conversions — the default Organizations / Leads tabs, OR a caller-
          supplied replacement (the Signups page passes its own engaged-leads
          table: clicked / signed up). */}
      {conversions === undefined ? <ConversionsTabs data={data} pending={revenueLoading} /> : conversions}
    </div>
  );
}
