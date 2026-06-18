import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: the campaign page showed different totals in the header ($0.16)
 * vs the cost breakdown pie chart ($0.10).
 *
 * Root cause: CostBreakdown manually aggregated costs from lead enrichment runs
 * and email generation runs, but missed email sending runs (Instantly) and
 * transactional email runs (Postmark) because those are sibling runs in the
 * tree, not descendants of the generation runs.
 *
 * Fix: CostBreakdown now uses the authoritative cost breakdown from
 * runs-service /v1/stats/costs/by-cost-name (via stats.costBreakdown),
 * which is the same source of truth as the header total. Both header and
 * pie chart now derive from runs-service, guaranteeing consistency.
 */
// The CostBreakdown component + the campaigns LIST page were removed with the
// campaign concept. The brand Overview is the surviving cost-breakdown surface;
// it fetches the authoritative runs-service breakdown via getBrandCostBreakdown
// (the donut renders inside RevenueCostSummary now, not an inline component).
describe("Brand overview uses runs-service cost breakdown (no manual aggregation)", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should not use the old CampaignCostDistribution (manual brand-run aggregation)", () => {
    expect(content).not.toContain("CampaignCostDistribution");
  });

  it("should fetch cost breakdown from runs-service", () => {
    expect(content).toContain("getBrandCostBreakdown");
  });

  it("should scope cost breakdown to the feature slug", () => {
    expect(content).toContain("getBrandCostBreakdown(brandId, { featureSlug })");
  });
});

/**
 * Regression: getBrandCostBreakdown must pass featureSlug to
 * /runs/stats/costs so costs are scoped to the feature, not the whole brand.
 */
describe("getBrandCostBreakdown supports featureSlug filter", () => {
  const apiPath = path.join(__dirname, "../src/lib/api.ts");
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  it("should accept featureSlug option", () => {
    expect(apiContent).toContain("featureSlug");
  });

  it("should append featureSlug to the query string", () => {
    expect(apiContent).toContain('query.set("featureSlug"');
  });

  it("should pass through optional startedAfter/startedBefore filters", () => {
    expect(apiContent).toContain("startedAfter?: string");
    expect(apiContent).toContain("startedBefore?: string");
    expect(apiContent).toContain('query.set("startedAfter"');
    expect(apiContent).toContain('query.set("startedBefore"');
  });
});
