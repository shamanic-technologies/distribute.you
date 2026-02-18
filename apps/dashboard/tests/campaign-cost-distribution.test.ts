import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("CampaignCostDistribution component", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/campaign-cost-distribution.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should aggregate costs by costName from brand runs", () => {
    expect(content).toContain("costName");
    expect(content).toContain("Map<string, number>");
    expect(content).toContain("run.costs");
  });

  it("should render a donut chart via conic-gradient", () => {
    expect(content).toContain("conic-gradient");
    expect(content).toContain("rounded-full");
  });

  it("should show total cost in the center of the donut", () => {
    expect(content).toContain("formatUsdCents(totalCents)");
    expect(content).toContain("font-semibold");
  });

  it("should display formatted cost names and amounts in legend", () => {
    expect(content).toContain("formatCostName");
    expect(content).toContain("formatUsdCents(seg.cents)");
    expect(content).toContain("percentage");
  });

  it("should sort segments by cost descending", () => {
    expect(content).toContain(".sort((a, b) => b.cents - a.cents)");
  });

  it("should show empty state when no costs", () => {
    expect(content).toContain("No cost data yet");
  });
});

describe("Campaigns list page integrates CampaignCostDistribution", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/brands/[brandId]/mcp/sales-outreach/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should import and render CampaignCostDistribution", () => {
    expect(content).toContain("CampaignCostDistribution");
    expect(content).toContain("campaign-cost-distribution");
  });

  it("should fetch brand runs and pass them to CampaignCostDistribution", () => {
    expect(content).toContain("listBrandRuns");
    expect(content).toContain("brandRuns");
    expect(content).toContain("runs={brandRuns}");
  });
});
