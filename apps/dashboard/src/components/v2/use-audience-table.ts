"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useScopedFeatureSlug } from "@/lib/scoped-feature-slug";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  fetchFeatureAudienceStats,
  generateAudienceAvatar,
  getBrandConversionToken,
  listAudiences,
  optimizationGoalForRuntimeGoal,
  setAudienceStatus,
  type AudienceStatus,
  type AudienceWire,
  type BrandOptimizationGoal,
  type FeatureAudienceStatsGoal,
  type FeatureAudienceStatsRow,
} from "@/lib/api";
import { audienceRankMetric, goalForOptimizationGoal } from "@/lib/strategy-model";
import { useCampaignLeg } from "@/lib/use-leg-catalogue";
import { legColumnPair, legPairIsAvailable, legRankMetric } from "@/lib/campaign-leg-columns";
import { goalForLeg, stepsFor } from "@/lib/goal-steps";
import { isRunningStatus } from "@/lib/campaign-controls";
import { useScopePaused } from "@/lib/use-scope-paused";
import { audienceColumns, type AudienceSortCol } from "@/lib/audience-table-model";

const VISIBLE_AUDIENCE_STATUSES = ["active", "paused", "archived", "suggested"] as const;

/**
 * Everything v1's audience table READS and WRITES, for the v2 table to draw.
 *
 * The same readers, the same query keys (so v1 and v2 share one cache entry and one
 * poll), the same mutations and invalidations, and the same column decisions:
 * a brand or offer states MONEY, a campaign states its own leg's outcome pair. This is
 * v1's `CustomerAudiencesPage` wiring lifted out of its markup; nothing here computes a
 * figure the producer does not serve.
 */
