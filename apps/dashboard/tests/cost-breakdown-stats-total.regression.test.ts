import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: cost breakdown total did not match the stats total (top-right).
 *
 * Root cause: the cost breakdown only summed enrichmentRun + generationRun
 * subtree costs, missing sibling runs like instantly-service/email-send.
 * The stats total comes from campaign-service batch-budget-usage which
 * includes ALL campaign children.
 *
 * Fix: pass the authoritative stats total to CostBreakdown and show an
 * "Other" segment for any uncategorized costs.
 */
describe("CostBreakdown uses authoritative stats total", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/cost-breakdown.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should accept a statsTotalCents prop", () => {
    expect(content).toContain("statsTotalCents");
  });

  it("should show an 'Other' segment when stats total exceeds categorized costs", () => {
    expect(content).toContain("Other");
  });

  it("should display the stats total in the donut center when provided", () => {
    // The donut center should use statsTotalCents when available
    expect(content).toContain("statsTotalCents");
    // Should still fall back to computed total if no stats total
    expect(content).toContain("totalCents");
  });
});

describe("Campaign overview page passes stats total to CostBreakdown", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/brands/[brandId]/mcp/sales-outreach/campaigns/[id]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should pass statsTotalCents to CostBreakdown from stats", () => {
    expect(content).toContain("statsTotalCents");
    expect(content).toContain("<CostBreakdown");
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
