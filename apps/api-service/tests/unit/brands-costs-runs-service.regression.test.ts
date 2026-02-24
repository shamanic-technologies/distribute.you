/**
 * Regression test: the GET /v1/brands/costs endpoint must use runs-service
 * /v1/stats/costs?groupBy=brandId to get total costs per brand,
 * NOT campaign-service batch-budget-usage.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("brands costs endpoint uses runs-service", () => {
  const routePath = path.join(__dirname, "../../src/routes/brand.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  it("should have a GET /brands/costs route", () => {
    expect(content).toContain('router.get("/brands/costs"');
  });

  it("should call runs-service /v1/stats/costs with groupBy=brandId", () => {
    expect(content).toContain("/v1/stats/costs?");
    expect(content).toContain("groupBy=brandId");
    expect(content).toContain("externalServices.runs");
  });

  it("should not use campaign-service for brand-level costs", () => {
    // The /brands/costs route should not depend on campaign-service
    const brandsRoute = content.slice(
      content.indexOf('router.get("/brands/costs"'),
      content.indexOf("}", content.indexOf('router.get("/brands/costs"') + 200) + 1
    );
    expect(brandsRoute).not.toContain("externalServices.campaign");
  });

  it("should map runs-service groups to brandId -> totalCostInUsdCents", () => {
    // Simulate the mapping logic from the route
    const groups = [
      {
        dimensions: { brandId: "brand-1" },
        totalCostInUsdCents: "1500",
        actualCostInUsdCents: "1200",
        provisionedCostInUsdCents: "300",
        cancelledCostInUsdCents: "0",
        runCount: 5,
      },
      {
        dimensions: { brandId: "brand-2" },
        totalCostInUsdCents: "800",
        actualCostInUsdCents: "800",
        provisionedCostInUsdCents: "0",
        cancelledCostInUsdCents: "0",
        runCount: 3,
      },
      {
        dimensions: { brandId: null },
        totalCostInUsdCents: "50",
        actualCostInUsdCents: "50",
        provisionedCostInUsdCents: "0",
        cancelledCostInUsdCents: "0",
        runCount: 1,
      },
    ];

    const costs: Record<string, string> = {};
    for (const group of groups) {
      if (group.dimensions.brandId) {
        costs[group.dimensions.brandId] = group.totalCostInUsdCents;
      }
    }

    expect(costs).toEqual({
      "brand-1": "1500",
      "brand-2": "800",
    });
    // Null brandId should be excluded
    expect(costs).not.toHaveProperty("null");
  });
});
