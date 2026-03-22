import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the feature overview page must fetch stats per-campaign
 * using getCampaignStats (same endpoint as the campaign detail page) instead
 * of the batch endpoint getCampaignBatchStats which returns zeros.
 *
 * The batch endpoint GET /campaigns/stats?brandId=... has a bug in api-service
 * that returns zero stats. The per-campaign endpoint GET /campaigns/{id}/stats
 * works correctly and is what the campaign detail page uses.
 */
describe("Feature page fetches per-campaign stats (not batch)", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should import getCampaignStats (per-campaign endpoint)", () => {
    expect(content).toContain("getCampaignStats");
  });

  it("should NOT use getCampaignBatchStats (broken batch endpoint)", () => {
    expect(content).not.toContain("getCampaignBatchStats");
  });

  it("should use useQueries to fetch stats for each campaign", () => {
    expect(content).toContain("useQueries");
  });

  it("should use the same query key as campaign detail page", () => {
    // The campaign detail page (campaign-context.tsx) uses ["campaignStats", campaignId]
    expect(content).toContain('["campaignStats", c.id]');
  });
});
