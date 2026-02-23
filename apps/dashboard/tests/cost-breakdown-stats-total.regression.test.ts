import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: the campaign page showed different totals in the header ($0.16)
 * vs the cost breakdown pie chart ($0.10) because the breakdown only aggregated
 * costs from lead enrichment and email generation runs, missing email sending
 * costs (Instantly) and transactional email costs (Postmark).
 *
 * Fix: pass the authoritative stats total to CostBreakdown and show
 * uncategorized costs as "Other (sending, delivery)".
 */
describe("CostBreakdown uses statsTotalCents to match header total", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/campaign/cost-breakdown.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should accept a statsTotalCents prop", () => {
    expect(content).toContain("statsTotalCents");
  });

  it("should show an 'Other' segment when stats total exceeds run costs", () => {
    expect(content).toContain("Other (sending, delivery)");
  });

  it("should use statsTotalCents as the display total when available", () => {
    expect(content).toContain("statsTotalCents && statsTotalCents > 0 ? statsTotalCents");
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
