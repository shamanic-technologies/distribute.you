import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const deprecatedStageField = "funnel" + "Stages";

describe("brand status control", () => {
  const campaignPage = read("components/campaigns/campaign-overview-page.tsx");
  const brandPage = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  const settingsPage = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx");
  const control = read("components/brand/brand-status-control.tsx");
  const api = read("lib/api.ts");

  it("renders on the campaign overview — the brand surfaces dropped it", () => {
    // The status bar was retired from the brand Overview and Brand Settings; the
    // campaign overview is the one customer surface that still shows it.
    expect(campaignPage).toContain("BrandStatusControl");
    expect(brandPage).not.toContain("BrandStatusControl");
    expect(settingsPage).not.toContain("BrandStatusControl");
    expect(campaignPage).not.toContain("/campaigns/new");
  });

  it("shows optimization goal labels with positive replies as the unset default", () => {
    expect(control).toContain("Maximising signups conversions");
    expect(control).toContain("Maximising sales meetings");
    expect(control).toContain('?? "positive_replies"');
  });

  it("uses brand-level pause, daily budget, and sales economics data", () => {
    expect(control).toContain("getBrandPause");
    expect(control).toContain("setBrandPause");
    expect(control).toContain("getBrandDailyBudget");
    // READS the budget, never writes it — see the block below.
    expect(control).not.toContain("saveBrandDailyBudget");
    expect(control).toContain("getBrandSalesEconomics");
    // READS the goal to state it, never writes it — see the block below.
    expect(control).not.toContain("saveBrandSalesEconomics");
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

  it("states the goal and offers no control to change it", () => {
    // The goal is the retired, lossier vocabulary — `meetingBooked` is the goal of
    // two different funnels — and features-service no longer reads it at all. What a
    // brand sells through is its DECLARED SALES FUNNELS, chosen on Settings. A dialog
    // here would write a value with no consequence anywhere: a control lying about
    // what the click does. So the tag states, and nothing more.
    expect(control).not.toContain("goalDialogOpen");
    expect(control).not.toContain("openGoalDialog");
    expect(control).not.toContain("Optimization goal");
    expect(control).not.toContain("GOAL_OPTIONS");
    expect(control).not.toContain("saveGoal");
    expect(control).not.toContain("salesEconomicsInputForGoal");
    // No placeholder economics left behind to restate on a write that no longer happens.
    expect(control).not.toContain("DEFAULT_SALES_ECONOMICS");
    // The label itself survives: it is what the numbers on this page are measured against.
    expect(control).toContain("GOAL_LABEL[goal]");
    expect(control).not.toContain(deprecatedStageField);
  });

  it("STATES the daily budget on the pill, and does not edit it", () => {
    // Money is funded per SALES FUNNEL now, and the funnel is where the customer
    // sets it. This pill shows the brand total — which billing answers as the SUM
    // of those ceilings — so an editor here would write a single brand-level
    // number on top of the very ceilings it is supposed to be the sum of, and the
    // two would disagree the moment either moved.
    expect(control).toContain("budgetLabel");
    for (const gone of [
      "budgetDialogOpen",
      "openBudgetDialog",
      "COUNT_TIERS",
      "budgetForCount",
      "countForBudget",
      "saveBudget(selectedBudget)",
      "ESTIMATE_TOOLTIP",
    ]) {
      expect(control, `budget editor remnant: ${gone}`).not.toContain(gone);
    }
  });

  it("drops the projection machinery that only ever priced that modal", () => {
    // The tiers were derived from the projection's unit cost purely to label the
    // modal's options. With no modal there is nothing to price, so the query (and
    // its cold-Neon prewarm rationale) goes with it rather than staying as a
    // fetch nobody reads.
    for (const gone of [
      "getWorkflowProjection",
      "salesObjectiveForOptimizationGoal",
      "selectWorkflowForOptimizationGoal",
      "workflowOutcomeUnitCost",
      '"brand-status-budget"',
      "goalForBudget",
    ]) {
      expect(control, `dead projection remnant: ${gone}`).not.toContain(gone);
    }
  });
});
