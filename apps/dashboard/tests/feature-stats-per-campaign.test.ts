import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the feature overview page must fetch stats from the
 * centralized fetchFeatureStats endpoint (grouped by campaignId) instead of
 * per-campaign getCampaignStats calls or the broken batch endpoint.
 *
 * The new architecture uses:
 * - fetchFeatureStats(slug, { brandId }) for aggregate feature stats
 * - fetchFeatureStats(slug, { groupBy: "campaignId", brandId }) for per-campaign stats
 */
describe("Feature page fetches stats from centralized feature stats endpoint", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should use fetchFeatureStats for stats (not getCampaignStats or getCampaignBatchStats)", () => {
    expect(content).toContain("fetchFeatureStats");
    expect(content).not.toContain("getCampaignStats");
    expect(content).not.toContain("getCampaignBatchStats");
  });

  it("should fetch per-campaign stats with groupBy=campaignId", () => {
    expect(content).toContain('groupBy: "campaignId"');
  });

  it("should fetch aggregate feature stats with brandId filter", () => {
    expect(content).toContain("fetchFeatureStats(featureDynastySlug, { brandId })");
  });

  it("should NOT use useQueries for individual campaign stats", () => {
    expect(content).not.toContain("useQueries");
  });
});
