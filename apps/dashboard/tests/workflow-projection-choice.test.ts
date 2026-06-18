import { describe, expect, it } from "vitest";
import {
  selectWorkflowForOptimizationGoal,
  workflowOutcomeUnitCost,
} from "../src/lib/workflow-projection-choice";
import type { WorkflowProjectionItem, WorkflowProjectionResponse } from "../src/lib/api";

function workflow(
  slug: string,
  projection: Partial<NonNullable<WorkflowProjectionItem["projection"]>>,
): WorkflowProjectionItem {
  return {
    workflowDynastySlug: slug,
    workflowDynastyName: slug,
    contactedUsd: null,
    replyUsd: null,
    clickUsd: null,
    costPerCloseUsd: null,
    projection: {
      contactedLeads: null,
      replies: null,
      visits: null,
      meetings: null,
      closes: 0,
      revenue: 0,
      cacPct: null,
      cacAbs: null,
      ...projection,
    },
  };
}

function response(
  recommendedWorkflowDynastySlug: string,
  workflows: WorkflowProjectionItem[],
): WorkflowProjectionResponse {
  return {
    featureSlug: "sales-cold-email-outreach",
    objective: "meeting-booked",
    recommendedWorkflowDynastySlug,
    recommendedBudgetUsd: 10,
    workflows,
  };
}

describe("workflow projection choice", () => {
  it("selects the cheapest meeting workflow even when backend recommended a click workflow", () => {
    const pelican = workflow("sales-cold-email-outreach-pelican", {
      meetings: 100 / 682,
      visits: 100 / 2.05,
    });
    const permafrost = workflow("sales-cold-email-outreach-permafrost", {
      meetings: 100 / 230,
      visits: null,
    });

    const selected = selectWorkflowForOptimizationGoal(
      response(pelican.workflowDynastySlug, [pelican, permafrost]),
      "sales_meetings",
    );

    expect(selected?.workflowDynastySlug).toBe(permafrost.workflowDynastySlug);
    expect(workflowOutcomeUnitCost(selected!, "sales_meetings")).toBeCloseTo(230, 6);
  });

  it("selects the cheapest signup workflow using visit-to-signup conversion", () => {
    const highVisitCost = workflow("high-visit-cost", { visits: 10 });
    const lowVisitCost = workflow("low-visit-cost", { visits: 50 });

    const selected = selectWorkflowForOptimizationGoal(
      response(highVisitCost.workflowDynastySlug, [highVisitCost, lowVisitCost]),
      "signups",
      { visitToSignupPct: 5 },
    );

    expect(selected?.workflowDynastySlug).toBe(lowVisitCost.workflowDynastySlug);
    expect(workflowOutcomeUnitCost(selected!, "signups", { visitToSignupPct: 5 })).toBe(40);
  });

  it("falls back to the backend recommendation when no workflow has usable outcome cost", () => {
    const recommended = workflow("recommended", { meetings: null, visits: null });
    const other = workflow("other", { meetings: null, visits: null });

    const selected = selectWorkflowForOptimizationGoal(
      response(recommended.workflowDynastySlug, [other, recommended]),
      "sales_meetings",
    );

    expect(selected?.workflowDynastySlug).toBe(recommended.workflowDynastySlug);
  });

  it("uses the projection budget when calculating absolute unit cost", () => {
    const selected = workflow("scaled", { meetings: 10 });

    expect(
      workflowOutcomeUnitCost(selected, "sales_meetings", { projectionBudgetUsd: 500 }),
    ).toBe(50);
  });
});
