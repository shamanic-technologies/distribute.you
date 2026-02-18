/**
 * Regression test: the stats endpoints must include totalCostInUsdCents
 * from campaign-service batch-budget-usage, not just emailgen/delivery stats.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign stats endpoints include totalCostInUsdCents", () => {
  const routePath = path.join(__dirname, "../../src/routes/campaigns.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  it("should call batch-budget-usage from campaign-service", () => {
    expect(content).toContain("/campaigns/batch-budget-usage");
    expect(content).toContain("externalServices.campaign");
  });

  it("should set totalCostInUsdCents on the single stats response", () => {
    // The single endpoint assigns totalCostInUsdCents from budgetUsage
    expect(content).toContain("stats.totalCostInUsdCents = budgetUsage.results[id].totalCostInUsdCents");
  });

  it("should set totalCostInUsdCents on the batch stats response", () => {
    // The batch endpoint assigns totalCostInUsdCents from budgetResults
    expect(content).toContain("merged.totalCostInUsdCents = budgetResults[r.campaignId].totalCostInUsdCents");
  });
});
