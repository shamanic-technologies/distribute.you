import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("CampaignCostDistribution component", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/campaign-cost-distribution.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should render a donut chart via conic-gradient", () => {
    expect(content).toContain("conic-gradient");
    expect(content).toContain("rounded-full");
  });

  it("should show total cost in the center of the donut", () => {
    expect(content).toContain("formatUsdCents(totalCents)");
    expect(content).toContain("font-semibold");
  });

  it("should display campaign names and costs in the legend", () => {
    expect(content).toContain("seg.name");
    expect(content).toContain("formatUsdCents(seg.costCents)");
    expect(content).toContain("percentage");
  });

  it("should sort items by cost descending and filter zero-cost items", () => {
    expect(content).toContain(".sort((a, b) => b.costCents - a.costCents)");
    expect(content).toContain("costCents > 0");
  });

  it("should show empty state when no costs", () => {
    expect(content).toContain("No costs yet");
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

  it("should pass campaign names and costs as items", () => {
    expect(content).toContain("c.name");
    expect(content).toContain("totalCostInUsdCents");
  });
});
