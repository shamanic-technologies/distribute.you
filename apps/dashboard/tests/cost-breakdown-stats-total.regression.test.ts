import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: cost breakdown components should NOT use band-aid "Other"
 * segments or statsTotalCents overrides. Cost totals must match because
 * the run ID tree is complete, not because we paper over gaps client-side.
 */
describe("CostBreakdown does not use statsTotalCents fallback", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/cost-breakdown.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should NOT have a statsTotalCents prop", () => {
    // statsTotalCents was a band-aid — costs should match via proper run tree
    expect(content).not.toContain("statsTotalCents");
  });

  it("should NOT have an 'Other' fallback segment", () => {
    expect(content).not.toMatch(/map\.set\(["']Other["']/);
  });
});

describe("CampaignCostDistribution does not use statsTotalCents fallback", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/campaign-cost-distribution.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should NOT have a statsTotalCents prop", () => {
    expect(content).not.toContain("statsTotalCents");
  });

  it("should NOT have an 'Other' fallback segment", () => {
    expect(content).not.toMatch(/map\.set\(["']Other["']/);
  });
});

/**
 * Regression: brand page cost breakdown total did not match the header total.
 *
 * Root cause: the header total summed campaign batch-budget-usage costs,
 * while CampaignCostDistribution only showed brand-service run costs
 * (profiling costs), ignoring campaign execution costs entirely.
 *
 * Fix: pass the authoritative stats total to CampaignCostDistribution
 * and show uncategorized costs as "Other".
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

describe("Brand page passes stats total to CampaignCostDistribution", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/brands/[brandId]/mcp/sales-outreach/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should pass statsTotalCents to CampaignCostDistribution", () => {
    expect(content).toContain("statsTotalCents");
    expect(content).toContain("<CampaignCostDistribution");
  });
});
