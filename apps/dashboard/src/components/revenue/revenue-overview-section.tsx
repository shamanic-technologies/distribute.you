"use client";

import type { ReactNode } from "react";
import { PipelineActivityChart } from "@/components/revenue/pipeline-activity-chart";
import { CostPerOutcomeCard } from "@/components/revenue/cost-per-outcome-card";
import type { BestWorkflowFloor } from "@/lib/cost-per-outcome-asymptote";
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
  chartsRow,
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
  costFloor,
  economicsLearning = false,
  paused = false,
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
  /** Null on a CAMPAIGN-scoped page until the campaign resolves and names its own
   *  channel — the section does not read it, so a caller must not have to invent a
   *  slug it does not yet know just to satisfy the type. */
  featureSlug: string | null;
  /** /orgs/:orgId/brands/:brandId/features/:slug — for the Top-campaigns links. */
  basePath: string;
  /** Optional control rendered on the right side of the section header. */
  headerAction?: ReactNode;
  /** Optional row rendered under the header, above the Pipeline-revenue hero. */
  topRow?: ReactNode;
  /**
   * Optional LAST band, under the activity charts — the caller composes its own grid.
   *
   * Rendered on the SAME gate as the activity band (`showActivityChart`), so it is
   * campaign-only by construction: a brand and an offer run several channels and several
   * funnels at once, and every card this band was built for (the campaign's audiences,
   * the models its workflows write with, its conversion rate) states one campaign's
   * answer. A separate flag would be a second way to say the same thing, and the two
   * would drift.
   */
  chartsRow?: ReactNode;
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
  /** Every campaign selling this scope is still learning — the return line then states
   *  why rather than drawing a ratio over almost no outcomes. */
  economicsLearning?: boolean;
  /**
   * The ONE campaign this section is scoped to is PAUSED. Threaded to the withheld-figure
   * tags so they read `Paused` instead of `Learning`; false at brand and offer grain,
   * where several campaigns sit under one heading.
   */
  paused?: boolean;
  /**
   * The floor the cost curve is heading for — the recommended workflow's own
   * campaign-grain price, read verbatim off the ranking ladder.
   *
   * CAMPAIGN-ONLY by construction rather than by a flag: the ladder is keyed on the
   * campaign's own leg, so only that page can resolve one and the brand and offer
   * Overviews pass nothing and never make the read.
   */
  costFloor?: BestWorkflowFloor | null;
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
  // WHAT one outcome is, and whether its price can be stated yet — both read straight off
  // features-service's own verdict on this same payload, never re-decided here. The
  // learning band at the top of the page renders off that identical field, so the two
  // cannot say different things about one campaign.
  //
  // Every status but `priced` draws the shape rather than a price: `learning` and
  // `learning_limited` have too few outcomes to divide by, `paused` has stopped
  // producing them. `unmeasured` is the producer saying it cannot answer at all — the
  // card then falls through to its own "we cannot chart this" line, which is the honest
  // reading of a scope nobody can price.
  const learningStatus = data?.learningPhase?.status ?? null;
  const costOutcomeLabel = data?.learningPhase?.outcomeStep?.label ?? null;
  const outcomeLearning =
    learningStatus === "learning" ||
    learningStatus === "learning_limited" ||
    learningStatus === "paused";
  const costPerOutcomeHistory = data?.costPerOutcomeHistory;
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
        {/* WHAT ONE OUTCOME HAS COST, over the campaign's life — beside the cost summary
            it divides. The Outcome line used to sit here and the two were swapped
            deliberately (owner-asked): the price is what a reader of this band is
            already looking at on the right, and the per-day volume reads better beside
            the per-day bars one band down.

            Height stretches to match the cost summary on its right (items-stretch),
            which is why that card's plot is `flex-1` rather than the fixed height it
            carried while it sat next to the activity bars.

            Gated on REVENUE, not activity: both curves ride the `/revenue` payload.
            Sharing the activity gate meant an outage on an endpoint these cards do not
            read blanked them anyway. */}
        {showRoiTrend ? (
          <RoiTrendCard history={data?.roiHistory} pending={revenueLoading} learning={economicsLearning} paused={paused} />
        ) : costOutcomeLabel ? (
          <CostPerOutcomeCard
            history={costPerOutcomeHistory}
            outcomeLabel={costOutcomeLabel}
            floor={costFloor}
            learning={outcomeLearning}
            paused={paused}
            pending={revenueLoading}
          />
        ) : null}

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

      {/* What we DID and what it BOUGHT, side by side on desktop.
          Left: per-day BARS — outreach / the goal engagement (clicks for signups,
          positive replies for meetings) across the past (actuals) + today + forecast,
          with the 7/30/90-day window toggle. Right: what one outcome has cost over
          the same life.
          One row rather than two full-width bands because the two answer halves of one
          question, and a customer reading a volume wants the price beside it rather
          than a scroll away. They stack below `lg`, where a half-width chart is not a
          chart. The bars keep their own horizontal scroll (their inner min-width is
          unchanged), so narrowing the column scrolls them instead of crushing them.
          Both are CHANNEL-scoped, so both render on the campaign Overview and on
          neither the brand nor the offer one (see `showActivityChart`). */}
      {showActivityChart && optimizationGoal && (
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          <div className="flex flex-col bg-white rounded-xl border border-gray-200 p-4 md:p-6">
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
          {/* Outcome — ONE cumulative line of the goal signal since launch, beside the
              per-day bars of the same signal. The two are the same thing at two grains
              (what happened each day, and what it adds up to), so they read together;
              the price they bought moved up to the band above. */}
          <OutcomeTrendCard
            series={outcomeSeries}
            future={outcomeFuture}
            label={outcomeLabel}
            pending={revenueLoading}
          />
        </div>
      )}

      {/* A third band of three, composed by the CALLER exactly like `topRow` and
          `costBottomCard` — the section hosts the layout and owns none of the wiring,
          because the cards in it read sources (the audience stats, the workflow ranking)
          this section has never fetched. Rendered on the same gate as the activity band,
          so it is CAMPAIGN-ONLY by construction rather than by a flag of its own. */}
      {showActivityChart && chartsRow}
    </div>
  );
}
