"use client";

import type { ReactNode } from "react";
import { PipelineActivityChart } from "@/components/revenue/pipeline-activity-chart";
import { OutcomeTrendCard } from "@/components/revenue/outcome-trend-card";
import { RoiTrendCard } from "@/components/revenue/roi-trend-card";
import { RevenueCostSummary } from "@/components/revenue/revenue-cost-summary";
import { Skeleton } from "@/components/skeleton";
import { isVisitDrivenGoal } from "@/lib/api";
import { funnelSteps } from "@/lib/goal-steps";
import type { SalesFunnelKeyWire } from "@/lib/sales-funnels";
import type { BrandOptimizationGoal, PipelineActivityResponse } from "@/lib/api";
import type { RevenueOverview, SignalSeries } from "@/lib/revenue-view";

/**
 * Outreach overview block — top row: the "Outcome" card (cumulative goal signal
 * since launch: clicks for signups / positive replies for meetings) beside the cost
 * summary; full-width "Outreach activity" per-day bars below. Pure render — the page
 * owns the gate + query.
 *
 * Per-lead rows live on the Leads page, not here: the conversion tabs this section
 * used to compose sat behind a prop both callers set to null, so they never rendered.
 */
export function RevenueOverviewSection({
  data,
  dailyBudgetCents,
  budgetNote,
  brandId,
  featureSlug,
  basePath,
  headerAction,
  topRow,
  pipelineActivity,
  pipelineActualSeries,
  optimizationGoal,
  funnelKey,
  visitToMeetingPct,
  visitToSignupPct,
  expectedOutcome,
  costBottomCard,
  revenuePending = false,
  activityPending = false,
  costPending = false,
  todayCostPending = false,
  hideHeader = false,
  trackerSetUp = false,
  showActivityChart = true,
  showRoiTrend = false,
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
  /**
   * The goal, for the surfaces that still have one — the activity chart's step labels
   * and the Outcome line's signal. A BRAND has none (it runs several funnels at once)
   * and renders neither, so it passes nothing rather than a picked default.
   */
  optimizationGoal?: BrandOptimizationGoal;
  /**
   * The sales funnel this section is scoped to, when it is scoped to one — forwarded to
   * the activity chart and used for the Outcome line's own signal. A campaign states one
   * funnel; a brand runs several at once, so it states none and the goal keys everything
   * exactly as before.
   */
  funnelKey?: SalesFunnelKeyWire | null;
  /** Conversion rates the activity chart labels its bars with. Absent at brand level,
   *  which does not render that chart. */
  visitToMeetingPct?: number | null;
  visitToSignupPct?: number | null;
  dailyBudgetCents?: number | null;
  /** Why no ceiling is shown beside today's spend — forwarded to the cost card.
   *  An offer has no budget of its own (money is funded per brand), so its page
   *  states that rather than borrowing the brand's figure or inventing a share. */
  budgetNote?: string;
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
  /** Conversion-tracker liveness — gates the Form-submissions bar in the
   *  Outreach-activity graph (hidden until the tracker fires). */
  trackerSetUp?: boolean;
  /**
   * Whether to render the per-day "Outreach activity" bars.
   *
   * They describe ONE acquisition channel — the emails sales cold outreach sends
   * and the clicks they earn — so they belong to the campaign that runs that
   * channel. A brand runs several channels and several funnels at once, and the
   * brand Overview answers a different question: what the whole thing returned.
   */
  showActivityChart?: boolean;
  /**
   * Chart RETURN ON SPEND across the brand's life instead of the cumulative count of
   * one funnel signal.
   *
   * The signal line answers a narrower question than the brand Overview asks — a brand
   * runs several funnels, and the one thing every one of them is judged on is what came
   * back per dollar. The campaign Overview keeps the signal line: it sells exactly one
   * funnel, so its own signal IS what that campaign is buying.
   */
  showRoiTrend?: boolean;
}) {
  // Static-shell-first: the section header, card frames, titles and the tab bar
  // render on the first paint; only the data regions skeleton while loading.
  // `revenueLoading` tracks `revenuePending` ALONE — no defensive `!data` re-guard.
  // The page reveals-on-settle (success OR error), so on an errored `/revenue`
  // `revenuePending` is false while `data` is undefined; re-guarding on `!data`
  // here would re-lock the whole section into an eternal skeleton. Every region is
  // null-safe (`data?.spend`, `spend?.…` → "—"), so absent data renders dashes.
  // Same rule for the activity gate — `activityPending` ALONE. `pipeline-activity`
  // 502s intermittently in prod (a 20-minute burst on 2026-08-08 blanked this whole
  // block), and on an errored query the page reveals-on-settle: `activityPending`
  // goes false while `pipelineActivity` stays undefined. A `|| !pipelineActivity`
  // re-guard here therefore skeletons both charts FOREVER, with no error text and
  // no retry affordance — the #2650 bug one component down.
  const revenueLoading = revenuePending;
  const activityLoading = activityPending;
  // The chart reads `data.days` and cannot take an absent payload, so once the gate
  // has settled an absent one gets its own honest line rather than a skeleton:
  // "still loading" and "we could not load this" are different statements. The
  // check is inlined at the render site so TypeScript narrows the prop.
  // The "Outcome" card's single cumulative line tracks the brand's goal signal:
  // website clicks for a signups brand, positive replies for a meetings brand.
  // Keyed on the FUNNEL when the surface states one: the goal cannot separate a meeting won
  // from a reply from one won on the website (both are `sales_meetings`), so a goal-keyed
  // line labels the wrong signal on one of the two. A brand states no funnel and keeps the
  // goal's answer.
  const isVisitDriven = funnelKey
    ? funnelSteps(funnelKey).some((s) => s.key === "website_visits")
    : optimizationGoal
      ? isVisitDrivenGoal(optimizationGoal)
      : false;
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
        {/* Gated on REVENUE, not activity: the cumulative line is `pipelineActualSeries`,
            which rides the `/revenue` payload. Sharing the activity gate meant an
            outage on an endpoint this card does not read blanked it anyway; its
            forward projection is the only part sourced from pipeline-activity and
            degrades to no dashed segment. */}
        {showRoiTrend ? (
          <RoiTrendCard history={data?.roiHistory} pending={revenueLoading} />
        ) : (
          <OutcomeTrendCard
            series={outcomeSeries}
            future={outcomeFuture}
            label={outcomeLabel}
            color={outcomeColor}
            pending={revenueLoading}
          />
        )}

        {/* Cost summary — server-computed spend block (Total spent / today / top
            sources), rendered verbatim from features-service `/revenue`.
            Bottom card defaults to the brand-wide Top-3 cost-source list (the old
            Top-campaigns-by-ROI card was dropped with the campaign concept — there's
            no per-campaign detail page to link to anymore). */}
        <RevenueCostSummary
          spend={data?.spend}
          dailyBudgetCents={dailyBudgetCents}
          budgetNote={budgetNote}
          pending={revenueLoading}
          costPending={costPending}
          todayCostPending={todayCostPending}
          bottomCard={costBottomCard}
        />
      </div>

      {/* Outreach activity — full-width per-day BARS: outreach / the goal
          engagement (clicks for signups, positive replies for meetings) across the
          past (actuals) + today + forecast, with the 7/30/90-day window toggle.
          Channel-scoped, so it renders on the campaign Overview and not on the
          brand one (see `showActivityChart`). */}
      {showActivityChart && optimizationGoal && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <h3 className="font-medium text-gray-800 mb-4">Outreach activity</h3>
          {activityLoading ? (
            <Skeleton className="h-[300px] lg:h-[200px] w-full rounded" />
          ) : !pipelineActivity ? (
            <p className="flex h-[300px] items-center justify-center text-sm text-gray-500 lg:h-[200px]">
              We could not load your outreach activity right now. It will reappear on
              its own.
            </p>
          ) : (
            <PipelineActivityChart
              data={pipelineActivity}
              pipelineActualSeries={pipelineActualSeries}
              optimizationGoal={optimizationGoal}
              funnelKey={funnelKey}
              trackerSetUp={trackerSetUp}
              visitToMeetingPct={visitToMeetingPct}
              visitToSignupPct={visitToSignupPct}
            />
          )}
        </div>
      )}
    </div>
  );
}
