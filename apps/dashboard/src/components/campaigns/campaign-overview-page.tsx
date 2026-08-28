"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { goalForFunnelKey } from "@/lib/sales-funnels";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBrand,
  getBrandFunnelBudgets,
  getCampaign,
  getFeatureRevenue,
  fetchFeatureStats,
  getBrandSalesEconomics,
  getBrandConversionToken,
  getFeaturePipelineActivity,
  fetchFeatureAudienceStats,
  listAudiences,
  getWorkflowProjection,
  optimizationGoalForRuntimeGoal,
  type BrandOptimizationGoal,
  salesObjectiveForOptimizationGoal,
  keepLastGoodWorkflowProjection,
  keepLastGoodFeatureRevenue,
  type PipelineActivityMetric,
  type WorkflowProjectionResponse,
} from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";
import { pollOptions } from "@/lib/query-options";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { tenantBasePath } from "@/lib/offer-path";
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
import { CampaignControlsTrigger } from "@/components/campaigns/campaign-controls-trigger";
import { useRunningDailyBudgetCents } from "@/lib/use-running-daily-budget";
import { campaignBudgetCents } from "@/lib/campaign-budget";
import { DashboardPage } from "@/components/dashboard-page";
import { Skeleton } from "@/components/skeleton";
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
  // A campaign lives under the OFFER it sells, so every link it builds climbs to
  // the offer, never to the brand two levels up.
  const offerId = params.offerId as string | undefined;
  const campaignId = params.id as string;
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

  // This campaign's OWN daily ceiling, read-only. billing keys a ceiling on
  // (org, brand, funnel, channel, offer), which is exactly what a campaign is, so
  // this is the campaign's money and not a brand-wide sum wearing its name — the
  // figure that used to sit here and had to go. The key is the one Campaign
  // Settings and the Campaigns table already read, so all three share one request
  // and the header can never state a ceiling the settings page would not edit.
  const { data: funnelBudgets } = useAuthQuery(
    ["brandFunnelBudgets", brandId],
    () => getBrandFunnelBudgets(brandId),
    { ...pollOptions },
  );
  const channels = useAcquisitionChannels();
  const campaignBudgetCentsValue = campaign
    ? campaignBudgetCents(campaign, campaign.offerId ?? undefined, funnelBudgets, channels)
    : null;

  // The channel THIS campaign runs on — read off the campaign, never resolved from
  // the brand's sole feature.
  //
  // A campaign IS (offer x funnel x channel), and an offer is sold through several
  // channels at once. Asking the brand for "its" feature returns whichever single
  // one is GA, so every read on this page was scoped to a channel the open campaign
  // may not even run on: a campaign on the brand's second channel had its spend,
  // its stats and its audiences fetched for the FIRST one, which does not carry it —
  // so the page answered `$0 spent today` for a campaign that had committed $10.32
  // that day, while the list one click away read it correctly. Two surfaces, one
  // campaign, two numbers, and neither erroring.
  //
  // The campaign read above already carries the answer, so this costs no request.
  const featureSlug = campaign?.featureSlug ?? null;
  // Gated on the channel CATALOGUE, not on the brand's revenue-feature set: that set
  // decides which features get a revenue page on a BRAND-scoped surface, and this
  // page is scoped to one campaign. A campaign sells a funnel through a channel, so
  // it has money to show whichever channel it is — and gating on the brand's GA
  // feature is what would blank this page for a campaign on any other one.
  const isChannelCampaign = acquisitionChannelForFeatureSlug(featureSlug, channels) !== null;
  // Never fire under a GUESSED slug: until the campaign resolves we do not know its
  // channel, and a read fired on the wrong one lands in that channel's cache entry.
  const enabled = featureSlug !== null && isChannelCampaign;

  // Revenue + conversions SCOPED TO THE CAMPAIGN. Byte-equal key to
  // OutreachStatCardsAuto's campaign-scoped key → one deduped poll.
  const { data, isError: revenueIsError } = useAuthQuery(
    ["featureRevenue", brandId, featureSlug, "campaign", campaignId],
    () => getFeatureRevenue(featureSlug!, brandId, { campaignId }),
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
    () => getFeaturePipelineActivity(featureSlug!, { brandId, days: 7, timezone }),
    { enabled, ...pollOptions },
  );

  const outreachSeries = data?.sequences ?? data?.outreachContacted;
  const outreachTotal = outreachSeries?.total ?? null;
  // A lead is contacted ONCE and outreached as many times as its sequence has steps, so
  // the campaign states both: `contactedRecipients` is the funnel's own base (the number
  // its first rung converts from, so the card and the share below it agree by
  // construction), and `outreachTotal` above is the undeduped volume that tracks spend.
  const leadsContacted = data?.funnelSteps?.contactedRecipients ?? null;
  // What share of the contacted leads showed sales interest — SERVED as the first rung's
  // conversion off the contacted base, never divided here. Gated on that rung being the
  // sales-interest one AND converting FROM `Contacted`: a rung deeper in the funnel
  // states a share of the rung before it, which is a different sentence.
  const firstRung = data?.funnelSteps?.steps?.[0];
  const salesInterestSharePct =
    firstRung?.leadField === "repliedPositive" && firstRung.fromStep === "Contacted"
      ? firstRung.conversionFromPreviousPct
      : null;
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
    () => fetchFeatureStats(featureSlug!, { campaignId }),
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
  // The campaign's OWN goal, from campaign-service — NOT the brand column, which is
  // retired and would name a funnel this campaign never ran. Null when a campaign
  // predates the field; the funnel it states is the richer answer anyway, and every
  // step surface here already prefers it.
  // The funnel a campaign states it sells — the richer answer, and what every step
  // surface here prefers.
  const campaignFunnelKey = campaign?.funnelKey ?? null;
  const optimizationGoal: BrandOptimizationGoal = campaign?.goal
    ? optimizationGoalForRuntimeGoal(campaign.goal)
    : campaignFunnelKey
      ? goalForFunnelKey(campaignFunnelKey)
      : "sales_meetings";
  // What this campaign actually SELLS, read off the campaign row. It is the richer of the
  // two fields: `sales_meetings` covers both meeting funnels, so the goal alone cannot say
  // whether the funnel starts at a positive reply or at a click onto the site — and every
  // step-labelled surface below (stat cards, activity bars, the Outcome line) needs to
  // know. NULL on a pre-funnel campaign, which correctly falls back to the goal.
  const visitToMeetingPct =
    economicsData?.salesEconomics?.visitToMeetingPct ?? DEFAULT_VISIT_TO_MEETING_PCT;
  const visitToSignupPct =
    economicsData?.salesEconomics?.visitToSignupPct ?? DEFAULT_VISIT_TO_SIGNUP_PCT;
  // One shared mapping with the brand Overview + Audiences page — see goalForOptimizationGoal.
  const audienceStatsGoal = goalForOptimizationGoal(optimizationGoal);

  // What the BRAND may spend today — its RUNNING campaigns' ceilings. billing's
  // own served brand total answered this until now and it is status-BLIND
  // (billing keys ceilings on the triple and stores no status), so a paused
  // sibling campaign's money stayed in the month this page projects from.
  const { cents: runningDailyBudgetCents, settled: budgetSettled } =
    useRunningDailyBudgetCents(brandId, { enabled });

  // What THIS campaign may spend today. Same query key as the brand-level read one line
  // up — the producer decomposes its answer per campaign, so this costs no request — but
  // a banner headed "This campaign" must gate on this campaign, not on its brand's sum:
  // a sibling campaign spending elsewhere says nothing about the one on screen.
  const { cents: campaignRunningDailyBudgetCents } = useRunningDailyBudgetCents(brandId, {
    campaignId,
    enabled,
  });

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
    runningDailyBudgetCents != null && runningDailyBudgetCents > 0
      ? (runningDailyBudgetCents / 100) * 30
      : null;

  const { data: outcomeProjection, isError: outcomeIsError } = useAuthQuery(
    [
      "workflowProjection",
      brandId,
      featureSlug,
      "overview-outcome",
      campaignFunnelKey ?? optimizationGoal,
      monthlyBudgetUsd,
      economicsData?.salesEconomics?.updatedAt ?? "no-economics",
    ],
    () =>
      getWorkflowProjection({
        featureSlug: featureSlug!,
        brandId,
        objective: salesObjectiveForOptimizationGoal(optimizationGoal),
        // A campaign runs exactly ONE funnel, so it states it — same param the
        // audience-stats read above already sends. Without it the projection is
        // priced from BOTH channels at once (`clicks·visitToMeeting +
        // replies·replyToMeeting`), which on a conversation-led campaign forecasts
        // the website funnel it does not sell.
        ...(campaignFunnelKey ? { funnel: campaignFunnelKey } : {}),
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
    // and would price a reply-driven funnel against clicks it never buys. A campaign that
    // predates the funnel keeps the goal.
    () => fetchFeatureAudienceStats(featureSlug!, {
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
    budgetSettled,
    economicsData !== undefined || economicsIsError,
    monthlyBudgetUsd == null || outcomeProjection !== undefined || outcomeIsError,
  ]);
  // Mirrors the brand Overview: the banner names this goal's outcome, so it hides on
  // that outcome (not on an unrelated click) and retires once the learning budget is
  // spent. The outcome count rides `/revenue`, so it reveals with revenue too.
  const recommendedLearningUsd = recommendedLearningSpendUsd(outcomeUnitCostUsd);
  const showFirstOutcomeReassurance = shouldShowReassurance({
    revealed: statsRevealed && revenueRevealed,
    // This campaign's own running money, not campaign-service's brand-level pause flag:
    // nothing has written that flag since the brand-level Pause control was removed, so
    // it is frozen and wrong both ways — it hid this banner from campaigns that are
    // spending today, and showed it beside campaigns that are not running at all.
    runningDailyBudgetCents: campaignRunningDailyBudgetCents,
    outcomeCount: goalOutcomeCount(optimizationGoal, data?.spend, totalWebsiteClicks),
    recommendedSpendUsd: recommendedLearningUsd,
    spentUsd: data?.spend?.totalSpentCents != null ? data.spend.totalSpentCents / 100 : null,
  });

  const basePath = tenantBasePath(orgId, brandId, offerId);
  const campaignsPath = `${basePath}/campaigns`;

  // The BRAND-level daily-budget read below is the outcome forecast's, and only
  // that: billing answers it with the SUM of every funnel's ceiling, which is the
  // right number for "what does the money buy per month" and the wrong one to
  // print under one campaign's name. The header's ceiling is a different read at
  // a different grain — billing's (offer x funnel x channel) row, this campaign's
  // own — and the two must not be confused for each other.
  //
  // campaign-service's own per-campaign budget column stays out of both: it is a
  // mirror nothing edits, so it is machinery rather than a number for a screen.

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

  // The campaign resolved and runs on something this app has no channel for. Gated
  // on the campaign's OWN channel, so a campaign on the brand's second (or third)
  // channel renders exactly like one on its first — keying this on the brand's sole
  // GA feature is what would blank the page for every campaign but one.
  if (!campaignLoading && !isChannelCampaign) {
    return (
      <DashboardPage width="wide">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-sm text-gray-400">
          This view isn&apos;t available yet.
        </div>
      </DashboardPage>
    );
  }

  // This page states NO campaign identity of its own — there is no heading here.
  // The top bar (HeaderPageContext) already names the open campaign as what it
  // IS, the sales funnel it buys × the acquisition channel it buys through, with
  // both marks, off the same `["campaign", id]` query this page polls. An h1
  // repeating it printed one statement twice, a few pixels apart, which is the
  // duplication this repo treats as a bug — the same reason the `Campaigns /`
  // back-link went, the bar already links back to the list. A campaign is named
  // ONCE per screen, in the bar, because that is the part that survives every
  // sub-route of the campaign rather than only its Overview.
  //
  // There is NO run-status bar here any more. That bar stated three BRAND-level
  // things — the retired optimization goal, the brand pause flag and the brand's
  // daily budget — on a page scoped to ONE campaign and ONE funnel: the goal word
  // cannot even name which of the two meeting funnels this is, and its dollar
  // figure was billing's SUM of every funnel's ceiling rather than this
  // campaign's. What replaced it is neither of those: billing now keys a ceiling
  // on (offer x funnel x channel), which is exactly what a campaign is, so the
  // figure on the right is the campaign's own money and the pill is the
  // campaign's own status. Nothing here is editable, and campaign-service's own
  // budget column is still nowhere on the page.
  //
  // The surface is GA, so there is no maturity badge here nor on the nav entry.
  //
  // What the page DOES state, on the SAME ROW as the section heading and to its
  // right, is this campaign's own daily ceiling and its own status. It rides the
  // heading through `RevenueOverviewSection`'s `headerAction` slot rather than
  // standing as a band of its own above it: a full-width line over the title
  // reads as a second heading, and this is an attribute of what the heading names
  // rather than a statement one level up from it. Neither duplicates the top bar:
  // the bar names WHICH campaign is open, this says whether it is running and what
  // it may spend while it does. The ceiling is billing's (offer x funnel x channel) row, which
  // is exactly what a campaign is, so it is this campaign's money rather than the
  // brand-wide sum the old run-status bar printed.
  //
  // It is also the way IN to changing both, through the shared controls modal —
  // the same one the brand and offer Overviews open, scoped here to one row. That
  // is not the old editor-in-the-header coming back: the header renders no field
  // and holds no mutation, and the modal writes through the SAME narrowing
  // (`campaignBudgetScope` / `campaignSavedCents`) that Offer Settings and
  // Campaign Settings read. Several windows onto one number are fine; a second
  // narrowing is not, which is why that rule lives in `lib/campaign-budget.ts`
  // alone.
  //
  // Status and budget stay two INDEPENDENT answers. Pausing flips
  // campaign-service's own status and leaves the ceiling untouched, so the amount
  // survives and restarting is one click — stopping a campaign by dropping its
  // ceiling to zero would throw the figure away, and billing's per-funnel floor
  // would then refuse to put a grandfathered campaign back where it was.
  const CampaignStatusLine = campaign ? (
    <CampaignControlsTrigger
      brandId={brandId}
      campaignId={campaign.id}
      totalCentsOverride={campaignBudgetCentsValue}
    />
  ) : null;

  if (revenueRevealed && data && data.totalPipelineUsd === null) {
    return (
      <DashboardPage width="wide" className="space-y-4">
          {showFirstOutcomeReassurance && (
        <FirstOutcomeReassuranceBanner
          subject="This campaign"
          goal={optimizationGoal}
        />
      )}
        {/* No section header on this branch to sit beside, so the line stands
            on its own here — everywhere else it rides the Outreach heading. */}
        {CampaignStatusLine}
        <RevenueEmptyState />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage width="wide" className="space-y-4">
      {showFirstOutcomeReassurance && (
        <FirstOutcomeReassuranceBanner
          subject="This campaign"
          goal={optimizationGoal}
        />
      )}
      <RevenueOverviewSection
        headerAction={CampaignStatusLine}
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
            contactedOverride={leadsContacted}
            outreachLabel="Outreaches"
            signalSharePct={salesInterestSharePct}
          />
        }
      />
    </DashboardPage>
  );
}
