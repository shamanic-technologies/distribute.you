"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  getCampaign,
  getFeatureRevenue,
  fetchFeatureStats,
  getBrandSalesEconomics,
  getBrandDailyBudget,
  getBrandPause,
  getBrandConversionToken,
  getFeaturePipelineActivity,
  fetchFeatureAudienceStats,
  listAudiences,
  getWorkflowProjection,
  optimizationGoalForRuntimeGoal,
  salesObjectiveForOptimizationGoal,
  keepLastGoodWorkflowProjection,
  keepLastGoodFeatureRevenue,
  type PipelineActivityMetric,
  type WorkflowProjectionResponse,
} from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";
import { pollOptions } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import {
  selectWorkflowForOptimizationGoal,
  workflowOutcomeUnitCost,
} from "@/lib/workflow-projection-choice";
import { audienceRankMetric, goalForOptimizationGoal } from "@/lib/strategy-model";
import {
  goalOutcomeCount,
  recommendedLearningSpendUsd,
  shouldShowReassurance,
} from "@/lib/first-outcome-reassurance";
import { FirstOutcomeReassuranceBanner } from "@/components/brand/first-outcome-reassurance-banner";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { RevenueEmptyState } from "@/components/revenue/revenue-empty-state";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { TopAudiencesCard } from "@/components/revenue/top-audiences-card";
import { CampaignTitle } from "@/components/campaigns/campaign-title";
import { DashboardPage } from "@/components/dashboard-page";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";

// Campaign-level Overview (v2, staff/god-mode PREVIEW while the campaign concept
// is progressively re-introduced — #2762). It MIRRORS the brand Overview
// (`brands/[brandId]/page.tsx`) but drills into ONE campaign: the pipeline,
// conversions, cost and outreach numbers are scoped to `campaignId`; the brand's
// forecast + config (daily-budget pipeline-activity, sales-economics goal,
// audiences, pause/status) are the CAMPAIGN's inherited brand context (a campaign
// has no per-campaign economics/budget/audience of its own on the wire).
//
// This is a deliberate PARALLEL of the brand Overview page, not a shared body:
// the brand page is GA + covered by source-substring guards
// (overview-reveal-on-settle / feature-overview-polish). Keeping this separate
// isolates all campaign-preview risk from the GA surface. Both render the SAME
// `RevenueOverviewSection`, so they stay visually identical; only the data wiring
// (revenue + stats scoped to campaignId) differs. The revenue + stats query keys
// are byte-equal to `OutreachStatCardsAuto`'s campaign-scoped keys so React Query
// dedupes to one poll across this page + the campaign Leads page.

const DEFAULT_VISIT_TO_MEETING_PCT = 20;
const DEFAULT_VISIT_TO_SIGNUP_PCT = 25;

function countByDay(series: RevenueOverview["outreachContacted"]): Map<string, number> | null {
  if (!series) return null;
  return new Map(series.daily.map((d) => [d.date, d.count] as const));
}

function actualFrom(
  byDay: Map<string, number> | null,
  date: string,
  fallback: number | null,
): number | null {
  return byDay ? byDay.get(date) ?? 0 : fallback;
}

function withActual(metric: PipelineActivityMetric, actual: number | null): PipelineActivityMetric {
  return { ...metric, actual };
}

