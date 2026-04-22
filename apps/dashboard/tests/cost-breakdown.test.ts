import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("CostBreakdown component", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/cost-breakdown.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should accept costBreakdown from runs-service as its data source", () => {
    expect(content).toContain("costBreakdown: CostByName[]");
  });

  it("should NOT manually aggregate costs from lead/email runs", () => {
    // The old approach of walking enrichmentRun/generationRun was incomplete
    // because it missed email sending (Instantly) and transactional (Postmark) costs.
    expect(content).not.toContain("enrichmentRun");
    expect(content).not.toContain("generationRun");
    expect(content).not.toContain("descendantRuns");
  });

  it("should render a donut chart via conic-gradient", () => {
    expect(content).toContain("conic-gradient");
    expect(content).toContain("rounded-full");
  });

  it("should display formatted cost names and amounts in legend", () => {
    expect(content).toContain("formatCostName");
    expect(content).toContain("formatUsdCents");
    expect(content).toContain("percentage");
  });

  it("should show empty state when no costs", () => {
    expect(content).toContain("No cost data yet");
  });

  it("should sort segments by cost descending", () => {
    expect(content).toContain(".sort((a, b) => b.cents - a.cents)");
  });
});

describe("Campaign overview page includes CostBreakdown", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should import CostBreakdown component", () => {
    expect(content).toContain("import { CostBreakdown }");
    expect(content).toContain("cost-breakdown");
  });

  it("should pass costBreakdown from stats to CostBreakdown", () => {
    expect(content).toContain("<CostBreakdown");
    expect(content).toContain("costBreakdown={stats.costBreakdown}");
  });
});
