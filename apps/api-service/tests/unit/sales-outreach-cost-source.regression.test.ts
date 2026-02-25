/**
 * Regression test: the sales-outreach page header total cost must come from
 * runs-service (brandCostBreakdown) and NOT from campaign-service batch-stats.
 * The CostBreakdown component already uses runs-service, so the header total
 * must be consistent with it.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("sales-outreach page cost source consistency", () => {
  const pagePath = path.join(
    __dirname,
    "../../../dashboard/src/app/(dashboard)/brands/[brandId]/workflows/[sectionKey]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should compute totalCostCents from brandCostBreakdown (runs-service)", () => {
    // The total cost in the header should be computed from brandCostBreakdown
    expect(content).toContain("brandCostBreakdown.reduce");
    expect(content).toContain("totalCostInUsdCents");
  });

  it("should NOT aggregate campaignStats totalCostInUsdCents into header total", () => {
    // campaignTotals.reduce should only aggregate leads and emails, not costs
    // Extract the reduce block to verify it doesn't accumulate totalCostInUsdCents
    const reduceStart = content.indexOf("statsValues.reduce");
    const reduceEnd = content.indexOf(");", reduceStart + 50);
    const reduceBlock = content.slice(reduceStart, reduceEnd);
    expect(reduceBlock).not.toContain("totalCost");
    expect(content).toContain("leadsServed: acc.leadsServed");
    expect(content).toContain("emailsGenerated: acc.emailsGenerated");
  });

  it("should display totalCostCents from runs-service in the header", () => {
    expect(content).toContain("totals.totalCostCents");
  });
});

describe("brands page cost source", () => {
  const pagePath = path.join(
    __dirname,
    "../../../dashboard/src/app/(dashboard)/brands/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should use getBrandsCosts (runs-service) instead of campaign batch stats", () => {
    expect(content).toContain("getBrandsCosts");
  });

  it("should NOT use getCampaignBatchStats", () => {
    expect(content).not.toContain("getCampaignBatchStats");
    expect(content).not.toContain("listCampaigns");
  });
});
