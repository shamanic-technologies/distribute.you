import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Brand campaigns page uses runs-service cost breakdown (no 'Other' category)", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/brands/[brandId]/mcp/sales-outreach/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should import CostBreakdown (not CampaignCostDistribution)", () => {
    expect(content).toContain("import { CostBreakdown }");
    expect(content).toContain("cost-breakdown");
    expect(content).not.toContain("CampaignCostDistribution");
    expect(content).not.toContain("campaign-cost-distribution");
  });

  it("should fetch cost breakdown from runs-service via getBrandCostBreakdown", () => {
    expect(content).toContain("getBrandCostBreakdown");
    expect(content).toContain("brandCostBreakdown");
  });

  it("should NOT fetch brand runs for cost display", () => {
    expect(content).not.toContain("listBrandRuns");
    expect(content).not.toContain("brandRuns");
  });

  it("should pass costBreakdown to CostBreakdown component", () => {
    expect(content).toContain("<CostBreakdown");
    expect(content).toContain("costBreakdown={brandCostBreakdown}");
  });
});

describe("api-service brand cost-breakdown endpoint", () => {
  const routePath = path.join(
    __dirname,
    "../../api-service/src/routes/brand.ts"
  );
  const content = fs.readFileSync(routePath, "utf-8");

  it("should have a /brands/:id/cost-breakdown route", () => {
    expect(content).toContain('"/brands/:id/cost-breakdown"');
  });

  it("should call runs-service /v1/stats/costs/by-cost-name with brandId", () => {
    expect(content).toContain("/v1/stats/costs/by-cost-name");
    expect(content).toContain("brandId");
  });
});
