"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import {
  getFeatureRevenue,
  getWorkflowProjection,
  keepLastGoodWorkflowProjection,
  optimizationGoalForRuntimeGoal,
  salesObjectiveForOptimizationGoal,
  type BrandOptimizationGoal,
  type Campaign,
  type WorkflowProjectionResponse,
} from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery, useOrgQueryGate } from "@/lib/use-auth-query";
import { useCampaignRows } from "@/components/campaigns/campaigns-table";
import { isRunningStatus } from "@/lib/campaign-controls";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { stepsFor } from "@/lib/goal-steps";
import { learningSignalUnitCostUsd } from "@/lib/workflow-projection-choice";
import {
  channelSettlesLate,
  learningProgress,
  learningThresholdUsd,
  settlingDaysElapsed,
  REPLY_SETTLING_DAYS,
  type LearningProgress,
} from "@/lib/learning-progress";
import { normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "@/lib/sales-funnels";

/**
 * WHICH campaign a scope's learning band speaks for, and every figure it states.
 *
 * A scope — a brand, an offer, one of its funnels, or a single campaign — stops learning
 * the moment ONE of its campaigns is measured (`scopeIsLearning`). So the honest subject
 * is the campaign that finishes SOONEST, and the honest number is that campaign's own
 * days-left. Not "the one with the most outcomes so far": two campaigns at the same count
 * can be a week apart if one is funded at twice the other's ceiling or prices a different
 * step, so a count ranks by a proxy for the answer instead of by the answer.
 *
 * ONE derivation, four surfaces. Every figure the band states — the expected price, the
 * committed spend, the daily ceiling, the settling tail — was previously assembled by
 * hand at each call site, and that is exactly how one campaign came to read `13 days`
 * on its own page and `27 days` one click up (measured in prod, 2026-08-29: same
 * campaign, same $144.39 spent, same $24/day, same $44.97 per sales interest; the two
 * sites simply did not pass the same inputs). A band is a promise about a date, so two
 * of them for one campaign is the self-contradictory-surface bug wearing a countdown.
 *
 * Every read here is a key the surrounding surfaces already poll:
 *  - the campaigns and their per-campaign money come from `useCampaignRows`, the hook
 *    the Campaigns table itself uses, so the rows below the band and the band above them
 *    cannot disagree about which campaigns exist or what they cost;
 *  - the expected price is keyed on the FUNNEL, so every campaign selling one shares a
 *    single answer;
 *  - the lead's own `/revenue?campaignId=` read — the only thing carrying the dated spend
 *    curve — is byte-equal to the key the campaign Overview polls, so on that page it
 *    costs nothing at all.
 */
export interface ScopeLearningLead {
  /** The campaign the band describes: the one that finishes soonest. */
  campaign: Campaign;
  /** Expected cost of ONE of the outcomes the learning gate COUNTS, USD. */
  outcomeUnitCostUsd: number;
  /** Committed spend so far, USD — the same basis ROI divides by. */
  spentUsd: number | null;
  /** What this campaign may spend today, USD. */
  dailyBudgetUsd: number;
  /** {@link REPLY_SETTLING_DAYS} on a channel whose outcomes arrive by email, else 0. */
  settlingDays: number;
  /** Days already elapsed of that tail, or null when it cannot be dated yet. */
  settlingDaysElapsed: number | null;
  /** The band's own figures, so a caller can order or gate on them. */
  progress: LearningProgress;
}

/** The goal a campaign is priced on — its own when it states one, else the funnel's. */
function goalFor(campaign: Campaign): BrandOptimizationGoal {
  return campaign.goal ? optimizationGoalForRuntimeGoal(campaign.goal) : "sales_meetings";
}

export function useScopeLearningLead(
  brandId: string,
  featureSlug: string,
  options?: {
    /** Narrow to one offer's campaigns. Absent at brand grain. */
    offerId?: string;
    /** Narrow to one funnel's campaigns. Absent above the funnel. */
    funnelKey?: string | null;
    /** Narrow to ONE campaign — its own page, where the band speaks for it alone. */
    campaignId?: string;
  },
): ScopeLearningLead | null {
  const offerId = options?.offerId;
  const funnelKey = options?.funnelKey ?? null;
  const campaignId = options?.campaignId;
  const orgConsistent = useOrgQueryGate();

  const { rows } = useCampaignRows(brandId, featureSlug, offerId);

  // Who is even in the running: a campaign still learning, and actually running.
  //
  // A PAUSED campaign is never the subject — its days-left are priced against a daily
  // spend that is not happening, so the date is one nobody can stand behind.
  const wanted = funnelKey ? normalizeSalesFunnelKey(funnelKey as SalesFunnelKeyWire) : null;
  const scopedRows = useMemo(
    () =>
      rows.filter((row) => {
        if (campaignId && row.campaign.id !== campaignId) return false;
        if (!wanted) return true;
        return (
          row.campaign.funnelKey != null &&
          normalizeSalesFunnelKey(row.campaign.funnelKey) === wanted
        );
      }),
    [rows, campaignId, wanted],
  );
  // A scope that has already priced itself carries NO countdown: it clears the moment
  // one of its campaigns is measured, so a band beside a stated figure would count days
  // for a question the page has already answered.
  const scopedLearning = scopeIsLearning(scopedRows);
  const candidates = useMemo(
    () =>
      scopedLearning
        ? scopedRows.filter((row) => row.learning && isRunningStatus(row.campaign.status))
        : [],
    [scopedRows, scopedLearning],
  );

  // One projection per candidate. `budgetUsd` never reaches the producer, so the answer
  // depends only on (channel, brand, funnel) — the key says so, and campaigns sharing a
  // funnel therefore share one cached read.
  const projectionQs = useQueries({
    queries: candidates.map(({ campaign }) => {
      const goal = goalFor(campaign);
      return {
        queryKey: [
          "workflowProjection",
          brandId,
          campaign.featureSlug,
          "learning-progress",
          campaign.funnelKey ?? goal,
        ] as const,
        queryFn: () =>
          getWorkflowProjection({
            featureSlug: campaign.featureSlug!,
            brandId,
            objective: salesObjectiveForOptimizationGoal(goal),
            // A campaign runs exactly ONE funnel and states it. Without the param the
            // projection is priced from both channels at once, which forecasts a website
            // funnel a conversation-led campaign never sells.
            ...(campaign.funnelKey ? { funnel: campaign.funnelKey } : {}),
          }),
        enabled: orgConsistent && Boolean(campaign.featureSlug),
        ...pollOptions,
        structuralSharing: (prev: unknown, next: unknown) =>
          keepLastGoodWorkflowProjection(
            prev as WorkflowProjectionResponse | undefined,
            next as WorkflowProjectionResponse,
          ),
      };
    }),
  });

  const projections = projectionQs.map((q) => q.data);

  // The soonest finisher, with its own inputs. The settling tail is counted whole here:
  // dating how much of it has already run needs the lead's own spend curve, which is one
  // read below — and an unknown elapsed is always read as "all of it still ahead", never
  // as a finished one, because shortening a promise on no evidence is the one direction
  // that costs trust.
  const preliminary = useMemo(() => {
    let best: { row: (typeof candidates)[number]; unitCost: number; settling: number; progress: LearningProgress } | null =
      null;
    candidates.forEach((row, i) => {
      const projection = projections[i];
      if (!projection) return;
      const goal = goalFor(row.campaign);
      const stepKeys = stepsFor(goal, row.campaign.funnelKey as SalesFunnelKeyWire | null).map(
        (step) => step.key,
      );
      const unitCost = learningSignalUnitCostUsd(projection, stepKeys);
      if (unitCost == null) return;
      const settling = channelSettlesLate(row.campaign.featureSlug) ? REPLY_SETTLING_DAYS : 0;
      const progress = learningProgress({
        outcomeUnitCostUsd: unitCost,
        spentUsd: row.revenue?.committedCostUsd ?? null,
        dailyBudgetUsd: row.budgetCents != null ? row.budgetCents / 100 : null,
        settlingDays: settling,
      });
      if (!progress) return;
      if (best == null || progress.daysLeft < best.progress.daysLeft) {
        best = { row, unitCost, settling, progress };
      }
    });
    return best as
      | { row: (typeof candidates)[number]; unitCost: number; settling: number; progress: LearningProgress }
      | null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, ...projections]);

  // The lead's dated spend curve — the ONLY thing that can say how much of the settling
  // tail has already run, and it only changes the answer once the spending is done.
  const leadCampaign = preliminary?.row.campaign ?? null;
  const { data: leadRevenue } = useAuthQuery(
    ["featureRevenue", brandId, leadCampaign?.featureSlug ?? "none", "campaign", leadCampaign?.id ?? "none"],
    () => getFeatureRevenue(leadCampaign!.featureSlug!, brandId, { campaignId: leadCampaign!.id }),
    { enabled: Boolean(leadCampaign?.featureSlug && leadCampaign?.id), ...pollOptions },
  );

  return useMemo(() => {
    if (!preliminary) return null;
    const { row, unitCost, settling } = preliminary;
    const elapsed =
      leadRevenue && leadRevenue.roiHistory
        ? settlingDaysElapsed(
            leadRevenue.roiHistory.daily,
            learningThresholdUsd(unitCost),
            new Date(),
          )
        : null;
    const spentUsd = row.revenue?.committedCostUsd ?? null;
    const dailyBudgetUsd = row.budgetCents != null ? row.budgetCents / 100 : null;
    const progress = learningProgress({
      outcomeUnitCostUsd: unitCost,
      spentUsd,
      dailyBudgetUsd,
      settlingDays: settling,
      settlingDaysElapsed: elapsed,
    });
    if (!progress || dailyBudgetUsd == null) return null;
    return {
      campaign: row.campaign,
      outcomeUnitCostUsd: unitCost,
      spentUsd,
      dailyBudgetUsd,
      settlingDays: settling,
      settlingDaysElapsed: elapsed,
      progress,
    };
  }, [preliminary, leadRevenue]);
}