export function CampaignOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const campaignId = params.id as string;
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug);
  const timezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const { data: brandData } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
    { ...pollOptions },
  );
  const brand = brandData?.brand ?? null;

  // Campaign identity (name for the header).
  const { data: campaignData, isPending: campaignLoading } = useAuthQuery(
    ["campaign", campaignId],
    () => getCampaign(campaignId),
    { ...pollOptions },
  );
  const campaign = campaignData?.campaign ?? null;

  // Revenue + conversions SCOPED TO THE CAMPAIGN. Byte-equal key to
  // OutreachStatCardsAuto's campaign-scoped key → one deduped poll.
  const { data, isError: revenueIsError } = useAuthQuery(
    ["featureRevenue", brandId, featureSlug, "campaign", campaignId],
    () => getFeatureRevenue(featureSlug, brandId, campaignId),
    {
      enabled,
      ...pollOptions,
      structuralSharing: (prev, next) =>
        keepLastGoodFeatureRevenue(
          prev as RevenueOverview | undefined,
          next as RevenueOverview,
        ),
    },
  );

  // Pipeline-activity is a BRAND daily-budget forecast (features-service: "campaign
  // status and campaign budget do not control this forecast"), so it stays
  // brand-scoped — the campaign's inherited forecast context.
  const { data: pipelineActivity, isError: pipelineIsError } = useAuthQuery(
    ["featurePipelineActivity", brandId, featureSlug, timezone],
    () => getFeaturePipelineActivity(featureSlug, { brandId, days: 7, timezone }),
    { enabled, ...pollOptions },
  );

  const outreachSeries = data?.sequences ?? data?.outreachContacted;
  const outreachTotal = outreachSeries?.total ?? null;
  const mergedPipelineActivity = useMemo(() => {
    if (!pipelineActivity) return undefined;
    const outreachByDay = countByDay(data?.sequences ?? data?.outreachContacted);
    const clickedByDay = countByDay(data?.clicked);
    const meetingsByDay = countByDay(data?.meetingsBooked);
    if (!outreachByDay && !clickedByDay && !meetingsByDay) {
      return pipelineActivity;
    }
    return {
      ...pipelineActivity,
      days: pipelineActivity.days.map((day) => ({
        ...day,
        metrics: {
          ...day.metrics,
          outreach: withActual(
            day.metrics.outreach,
            actualFrom(outreachByDay, day.date, day.metrics.outreach.actual),
          ),
          clicks: withActual(
            day.metrics.clicks,
            actualFrom(clickedByDay, day.date, day.metrics.clicks.actual),
          ),
          signups: withActual(
            day.metrics.signups,
            actualFrom(clickedByDay, day.date, day.metrics.signups.actual),
          ),
          salesMeetings: withActual(
            { actual: null, expected: null, conversionPct: null },
            actualFrom(meetingsByDay, day.date, null),
          ),
        },
      })),
    };
  }, [pipelineActivity, data]);
  const pipelineActualSeries = useMemo(() => ({
    outreach: data?.sequences ?? data?.outreachContacted,
    clicks: data?.clicked,
    signups: data?.clicked,
    repliedPositive: data?.repliedPositive,
    salesMeetings: data?.meetingsBooked,
  }), [data]);

  // Feature stats SCOPED TO THE CAMPAIGN (Impressions / Clicks / CPC cards).
  // Byte-equal key to OutreachStatCardsAuto's campaign key → one deduped poll.
  const { data: featureStatsData, isError: featureStatsIsError } = useAuthQuery(
    ["featureStats", featureSlug, "campaign", campaignId],
    () => fetchFeatureStats(featureSlug, { campaignId }),
    { enabled, ...pollOptions },
  );
  const featureStats = featureStatsData?.stats ?? {};
  const totalWebsiteClicks = featureStats.recipientsClicked ?? 0;

  // Brand goal config → goal-specific stat card copy (inherited by the campaign).
  const { data: economicsData, isError: economicsIsError } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
    { enabled, ...pollOptions },
  );
  const brandOptimizationGoal =
    economicsData?.salesEconomics?.optimizationGoal ?? "sales_meetings";
  // Prefer the campaign's OWN goal (v2 per-campaign goal) when set; fall back to the
  // brand goal only when the campaign inherits (null). RuntimeGoal → brand-goal vocab
  // so it drives the goal-labelled display surfaces. Pure display of campaign config.
  const optimizationGoal = campaign?.goal
    ? optimizationGoalForRuntimeGoal(campaign.goal)
    : brandOptimizationGoal;
  // What this campaign actually SELLS, read off the campaign row. It is the richer of the
  // two fields: `sales_meetings` covers both meeting funnels, so the goal alone cannot say
  // whether the chain starts at a positive reply or at a click onto the site — and every
  // step-labelled surface below (stat cards, activity bars, the Outcome line) needs to
  // know. NULL on a pre-funnel campaign, which correctly falls back to the goal.
  const campaignFunnelKey = campaign?.funnelKey ?? null;
  const visitToMeetingPct =
    economicsData?.salesEconomics?.visitToMeetingPct ?? DEFAULT_VISIT_TO_MEETING_PCT;
  const visitToSignupPct =
    economicsData?.salesEconomics?.visitToSignupPct ?? DEFAULT_VISIT_TO_SIGNUP_PCT;
  // One shared mapping with the brand Overview + Audiences page — see goalForOptimizationGoal.
  const audienceStatsGoal = goalForOptimizationGoal(optimizationGoal);

  const { data: budgetData, isError: budgetIsError } = useAuthQuery(
    ["brandDailyBudget", brandId],
    () => getBrandDailyBudget(brandId),
    { enabled, ...pollOptions },
  );

  const { data: pauseData } = useAuthQuery(
    ["brandPause", brandId],
    () => getBrandPause(brandId),
    { enabled, ...pollOptions },
  );
  const isBrandPaused = pauseData?.paused === true;

  const { data: conversionTokenData } = useAuthQuery(
    ["brandConversionToken", brandId],
    () => getBrandConversionToken(brandId),
    { enabled, ...pollOptions },
  );
  const trackerSetUp =
    conversionTokenData?.status === "live" ||
    conversionTokenData?.status === "live_waiting";
  // Same cost column the Audiences table leads with — never features-service's sortMetric.
  const audienceStatsMetric = audienceRankMetric(optimizationGoal, trackerSetUp);
  const monthlyBudgetUsd =
    budgetData?.dailyBudgetCents != null && budgetData.dailyBudgetCents > 0
      ? (budgetData.dailyBudgetCents / 100) * 30
      : null;

  const { data: outcomeProjection, isError: outcomeIsError } = useAuthQuery(
    [
      "workflowProjection",
      brandId,
      featureSlug,
      "overview-outcome",
      optimizationGoal,
      monthlyBudgetUsd,
      economicsData?.salesEconomics?.updatedAt ?? "no-economics",
    ],
    () =>
      getWorkflowProjection({
        featureSlug,
        brandId,
        objective: salesObjectiveForOptimizationGoal(optimizationGoal),
        budgetUsd: monthlyBudgetUsd ?? undefined,
      }),
    {
      enabled: enabled && economicsData !== undefined && monthlyBudgetUsd != null,
      placeholderData: undefined,
      structuralSharing: (prev, next) =>
        keepLastGoodWorkflowProjection(
          prev as WorkflowProjectionResponse | undefined,
          next as WorkflowProjectionResponse,
        ),
    },
  );

  const activeOutcomeWorkflow = useMemo(() => {
    if (!outcomeProjection) return null;
    return selectWorkflowForOptimizationGoal(outcomeProjection, optimizationGoal, {
      visitToSignupPct: economicsData?.salesEconomics?.visitToSignupPct,
      replyToMeetingPct: economicsData?.salesEconomics?.replyToMeetingPct,
      visitToMeetingPct: economicsData?.salesEconomics?.visitToMeetingPct,
      projectionBudgetUsd: monthlyBudgetUsd,
    });
  }, [
    economicsData?.salesEconomics?.replyToMeetingPct,
    economicsData?.salesEconomics?.visitToMeetingPct,
    economicsData?.salesEconomics?.visitToSignupPct,
    monthlyBudgetUsd,
    optimizationGoal,
    outcomeProjection,
  ]);

  // The campaign's expected cost for ONE of its goal outcomes — read both by the
  // expected monthly count and by the reassurance banner's recommended learning budget.
  const outcomeUnitCostUsd = useMemo(() => {
    if (activeOutcomeWorkflow == null) return null;
    return workflowOutcomeUnitCost(activeOutcomeWorkflow, optimizationGoal, {
      visitToSignupPct: economicsData?.salesEconomics?.visitToSignupPct,
      replyToMeetingPct: economicsData?.salesEconomics?.replyToMeetingPct,
      visitToMeetingPct: economicsData?.salesEconomics?.visitToMeetingPct,
      projectionBudgetUsd: monthlyBudgetUsd,
    });
  }, [
    activeOutcomeWorkflow,
    economicsData?.salesEconomics?.replyToMeetingPct,
    economicsData?.salesEconomics?.visitToMeetingPct,
    economicsData?.salesEconomics?.visitToSignupPct,
    monthlyBudgetUsd,
    optimizationGoal,
  ]);

  const expectedMonthlyOutcome = useMemo(() => {
    if (monthlyBudgetUsd == null || monthlyBudgetUsd <= 0) return null;
    return outcomeUnitCostUsd != null && outcomeUnitCostUsd > 0
      ? monthlyBudgetUsd / outcomeUnitCostUsd
      : null;
  }, [monthlyBudgetUsd, outcomeUnitCostUsd]);

  // Audiences stay brand-wide, but their STATS are scoped to this campaign (v2) —
  // features-service `?campaignId=` (via api-service forward). Keyed by campaignId so
  // it's a distinct cache entry from the brand-wide Top-audiences card.
  const { data: audienceStatsData, isError: audienceStatsIsError } = useAuthQuery(
    ["featureAudienceStats", featureSlug, brandId, campaignFunnelKey ?? audienceStatsGoal, "campaign", campaignId],
    // No `limit` — the server would pre-pick its top 3 by ITS OWN sortMetric, a different
    // column than this card shows. The card sorts + slices on the brand's metric instead.
    // A campaign sells exactly ONE funnel and states which, so it names it: the goal
    // cannot, since `reply_meeting` and `visit_meeting` both answer to `meetingBooked`
    // and would price a reply-driven chain against clicks it never buys. A campaign that
    // predates the funnel keeps the goal.
    () => fetchFeatureAudienceStats(featureSlug, {
      brandId,
      ...(campaignFunnelKey ? { funnel: campaignFunnelKey } : { goal: audienceStatsGoal }),
      campaignId,
    }),
    { enabled, ...pollOptions },
  );

  const { data: audiencesData, isError: audiencesIsError } = useAuthQuery(
    ["audiences", brandId],
    () => listAudiences(brandId),
    { enabled, ...pollOptions },
  );
  const activeAudiences = audiencesData?.audiences.filter((a) => a.status === "active");
  // Prefer the campaign's OWN targeted audience subset (v2 `audienceIds`) when set;
  // else the brand's active set it inherits. Resolve ids → names from the already-
  // fetched listAudiences (pure display lookup, no extra fetch).
  const campaignAudienceIds = campaign?.audienceIds ?? null;
  const displayAudiences = campaignAudienceIds
    ? audiencesData?.audiences.filter((a) => campaignAudienceIds.includes(a.id))
    : activeAudiences;

  const revenueSettled = data !== undefined || revenueIsError;
  const revenueRevealed = useCoordinatedReveal([revenueSettled]);
  const activityRevealed = useCoordinatedReveal([
    pipelineActivity !== undefined || pipelineIsError,
    economicsData !== undefined || economicsIsError,
    revenueSettled,
  ]);
  const costRevealed = revenueRevealed;
  const statsRevealed = useCoordinatedReveal([
    featureStatsData !== undefined || featureStatsIsError,
  ]);
  const audienceStatsRevealed = useCoordinatedReveal([
    audienceStatsData !== undefined || audienceStatsIsError,
    audiencesData !== undefined || audiencesIsError,
  ]);
  const outcomeRevealed = useCoordinatedReveal([
    budgetData !== undefined || budgetIsError,
    economicsData !== undefined || economicsIsError,
    monthlyBudgetUsd == null || outcomeProjection !== undefined || outcomeIsError,
  ]);
  // Mirrors the brand Overview: the banner names this goal's outcome, so it hides on
  // that outcome (not on an unrelated click) and retires once the learning budget is
  // spent. The outcome count rides `/revenue`, so it reveals with revenue too.
  const recommendedLearningUsd = recommendedLearningSpendUsd(outcomeUnitCostUsd);
  const showFirstOutcomeReassurance = shouldShowReassurance({
    revealed: statsRevealed && revenueRevealed,
    paused: isBrandPaused,
    outcomeCount: goalOutcomeCount(optimizationGoal, data?.spend, totalWebsiteClicks),
    recommendedSpendUsd: recommendedLearningUsd,
    spentUsd: data?.spend?.totalSpentCents != null ? data.spend.totalSpentCents / 100 : null,
  });

  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  const campaignsPath = `${basePath}/campaigns`;

  // A campaign has no budget of its own to show any more. The money is funded per
  // SALES FUNNEL, and a campaign runs one funnel — so the ceiling that governs it
  // belongs to the funnel, and it is stated where the customer sets it (brand
  // Settings), not restated here against a campaign that does not own it. The
  // per-campaign ceiling survives in campaign-service only as a mirror of the
  // funnel's, which is machinery, not a number to put on screen.
  //
  // The brand-level read is still used BELOW for the outcome forecast — billing
  // answers it with the SUM of the funnel ceilings, so the forecast is unchanged.

  if (!campaignLoading && !campaign) {
    return (
      <DashboardPage width="wide">
        <p className="text-gray-500 mb-3">Campaign not found</p>
        <Link href={campaignsPath} className="text-sm text-brand-600 hover:underline">
          ← Back to campaigns
        </Link>
      </DashboardPage>
    );
  }

  if (!isRevenueFeature(featureSlug)) {
    return (
      <DashboardPage width="wide">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </DashboardPage>
    );
  }

  // The header states WHICH campaign is open, and nothing else. It names the
  // campaign as what it IS — the sales funnel it buys × the acquisition channel
  // it buys through — rather than campaign-service's stored `name`, which was
  // written at provision time and predates the per-funnel model, so it says
  // nothing about either. The heading is the campaign's NAME and nothing else.
  //
  // There is NO run-status bar here any more, and no budget on the page at all. The bar
  // stated three BRAND-level things — the retired optimization goal, the brand pause flag
  // and the brand's daily budget — on a page scoped to ONE campaign and ONE funnel: the
  // goal word cannot even name which of the two meeting funnels this is, and the dollar
  // figure is billing's SUM of every funnel's ceiling, not this campaign's. Money is
  // funded per sales funnel on Brand Settings, which is also how a funnel is paused:
  // drop its ceiling to zero. `effectiveBudgetCents` still resolves the campaign's own
  // override for the cost card's denominator.
  //
  // It used to carry a `Campaigns /` back-link alongside, restated a few pixels
  // above by the top bar, which already links back to the list
  // (HeaderPageContext). Printing it twice on one screen is the duplication this
  // repo treats as a bug. The surface is GA, so there is no maturity badge here
  // nor on the nav entry.
  const CampaignHeader = (
    <h1 className="font-display flex min-w-0 items-center text-xl font-bold text-gray-800">
      {campaign ? <CampaignTitle campaign={campaign} size="sm" /> : "Campaign"}
    </h1>
  );

  if (revenueRevealed && data && data.totalPipelineUsd === null) {
    return (
      <DashboardPage width="wide" className="space-y-4">
        {CampaignHeader}
        {showFirstOutcomeReassurance && (
        <FirstOutcomeReassuranceBanner
          subject="This campaign"
          goal={optimizationGoal}
        />
      )}
        <RevenueEmptyState />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage width="wide" className="space-y-4">
      {CampaignHeader}
      {showFirstOutcomeReassurance && (
        <FirstOutcomeReassuranceBanner
          subject="This campaign"
          goal={optimizationGoal}
        />
      )}
      <RevenueOverviewSection
        data={revenueRevealed ? data : undefined}
        pipelineActivity={activityRevealed ? mergedPipelineActivity : undefined}
        pipelineActualSeries={activityRevealed ? pipelineActualSeries : undefined}
        optimizationGoal={optimizationGoal}
        funnelKey={campaignFunnelKey}
        trackerSetUp={trackerSetUp}
        visitToMeetingPct={visitToMeetingPct}
        visitToSignupPct={visitToSignupPct}
        revenuePending={!revenueRevealed}
        activityPending={!activityRevealed}
        expectedOutcome={
          outcomeRevealed
            ? {
                value: expectedMonthlyOutcome,
              }
            : undefined
        }
        costPending={!costRevealed}
        todayCostPending={!costRevealed}
        brandId={brandId}
        featureSlug={featureSlug}
        basePath={basePath}
        costBottomCard={
          <TopAudiencesCard
            data={audienceStatsRevealed ? audienceStatsData : undefined}
            audiences={audienceStatsRevealed ? displayAudiences : undefined}
            pending={!audienceStatsRevealed}
            metric={audienceStatsMetric}
            // One campaign sells one funnel, so its own step IS what it buys —
            // the per-outcome cost stays here and is dropped at brand level.
            campaignScoped
          />
        }
        topRow={
          <OutreachStatCards
            stats={featureStats}
            spend={revenueRevealed ? data?.spend : null}
            pending={!(statsRevealed && revenueRevealed)}
            optimizationGoal={optimizationGoal}
            funnelKey={campaignFunnelKey}
            outreachOverride={outreachTotal}
          />
        }
      />
    </DashboardPage>
  );
}
