"use client";

import { useMemo } from "react";

import {
  getBrandSalesEconomics,
  getWorkflowProjection,
  keepLastGoodWorkflowProjection,
  optimizationGoalForRuntimeGoal,
  salesObjectiveForOptimizationGoal,
  type Campaign,
  type BrandOptimizationGoal,
  type WorkflowProjectionResponse,
} from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useRunningDailyBudgetCents } from "@/lib/use-running-daily-budget";
import {
  selectWorkflowForOptimizationGoal,
  workflowOutcomeUnitCost,
} from "@/lib/workflow-projection-choice";

/**
 * What one campaign expects to pay for ONE of its outcomes, resolved the way the
 * campaign Overview resolves it.
 *
 * The band on the Campaigns LIST needs the same figure the campaign's own page already
 * derives, and a second derivation of it is how two surfaces come to state different
 * dates for one campaign. So the ONE thing this hook owns is the plumbing — the reads
 * and the query keys — while the arithmetic stays in `workflow-projection-choice`,
 * which both pages call.
 *
 * Every key is byte-equal to one the surfaces around it already poll
 * (`brandSalesEconomics`, `brandSpendableBudget`), so the list pays for one extra read:
 * the projection itself, which is keyed on the funnel and therefore shared by every
 * campaign selling it.
 */
export function useCampaignExpectedOutcomeCostUsd(
  brandId: string,
  campaign: Campaign | null,
  offerId?: string,
): number | null {
  const featureSlug = campaign?.featureSlug ?? null;
  const funnelKey = campaign?.funnelKey ?? null;
  const goal: BrandOptimizationGoal = campaign?.goal
    ? optimizationGoalForRuntimeGoal(campaign.goal)
    : "sales_meetings";

  const { data: economicsData } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
    { enabled: Boolean(campaign), ...pollOptions },
  );

  // What the scope may spend today. The projection prices a MONTH of it, which is the
  // shape features-service answers in; the band divides by the DAY, so nothing here is
  // stated to the customer — this is only the budget the forecast is priced at.
  const { cents: runningDailyBudgetCents } = useRunningDailyBudgetCents(brandId, {
    offerId,
    enabled: Boolean(campaign),
  });
  const monthlyBudgetUsd =
    runningDailyBudgetCents != null && runningDailyBudgetCents > 0
      ? (runningDailyBudgetCents / 100) * 30
      : null;

  const { data: projection } = useAuthQuery(
    [
      "workflowProjection",
      brandId,
      featureSlug,
      "learning-progress",
      funnelKey ?? goal,
      monthlyBudgetUsd,
      economicsData?.salesEconomics?.updatedAt ?? "no-economics",
    ],
    () =>
      getWorkflowProjection({
        featureSlug: featureSlug!,
        brandId,
        objective: salesObjectiveForOptimizationGoal(goal),
        // A campaign runs exactly ONE funnel and states it. Without the param the
        // projection is priced from both channels at once, which forecasts a website
        // funnel a conversation-led campaign never sells.
        ...(funnelKey ? { funnel: funnelKey } : {}),
        budgetUsd: monthlyBudgetUsd ?? undefined,
      }),
    {
      enabled:
        Boolean(campaign) &&
        Boolean(featureSlug) &&
        economicsData !== undefined &&
        monthlyBudgetUsd != null,
      placeholderData: undefined,
      structuralSharing: (prev, next) =>
        keepLastGoodWorkflowProjection(
          prev as WorkflowProjectionResponse | undefined,
          next as WorkflowProjectionResponse,
        ),
    },
  );

  return useMemo(() => {
    if (!projection) return null;
    const workflow = selectWorkflowForOptimizationGoal(projection, goal, {
      visitToSignupPct: economicsData?.salesEconomics?.visitToSignupPct,
      replyToMeetingPct: economicsData?.salesEconomics?.replyToMeetingPct,
      visitToMeetingPct: economicsData?.salesEconomics?.visitToMeetingPct,
    });
    if (workflow == null) return null;
    return workflowOutcomeUnitCost(workflow, goal, {
      visitToSignupPct: economicsData?.salesEconomics?.visitToSignupPct,
      replyToMeetingPct: economicsData?.salesEconomics?.replyToMeetingPct,
      visitToMeetingPct: economicsData?.salesEconomics?.visitToMeetingPct,
      projectionBudgetUsd: monthlyBudgetUsd,
    });
  }, [projection, goal, economicsData?.salesEconomics, monthlyBudgetUsd]);
}
