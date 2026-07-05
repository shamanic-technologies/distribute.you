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

function positiveOrNull(v: number | null | undefined): number | null {
  return v != null && v > 0 ? v : null;
}

function serverOutcomeUnitCost(
  workflow: WorkflowProjectionItem,
  goal: BrandOptimizationGoal,
): number | null {
  // The beta goals count the RAW outcome (a website visit / a positive reply), so
  // their per-outcome cost is the click / reply cost directly — no conversion step.
  if (goal === "website_visits") return positiveOrNull(workflow.clickUsd);
  if (goal === "positive_replies") return positiveOrNull(workflow.replyUsd);
  const cost =
    goal === "signups"
      ? workflow.costPerSignupUsd
      : workflow.costPerMeetingBookedUsd;
  return positiveOrNull(cost);
}

function workflowOutcomeUnitCostFromRates(
  workflow: WorkflowProjectionItem,
  goal: BrandOptimizationGoal,
  options: WorkflowOutcomeUnitCostOptions,
): number | null {
  const projectionBudgetUsd = options.projectionBudgetUsd ?? PROJECTION_REF_BUDGET;
  if (projectionBudgetUsd <= 0) return null;

  // Beta goals: raw-outcome cost = click / reply cost, else budget ÷ projected count.
  if (goal === "website_visits") {
    return (
      positiveOrNull(workflow.clickUsd) ??
      (workflow.projection?.visits != null && workflow.projection.visits > 0
        ? projectionBudgetUsd / workflow.projection.visits
        : null)
    );
  }
  if (goal === "positive_replies") {
    return (
      positiveOrNull(workflow.replyUsd) ??
      (workflow.projection?.replies != null && workflow.projection.replies > 0
        ? projectionBudgetUsd / workflow.projection.replies
        : null)
    );
  }

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

export function workflowOutcomeUnitCost(
  workflow: WorkflowProjectionItem,
  goal: BrandOptimizationGoal,
  options: WorkflowOutcomeUnitCostOptions = {},
): number | null {
  return (
    serverOutcomeUnitCost(workflow, goal) ??
    workflowOutcomeUnitCostFromRates(workflow, goal, options)
  );
}

export function workflowProjectionMatchesOutcomeRates(
  response: WorkflowProjectionResponse,
  goal: BrandOptimizationGoal,
  options: WorkflowOutcomeUnitCostOptions,
): boolean {
  let checked = false;
  for (const workflow of response.workflows) {
    const serverCost = serverOutcomeUnitCost(workflow, goal);
    const liveCost = workflowOutcomeUnitCostFromRates(workflow, goal, options);
    if (serverCost == null || liveCost == null) continue;
    checked = true;
    const relativeDelta = Math.abs(serverCost - liveCost) / Math.max(liveCost, 1);
    if (relativeDelta > 0.02) return false;
  }
  return checked;
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
