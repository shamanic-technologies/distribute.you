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
// campaign concept. The brand Overview is the surviving cost surface; it now
// renders the features-service `/revenue` `spend` block VERBATIM (Total spent +
// top sources from ONE server-computed object reconciled to runs ACTUAL spend),
// so the header total and the source list can no longer diverge — the original
// regression (header $0.16 vs pie $0.10). No client cost-breakdown fetch/sum.
describe("Brand overview renders the server spend block (single source, no manual aggregation)", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should not use the old CampaignCostDistribution (manual brand-run aggregation)", () => {
    expect(content).not.toContain("CampaignCostDistribution");
  });

  it("should no longer fetch + sum the runs cost breakdown client-side", () => {
    expect(content).not.toContain("getBrandCostBreakdown");
    expect(content).not.toContain("brandCostBreakdownToday");
  });

  it("should feed the cost summary from the /revenue spend block", () => {
    expect(content).toContain("spend={revenueRevealed ? data?.spend : null}");
  });
});

/**
 * The cost summary card renders Total spent + the top sources straight off the
 * server `spend` block (totalSpentCents / todaySpentCents / sources[].sharePct),
 * with no client reduce / share-% math — the source-of-truth consistency the
 * original regression demanded, now enforced by features-service.
 */
describe("RevenueCostSummary renders spend verbatim (no client aggregation)", () => {
  const cardPath = path.join(
    __dirname,
    "../src/components/revenue/revenue-cost-summary.tsx"
  );
  const card = fs.readFileSync(cardPath, "utf-8");

  it("reads Total spent + today + sources from the spend block", () => {
    expect(card).toContain("spend?.totalSpentCents");
    expect(card).toContain("spend?.todaySpentCents");
    expect(card).toContain("spend?.sources");
  });

  it("does not sum a cost-breakdown array in the browser", () => {
    expect(card).not.toContain("reduce(");
    expect(card).not.toContain("actualCostInUsdCents");
  });
});
