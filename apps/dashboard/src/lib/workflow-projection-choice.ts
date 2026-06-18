import type {
  BrandOptimizationGoal,
  WorkflowProjectionItem,
  WorkflowProjectionResponse,
} from "@/lib/api";

const PROJECTION_REF_BUDGET = 100;

export function workflowOutcomeUnitCost(
  workflow: WorkflowProjectionItem,
  goal: BrandOptimizationGoal,
  options: { visitToSignupPct?: number | null; projectionBudgetUsd?: number | null } = {},
): number | null {
  const projection = workflow.projection;
  if (!projection) return null;
  const projectionBudgetUsd = options.projectionBudgetUsd ?? PROJECTION_REF_BUDGET;
  if (projectionBudgetUsd <= 0) return null;

  if (goal === "signups") {
    const visits = projection.visits;
    const visitToSignupPct = options.visitToSignupPct;
    if (visits == null || visits <= 0 || visitToSignupPct == null || visitToSignupPct <= 0) {
      return null;
    }
    return projectionBudgetUsd / (visits * (visitToSignupPct / 100));
  }

  const meetings = projection.meetings;
  return meetings != null && meetings > 0 ? projectionBudgetUsd / meetings : null;
}

export function selectWorkflowForOptimizationGoal(
  response: WorkflowProjectionResponse | null | undefined,
  goal: BrandOptimizationGoal,
  options: { visitToSignupPct?: number | null; projectionBudgetUsd?: number | null } = {},
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
