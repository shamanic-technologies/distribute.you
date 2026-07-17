"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ClockIcon } from "@heroicons/react/20/solid";
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
  isVisitDrivenGoal,
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
import { useIsAdminUser } from "@/lib/use-admin-user";
import {
  selectWorkflowForOptimizationGoal,
  workflowOutcomeUnitCost,
} from "@/lib/workflow-projection-choice";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { RevenueEmptyState } from "@/components/revenue/revenue-empty-state";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { TopAudiencesCard } from "@/components/revenue/top-audiences-card";
import { BrandStatusControl } from "@/components/brand/brand-status-control";
import { MaturityBadge } from "@/components/maturity-badge";
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

function FirstClickReassuranceBanner() {
  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-slate-700 shadow-sm">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-cyan-700 ring-1 ring-cyan-200">
          <ClockIcon className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-slate-900">This campaign is running.</p>
          <p className="mt-0.5 leading-6">
            We are sending and learning from the first leads. It can take a week or two before
            the first website clicks appear here.
          </p>
        </div>
      </div>
    </div>
  );
}

export function CampaignOverviewPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const campaignId = params.id as string;
  const isAdmin = useIsAdminUser();
  const featureSlug = useSoleFeatureSlug();
  const enabled = isRevenueFeature(featureSlug) && isAdmin;
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
    { enabled: isAdmin, ...pollOptions },
  );
  const brand = brandData?.brand ?? null;

  // Campaign identity (name for the header). Staff-only.
  const { data: campaignData, isPending: campaignLoading } = useAuthQuery(
    ["campaign", campaignId],
    () => getCampaign(campaignId),
    { enabled: isAdmin, ...pollOptions },
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
  const optimizationGoal =
    economicsData?.salesEconomics?.optimizationGoal ?? "sales_meetings";
  const visitToMeetingPct =
    economicsData?.salesEconomics?.visitToMeetingPct ?? DEFAULT_VISIT_TO_MEETING_PCT;
  const visitToSignupPct =
    economicsData?.salesEconomics?.visitToSignupPct ?? DEFAULT_VISIT_TO_SIGNUP_PCT;
  const audienceStatsGoal = isVisitDrivenGoal(optimizationGoal) ? "signup" : "meetingBooked";
  const audienceStatsMetric = audienceStatsGoal === "signup" ? "cpc" : "cppr";

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

  const expectedMonthlyOutcome = useMemo(() => {
    if (monthlyBudgetUsd == null || monthlyBudgetUsd <= 0 || activeOutcomeWorkflow == null) {
      return null;
    }
    const unitCost = workflowOutcomeUnitCost(activeOutcomeWorkflow, optimizationGoal, {
      visitToSignupPct: economicsData?.salesEconomics?.visitToSignupPct,
      replyToMeetingPct: economicsData?.salesEconomics?.replyToMeetingPct,
      visitToMeetingPct: economicsData?.salesEconomics?.visitToMeetingPct,
      projectionBudgetUsd: monthlyBudgetUsd,
    });
    return unitCost != null && unitCost > 0 ? monthlyBudgetUsd / unitCost : null;
  }, [
    activeOutcomeWorkflow,
    economicsData?.salesEconomics?.replyToMeetingPct,
    economicsData?.salesEconomics?.visitToMeetingPct,
    economicsData?.salesEconomics?.visitToSignupPct,
    monthlyBudgetUsd,
    optimizationGoal,
  ]);

  const { data: audienceStatsData, isError: audienceStatsIsError } = useAuthQuery(
    ["featureAudienceStats", featureSlug, brandId, audienceStatsGoal],
    () => fetchFeatureAudienceStats(featureSlug, {
      brandId,
      goal: audienceStatsGoal,
      limit: 3,
    }),
    { enabled, ...pollOptions },
  );

  const { data: audiencesData, isError: audiencesIsError } = useAuthQuery(
    ["audiences", brandId],
    () => listAudiences(brandId),
    { enabled, ...pollOptions },
  );
  const activeAudiences = audiencesData?.audiences.filter((a) => a.status === "active");

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
  const showFirstClickReassurance =
    statsRevealed && totalWebsiteClicks < 1 && !isBrandPaused;

  const basePath = `/orgs/${orgId}/brands/${brandId}`;
  const campaignsPath = `${basePath}/campaigns`;

  if (!isAdmin) {
    return (
      <DashboardPage width="wide">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This preview is staff-only.
        </div>
      </DashboardPage>
    );
  }

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

  const CampaignHeader = (
    <div className="flex items-center gap-2">
      <Link href={campaignsPath} className="text-sm text-gray-400 hover:text-gray-600">
        Campaigns
      </Link>
      <span className="text-gray-300">/</span>
      <h1 className="font-display text-xl font-bold text-gray-800">
        {campaign?.name ?? "Campaign"}
      </h1>
      <MaturityBadge level="beta" />
    </div>
  );

  if (revenueRevealed && data && data.totalPipelineUsd === null) {
    return (
      <DashboardPage width="wide" className="space-y-4">
        {CampaignHeader}
        <BrandStatusControl brandId={brandId} />
        {showFirstClickReassurance && <FirstClickReassuranceBanner />}
        <RevenueEmptyState />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage width="wide" className="space-y-4">
      {CampaignHeader}
      {showFirstClickReassurance && <FirstClickReassuranceBanner />}
      <RevenueOverviewSection
        data={revenueRevealed ? data : undefined}
        pipelineActivity={activityRevealed ? mergedPipelineActivity : undefined}
        pipelineActualSeries={activityRevealed ? pipelineActualSeries : undefined}
        optimizationGoal={optimizationGoal}
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
        dailyBudgetCents={budgetData?.dailyBudgetCents ?? null}
        brandId={brandId}
        featureSlug={featureSlug}
        basePath={basePath}
        headerAction={<BrandStatusControl brandId={brandId} />}
        costBottomCard={
          <TopAudiencesCard
            data={audienceStatsRevealed ? audienceStatsData : undefined}
            audiences={audienceStatsRevealed ? activeAudiences : undefined}
            pending={!audienceStatsRevealed}
            metric={audienceStatsMetric}
          />
        }
        topRow={
          <OutreachStatCards
            stats={featureStats}
            spend={revenueRevealed ? data?.spend : null}
            pending={!(statsRevealed && revenueRevealed)}
            optimizationGoal={optimizationGoal}
            outreachOverride={outreachTotal}
          />
        }
        conversions={null}
      />
    </DashboardPage>
  );
}
