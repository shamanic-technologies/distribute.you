"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ClockIcon } from "@heroicons/react/20/solid";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  getFeatureRevenue,
  getBrandCostBreakdown,
  fetchFeatureStats,
  getBrandSalesEconomics,
  getBrandDailyBudget,
  getBrandPause,
  getFeaturePipelineActivity,
  fetchFeatureAudienceStats,
  listAudiences,
  getWorkflowProjection,
  keepLastGoodWorkflowProjection,
  keepLastGoodFeatureRevenue,
  type PipelineActivityMetric,
  type WorkflowProjectionResponse,
} from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";
import { pollOptions, pollOptionsSlow } from "@/lib/query-options";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import {
  selectWorkflowForOptimizationGoal,
  workflowOutcomeUnitCost,
} from "@/lib/workflow-projection-choice";
import { RevenueOverviewSection } from "@/components/revenue/revenue-overview-section";
import { RevenueEmptyState } from "@/components/revenue/revenue-empty-state";
import { OutreachStatCards } from "@/components/revenue/outreach-stat-cards";
import { TopAudiencesCard } from "@/components/revenue/top-audiences-card";
import { BrandStatusControl } from "@/components/brand/brand-status-control";
import { DashboardPage } from "@/components/dashboard-page";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";

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
          <p className="font-medium text-slate-900">Your campaign is running.</p>
          <p className="mt-0.5 leading-6">
            We are sending and learning from the first leads. It can take a day or two before
            the first website clicks appear here.
          </p>
        </div>
      </div>
    </div>
  );
}

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
  const todayCostWindow = useMemo(() => {
    const startedAfter = new Date();
    startedAfter.setHours(0, 0, 0, 0);
    const startedBefore = new Date(startedAfter);
    startedBefore.setDate(startedAfter.getDate() + 1);
    return {
      startedAfter: startedAfter.toISOString(),
      startedBefore: startedBefore.toISOString(),
    };
  }, [timezone]);

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
    {
      enabled,
      ...pollOptionsSlow,
      // Keep the last-good `outreachContacted` (Outreach card + graph-actual source)
      // across a transient degenerate refetch that drops it on a valid 200.
      structuralSharing: (prev, next) =>
        keepLastGoodFeatureRevenue(
          prev as RevenueOverview | undefined,
          next as RevenueOverview,
        ),
    },
  );

  const { data: pipelineActivity } = useAuthQuery(
    ["featurePipelineActivity", brandId, featureSlug, timezone],
    () => getFeaturePipelineActivity(featureSlug, { brandId, days: 7, timezone }),
    { enabled, ...pollOptions },
  );

  // ── Single-source graph ACTUALS (features-service#371/#372/#377) ───────────
  // The stat cards, graph actual bars and conversions table now read the SAME
  // `/revenue` snapshot aggregates. Forecast/expected values stay from
  // pipeline-activity. Each server series is optional during backend rollout:
  // absent series keep the legacy pipeline-activity actual for that metric.
  const contactedTotal = data?.outreachContacted?.total ?? null;
  const mergedPipelineActivity = useMemo(() => {
    if (!pipelineActivity) return undefined;
    const contactedByDay = countByDay(data?.outreachContacted);
    const openedByDay = countByDay(data?.opened);
    const clickedByDay = countByDay(data?.clicked);
    const meetingsByDay = countByDay(data?.meetingsBooked);
    if (!contactedByDay && !openedByDay && !clickedByDay && !meetingsByDay) {
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
            actualFrom(contactedByDay, day.date, day.metrics.outreach.actual),
          ),
          opens: withActual(
            day.metrics.opens,
            actualFrom(openedByDay, day.date, day.metrics.opens.actual),
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
    outreach: data?.outreachContacted,
    opens: data?.opened,
    clicks: data?.clicked,
    signups: data?.clicked,
    repliedPositive: data?.repliedPositive,
    salesMeetings: data?.meetingsBooked,
  }), [data]);

  // Cost breakdown (runs-service) → total spend + top-3 provider sources for the
  // Cost & efficiency card. Shares the Campaigns page's query key + 5s cadence so
  // both observers refetch the shared cache entry together (identical source mix).
  const { data: costData } = useAuthQuery(
    ["brandCostBreakdown", { brandId, featureSlug }],
    () => getBrandCostBreakdown(brandId, { featureSlug }),
    { enabled, ...pollOptions },
  );

  const { data: todayCostData } = useAuthQuery(
    ["brandCostBreakdownToday", { brandId, featureSlug, ...todayCostWindow }],
    () => getBrandCostBreakdown(brandId, { featureSlug, ...todayCostWindow }),
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
  const totalWebsiteClicks = featureStats.recipientsClicked ?? 0;

  // Brand goal config → goal-specific stat card copy.
  const { data: economicsData } = useAuthQuery(
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
  const audienceStatsGoal = optimizationGoal === "signups" ? "signup" : "meetingBooked";
  const audienceStatsMetric = audienceStatsGoal === "signup" ? "cpc" : "cppr";

  const { data: budgetData } = useAuthQuery(
    ["brandDailyBudget", brandId],
    () => getBrandDailyBudget(brandId),
    { enabled, ...pollOptions },
  );

  // Pause state — shares BrandStatusControl's query key so both observers hit one
  // cache entry. A paused brand holds (doesn't run) its campaigns, so the
  // "campaign is running" reassurance banner must not show while paused.
  const { data: pauseData } = useAuthQuery(
    ["brandPause", brandId],
    () => getBrandPause(brandId),
    { enabled, ...pollOptions },
  );
  const isBrandPaused = pauseData?.paused === true;
  const monthlyBudgetUsd =
    budgetData?.dailyBudgetCents != null && budgetData.dailyBudgetCents > 0
      ? (budgetData.dailyBudgetCents / 100) * 30
      : null;

  const { data: outcomeProjection } = useAuthQuery(
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
        objective: optimizationGoal === "signups" ? "self-serve" : "meeting-booked",
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

  // Real audience-level cost evidence from features-service. This replaces the
  // old provider-cost-source list; no dashboard-side mock/hash audience split.
  const { data: audienceStatsData } = useAuthQuery(
    ["featureAudienceStats", featureSlug, brandId, audienceStatsGoal],
    () => fetchFeatureAudienceStats(featureSlug, {
      brandId,
      goal: audienceStatsGoal,
      limit: 3,
    }),
    { enabled, ...pollOptions },
  );

  const { data: audiencesData } = useAuthQuery(
    ["audiences", brandId],
    () => listAudiences(brandId),
    { enabled, ...pollOptions },
  );
  const activeAudiences = audiencesData?.audiences.filter((a) => a.status === "active");

  // Per-card reveal (NOT one page-wide barrier): revenue (features-service) and
  // total/today spend (runs-service) are separate cold chains — gate each on its
  // own query so the fast cost figures aren't held by the slower revenue call.
  const revenueRevealed = useCoordinatedReveal([data !== undefined]);
  // Graph reveals with revenue too — its actual outreach series is sourced from
  // `/revenue` (mergedPipelineActivity), so it must wait for `data` to avoid a
  // backend-then-/revenue flip on the outreach bar.
  const activityRevealed = useCoordinatedReveal([
    pipelineActivity !== undefined,
    economicsData !== undefined,
    data !== undefined,
  ]);
  const costRevealed = useCoordinatedReveal([costData !== undefined]);
  const todayCostRevealed = useCoordinatedReveal([todayCostData !== undefined]);
  const statsRevealed = useCoordinatedReveal([featureStatsData !== undefined]);
  const audienceStatsRevealed = useCoordinatedReveal([
    audienceStatsData !== undefined,
    audiencesData !== undefined,
  ]);
  const outcomeRevealed = useCoordinatedReveal([
    budgetData !== undefined,
    economicsData !== undefined,
    monthlyBudgetUsd == null || outcomeProjection !== undefined,
  ]);
  const showFirstClickReassurance =
    statsRevealed && totalWebsiteClicks < 1 && !isBrandPaused;

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
        {showFirstClickReassurance && <FirstClickReassuranceBanner />}
        <RevenueEmptyState />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage width="wide" className="space-y-4">
      {showFirstClickReassurance && <FirstClickReassuranceBanner />}
      <RevenueOverviewSection
        data={revenueRevealed ? data : undefined}
        pipelineActivity={activityRevealed ? mergedPipelineActivity : undefined}
        pipelineActualSeries={activityRevealed ? pipelineActualSeries : undefined}
        optimizationGoal={optimizationGoal}
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
        costBreakdown={costData?.costs ?? []}
        todayCostPending={!todayCostRevealed}
        todayCostBreakdown={todayCostData?.costs ?? []}
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
          /* Outreach stat cards (GA + beta) — under the "Revenue & Conversions"
             header, directly above the Pipeline-revenue hero. Goal-specific copy
             and beta outcome pair. */
          <OutreachStatCards
            stats={featureStats}
            totalCostCents={totalCostCents}
            pending={!(statsRevealed && revenueRevealed)}
            optimizationGoal={optimizationGoal}
            outreachOverride={contactedTotal}
          />
        }
        conversions={null}
      />
    </DashboardPage>
  );
}
