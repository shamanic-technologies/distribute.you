import type {
  BrandOptimizationGoal,
  WorkflowProjectionItem,
  WorkflowProjectionResponse,
} from "@/lib/api";

const PROJECTION_REF_BUDGET = 100;

type WorkflowOutcomeUnitCostOptions = {
  visitToSignupPct?: number | null;
  replyToMeetingPct?: number | null;
  visitToMeetingPct?: number | null;
  projectionBudgetUsd?: number | null;
};

export function workflowOutcomeUnitCost(
  workflow: WorkflowProjectionItem,
  goal: BrandOptimizationGoal,
  options: WorkflowOutcomeUnitCostOptions = {},
): number | null {
  const projectionBudgetUsd = options.projectionBudgetUsd ?? PROJECTION_REF_BUDGET;
  if (projectionBudgetUsd <= 0) return null;

  if (goal === "signups") {
    const visitToSignupPct = options.visitToSignupPct;
    if (visitToSignupPct == null || visitToSignupPct <= 0) {
      return null;
    }
    const visitToSignup = visitToSignupPct / 100;
    if (workflow.clickUsd != null && workflow.clickUsd > 0) {
      return workflow.clickUsd / visitToSignup;
    }

    const visits = workflow.projection?.visits;
    return visits != null && visits > 0
      ? projectionBudgetUsd / (visits * visitToSignup)
      : null;
  }

  const replyToMeeting = options.replyToMeetingPct;
  const visitToMeeting = options.visitToMeetingPct;
  if (
    (replyToMeeting != null && replyToMeeting > 0) ||
    (visitToMeeting != null && visitToMeeting > 0)
  ) {
    const meetingsPerDollar =
      (workflow.replyUsd != null && workflow.replyUsd > 0 && replyToMeeting != null
        ? (1 / workflow.replyUsd) * (replyToMeeting / 100)
        : 0) +
      (workflow.clickUsd != null && workflow.clickUsd > 0 && visitToMeeting != null
        ? (1 / workflow.clickUsd) * (visitToMeeting / 100)
        : 0);
    return meetingsPerDollar > 0 ? 1 / meetingsPerDollar : null;
  }

  const meetings = workflow.projection?.meetings;
  return meetings != null && meetings > 0 ? projectionBudgetUsd / meetings : null;
}

export function selectWorkflowForOptimizationGoal(
  response: WorkflowProjectionResponse | null | undefined,
  goal: BrandOptimizationGoal,
  options: WorkflowOutcomeUnitCostOptions = {},
): WorkflowProjectionItem | null {
  if (!response || response.workflows.length === 0) return null;

  let best: { workflow: WorkflowProjectionItem; unitCost: number } | null = null;
  for (const workflow of response.workflows) {
    const unitCost = workflowOutcomeUnitCost(workflow, goal, options);
    if (unitCost == null || !Number.isFinite(unitCost)) continue;
    if (best == null || unitCost < best.unitCost) {
      best = { workflow, unitCost };
    }
  }
  if (best) return best.workflow;

  const recommended = response.recommendedWorkflowDynastySlug
    ? response.workflows.find(
        (workflow) => workflow.workflowDynastySlug === response.recommendedWorkflowDynastySlug,
      )
    : null;
  return recommended ?? response.workflows[0] ?? null;
}
