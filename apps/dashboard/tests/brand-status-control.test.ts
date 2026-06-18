import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const deprecatedStageField = "funnel" + "Stages";

describe("brand overview status control", () => {
  const page = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  const control = read("components/brand/brand-status-control.tsx");
  const api = read("lib/api.ts");

  it("renders on the brand overview page", () => {
    expect(page).toContain("BrandStatusControl");
    expect(page).not.toContain("/campaigns/new");
  });

  it("shows optimization goal labels with sales meetings as the unset default", () => {
    expect(control).toContain("Maximising signups conversions");
    expect(control).toContain("Maximising sales meetings");
    expect(control).toContain('?? "sales_meetings"');
  });

  it("uses brand-level pause, daily budget, and sales economics data", () => {
    expect(control).toContain("getBrandPause");
    expect(control).toContain("setBrandPause");
    expect(control).toContain("getBrandDailyBudget");
    expect(control).toContain("saveBrandDailyBudget");
    expect(control).toContain("getBrandSalesEconomics");
    expect(control).toContain("saveBrandSalesEconomics");
    expect(control).toContain('["brandPause", brandId]');
    expect(control).toContain('["brandDailyBudget", brandId]');
    expect(control).toContain('["brandSalesEconomics", brandId]');
  });

  it("does not default unresolved pause state to active", () => {
    expect(control).not.toContain("pauseData?.paused ?? false");
    expect(control).toContain('const pauseReady = typeof paused === "boolean"');
    expect(control).toContain('!pauseReady ? (');
    expect(control).toContain('<Skeleton className="h-8 w-32 rounded-lg" />');
  });

  it("wires Pause / Restart to the brand pause API", () => {
    expect(control).toContain("Pause");
    expect(control).toContain("Restart");
    expect(api).toContain("export async function getBrandPause");
    expect(api).toContain("export async function setBrandPause");
    expect(api).toContain("`/brands/${brandId}/pause`");
    expect(api).toContain('method: "PATCH"');
  });

  it("opens an overview modal to edit the optimization goal", () => {
    expect(control).toContain("goalDialogOpen");
    expect(control).toContain("openGoalDialog");
    expect(control).toContain("Optimization goal");
    expect(control).toContain("GOAL_OPTIONS.map");
    expect(control).toContain("saveGoal(selectedGoal)");
  });

  it("keeps goal saves aligned with Brand Settings sales economics fields", () => {
    expect(control).toContain("salesEconomicsInputForGoal");
    expect(control).toContain("DEFAULT_SALES_ECONOMICS");
    expect(control).toContain("businessModel: current?.businessModel ?? null");
    expect(control).toContain("optimizationGoal");
    expect(control).toContain('invalidateQueries({ queryKey: ["featurePipelineActivity"] })');
    expect(control).not.toContain(deprecatedStageField);
  });

  it("opens an onboarding-style budget modal from the status pill", () => {
    expect(control).toContain("budgetDialogOpen");
    expect(control).toContain("openBudgetDialog");
    expect(control).toContain("COUNT_TIERS = [5, 25, 125]");
    expect(control).toContain("Other");
    expect(control).toContain("getWorkflowProjection");
    expect(control).toContain("budgetForCount");
    expect(control).toContain("saveBudget(selectedBudget)");
  });

  it("loads budget options with the brand goal objective, not hardcoded self-serve", () => {
    expect(control).toContain("salesObjectiveForOptimizationGoal(goalForBudget)");
    expect(control).toContain('"brand-status-budget", goalForBudget');
    expect(control).not.toContain('objective: "self-serve"');
  });

  it("prices the budget modal from the best workflow for the active goal", () => {
    expect(control).toContain("selectWorkflowForOptimizationGoal(projection, goalForBudget");
    expect(control).toContain("workflowOutcomeUnitCost(activeWorkflow, goalForBudget");
    expect(control).toContain("replyToMeetingPct");
    expect(control).toContain("visitToMeetingPct");
    expect(control).not.toContain("function activeProjection");
  });
});