export function useAudienceTable({
  campaignId,
  offerId: offerIdProp,
  includeSuggested = false,
}: {
  campaignId?: string;
  offerId?: string;
  /** Also list the audiences suggested at onboarding and never activated (the offer's Targeting). */
  includeSuggested?: boolean;
}) {
  const campaignScoped = Boolean(campaignId);
  const { campaign, featureSlug, settled: scopeSettled } = useScopedFeatureSlug(campaignId);
  const channels = useAcquisitionChannels();
  const revenueOk =
    featureSlug === null
      ? !scopeSettled
      : campaignScoped
        ? acquisitionChannelForFeatureSlug(featureSlug, channels) !== null
        : isRevenueFeature(featureSlug);
  const params = useParams();
  const brandId = params.brandId as string;
  const offerId = offerIdProp ?? (params.offerId as string | undefined);
  const queryClient = useQueryClient();

  const active = useAuthQuery(
    ["audiences", brandId, "active", offerId ?? "brand"],
    () => listAudiences(brandId, { status: "active", offerId }),
    pollOptions,
  );
  const paused = useAuthQuery(
    ["audiences", brandId, "paused", offerId ?? "brand"],
    () => listAudiences(brandId, { status: "paused", offerId }),
    pollOptions,
  );
  const archived = useAuthQuery(
    ["audiences", brandId, "archived", offerId ?? "brand"],
    () => listAudiences(brandId, { status: "archived", offerId }),
    pollOptions,
  );
  const suggested = useAuthQuery(
    ["audiences", brandId, "suggested", offerId ?? "brand"],
    () => listAudiences(brandId, { status: "suggested", offerId }),
    { enabled: includeSuggested, ...pollOptions },
  );

  const campaignLeg = useCampaignLeg(campaign);
  const campaignPaused = campaign != null && !isRunningStatus(campaign.status);
  const { paused: scopePaused } = useScopePaused(brandId, { offerId });
  const withheldPaused = campaignPaused || scopePaused;

  const optimizationGoal: BrandOptimizationGoal = campaign?.goal
    ? optimizationGoalForRuntimeGoal(campaign.goal)
    : (goalForLeg(campaignLeg) ?? "sales_meetings");

  const { data: conversionTokenData } = useAuthQuery(
    ["brandConversionToken", brandId],
    () => getBrandConversionToken(brandId),
    pollOptions,
  );
  const trackerSetUp = conversionTokenData?.status === "live" || conversionTokenData?.status === "live_waiting";
  const audienceStatsGoal: FeatureAudienceStatsGoal = goalForOptimizationGoal(optimizationGoal);
  const scopeSteps = stepsFor(optimizationGoal, campaignLeg);
  const hasStep = (key: string) => scopeSteps.some((step) => step.key === key);
  const legPair = campaignScoped ? legColumnPair(campaignLeg) : null;
  const legScoped = legPairIsAvailable(legPair, trackerSetUp);
  const brandLevelMoney = !campaignScoped;

  const showSignupCols = legScoped ? legPair === "signup" : optimizationGoal === "signups" && trackerSetUp && !brandLevelMoney;
  const showFormSubmissionCols = legScoped
    ? legPair === "formSubmission"
    : optimizationGoal === "form_submissions" && trackerSetUp && !brandLevelMoney;
  const showSaleCols = legScoped
    ? legPair === "sale"
    : (optimizationGoal === "sales" || optimizationGoal === "website_purchase") && trackerSetUp && !brandLevelMoney;
  const showReplyCols = legScoped
    ? legPair === "reply"
    : (hasStep("positive_replies") || optimizationGoal === "sales") && !brandLevelMoney;
  const showVisitCols = legScoped ? legPair === "visit" : hasStep("website_visits") && !brandLevelMoney;

  const defaultSortCol: AudienceSortCol = brandLevelMoney
    ? "roi"
    : (legScoped ? legRankMetric(campaignLeg) : null) ?? audienceRankMetric(optimizationGoal, trackerSetUp);
  const defaultSortDir: "asc" | "desc" = brandLevelMoney ? "desc" : "asc";

  const columns = audienceColumns({
    brandLevelMoney,
    campaignScoped,
    showSaleCols,
    showReplyCols,
    showSignupCols,
    showFormSubmissionCols,
    showVisitCols,
  });

  const campaignScopeKey = campaignId ?? offerId ?? "brand-wide";
  const stats = useAuthQuery(
    [
      "featureAudienceStats",
      featureSlug,
      brandId,
      brandLevelMoney ? "brand-return" : campaign?.legKey ?? audienceStatsGoal,
      "all-statuses",
      campaignScopeKey,
    ],
    () =>
      fetchFeatureAudienceStats(featureSlug as string, {
        brandId,
        ...(brandLevelMoney ? {} : campaign?.legKey ? { leg: campaign.legKey } : { goal: audienceStatsGoal }),
        statuses: "active,paused,archived",
        ...(campaignId ? { campaignId } : { offerId }),
      }),
    { enabled: Boolean(featureSlug), ...pollOptions },
  );
  const statsLoading = Boolean(featureSlug) && (stats.isPending || stats.isPlaceholderData);
  const statsByAudienceId = useMemo(() => {
    const m = new Map<string, FeatureAudienceStatsRow>();
    for (const row of stats.data?.audiences ?? []) {
      m.set(row.audienceId, row);
      m.set(row.audience.id, row);
    }
    return m;
  }, [stats.data]);

  const statusMut = useMutation({
    mutationFn: (i: { id: string; status: AudienceStatus }) => setAudienceStatus(i.id, i.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audiences", brandId] }),
  });
  const avatarMut = useMutation({
    mutationFn: (id: string) => generateAudienceAvatar(id),
    onSuccess: (res) => {
      for (const status of VISIBLE_AUDIENCE_STATUSES) {
        queryClient.setQueryData<{ audiences: AudienceWire[]; total: number }>(
          ["audiences", brandId, status, offerId ?? "brand"],
          (old) => (old ? { ...old, audiences: old.audiences.map((a) => (a.id === res.audience.id ? res.audience : a)) } : old),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["audiences", brandId] });
    },
  });

  // A campaign narrows to the audiences it targets; `null` inherits the offer's set.
  const campaignAudienceIds = campaign?.audienceIds ?? null;
  const audiences: AudienceWire[] = useMemo(() => {
    const all = [
      ...(active.data?.audiences ?? []),
      ...(paused.data?.audiences ?? []),
      ...(archived.data?.audiences ?? []),
      ...(includeSuggested ? suggested.data?.audiences ?? [] : []),
    ];
    return campaignAudienceIds ? all.filter((a) => campaignAudienceIds.includes(a.id)) : all;
  }, [active.data, paused.data, archived.data, suggested.data, includeSuggested, campaignAudienceIds]);

  // Per-tab loading, keyed on a one-shot settle so a settled-empty tab never re-skeletons on a poll.
  const activeTabRows = audiences.filter((a) => a.status === "active" || a.status === "paused").length;
  const archivedTabRows = audiences.filter((a) => a.status === "archived").length;
  const suggestedTabRows = audiences.filter((a) => a.status === "suggested").length;
  const suggestedTabLoading = includeSuggested && (suggested.isPending || (suggestedTabRows === 0 && !suggested.isFetchedAfterMount));
  const activeTabLoading =
    active.isPending || paused.isPending || (activeTabRows === 0 && !(active.isFetchedAfterMount && paused.isFetchedAfterMount));
  const archivedTabLoading = archived.isPending || (archivedTabRows === 0 && !archived.isFetchedAfterMount);
  const listsPending = active.isPending || paused.isPending || archived.isPending;

  return {
    brandId,
    offerId,
    campaignScoped,
    revenueOk,
    brandLevelMoney,
    withheldPaused,
    columns,
    defaultSortCol,
    defaultSortDir,
    showSignupCols,
    showFormSubmissionCols,
    showSaleCols,
    audiences,
    activeTabRows,
    archivedTabRows,
    suggestedTabRows,
    activeTabLoading,
    archivedTabLoading,
    suggestedTabLoading,
    listsPending,
    statsLoading,
    statsFor: (id: string) => statsByAudienceId.get(id),
    // The CAMPAIGN's own leg figures off the envelope's scope maturity: the price its
    // Overview states, so the two pages cannot print two prices for one campaign.
    scopeLeg: campaignScoped
      ? stats.data?.maturity?.legs.find((l) => l.legKey != null && l.legKey === campaign?.legKey) ?? null
      : null,
    legPair,
    statusMut,
    avatarMut,
  };
}
