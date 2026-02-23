import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("CostBreakdown component", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/cost-breakdown.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should aggregate costs from both leads and emails", () => {
    expect(content).toContain("enrichmentRun");
    expect(content).toContain("generationRun");
    expect(content).toContain("descendantRuns");
  });

  it("should group costs by costName", () => {
    expect(content).toContain("costName");
    expect(content).toContain("Map<string, number>");
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
    "../src/app/(dashboard)/brands/[brandId]/mcp/sales-outreach/campaigns/[id]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should import CostBreakdown component", () => {
    expect(content).toContain("import { CostBreakdown }");
    expect(content).toContain("cost-breakdown");
  });

  it("should pass leads, emails, and statsTotalCents to CostBreakdown", () => {
    expect(content).toContain("<CostBreakdown");
    expect(content).toContain("leads={leads}");
    expect(content).toContain("emails={emails}");
    expect(content).toContain("statsTotalCents");
  });

  it("should destructure leads and emails from campaign context", () => {
    expect(content).toMatch(/const\s*\{[^}]*leads[^}]*emails[^}]*\}\s*=\s*useCampaign/);
  });
});
