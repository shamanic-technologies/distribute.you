import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: the campaign page showed different totals in the header ($0.16)
 * vs the cost breakdown pie chart ($0.10).
 *
 * Root cause: CostBreakdown manually aggregated costs from lead enrichment runs
 * and email generation runs, but missed email sending runs (Instantly) and
 * transactional email runs (Postmark) because those are sibling runs in the
 * tree, not descendants of the generation runs.
 *
 * Fix: CostBreakdown now uses the authoritative cost breakdown from
 * runs-service /v1/stats/costs/by-cost-name (via stats.costBreakdown),
 * which is the same source of truth as the header total. Both header and
 * pie chart now derive from runs-service, guaranteeing consistency.
 */
describe("CostBreakdown uses runs-service cost breakdown (not manual run aggregation)", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/cost-breakdown.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should accept costBreakdown from runs-service", () => {
    expect(content).toContain("CostByName");
    expect(content).toContain("costBreakdown");
  });

  it("should NOT manually walk lead/email run trees", () => {
    expect(content).not.toContain("enrichmentRun");
    expect(content).not.toContain("generationRun");
    expect(content).not.toContain("collectCosts");
  });
});

describe("api-service stats endpoint includes cost breakdown from runs-service", () => {
  const routePath = path.join(
    __dirname,
    "../../api-service/src/routes/campaigns.ts"
  );
  const content = fs.readFileSync(routePath, "utf-8");

  it("should call runs-service /v1/stats/costs/by-cost-name", () => {
    expect(content).toContain("/v1/stats/costs/by-cost-name");
  });

  it("should include costBreakdown in the stats response", () => {
    expect(content).toContain("stats.costBreakdown");
  });
});

/**
 * Brand page cost distribution is a separate component that uses
 * brand-level runs with a statsTotalCents fallback. This is a different
 * use case (brand-level view, not campaign-level).
 */
describe("CampaignCostDistribution uses authoritative stats total", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/campaign-cost-distribution.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should accept a statsTotalCents prop", () => {
    expect(content).toContain("statsTotalCents");
  });

  it("should show an 'Other' segment when stats total exceeds brand run costs", () => {
    expect(content).toContain("Other");
  });
});
