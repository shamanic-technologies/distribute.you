import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Brand overview page uses runs-service for total cost", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/brands/[brandId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should fetch cost breakdown from runs-service via getBrandCostBreakdown", () => {
    expect(content).toContain("getBrandCostBreakdown");
    expect(content).toContain("brandCostBreakdown");
  });

  it("should sum actualCostInUsdCents from cost breakdown", () => {
    expect(content).toContain("actualCostInUsdCents");
  });

  it("should NOT sum totalCostInUsdCents from campaign batch stats", () => {
    // The brand page must not compute total cost from campaign-level stats.
    // Campaign-service budget-usage is unreliable; runs-service is the source of truth.
    expect(content).not.toContain("getCampaignBatchStats");
  });
});
