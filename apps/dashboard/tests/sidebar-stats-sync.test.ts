import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the campaign sidebar badges (Leads, Emails, Journalists,
 * etc.) must use the same data source as the campaign list page
 * (fetchFeatureStats) so that the numbers displayed in the sidebar and the
 * list page always match.
 *
 * Previously, the sidebar used getCampaignStats + entity listing endpoints
 * (listCampaignLeads / listCampaignJournalists), while the list page used
 * fetchFeatureStats. These came from different API systems, causing visible
 * number mismatches (e.g. 0 journalists on detail vs 3 on list).
 */
describe("Campaign sidebar badges use stats counters", () => {
  const wrapperPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/sidebar-wrapper.tsx"
  );
  const content = fs.readFileSync(wrapperPath, "utf-8");

  it("should fetch feature stats for the campaign (same source as list page)", () => {
    expect(content).toContain("fetchFeatureStats(featureSlug, { campaignId })");
  });

  it("should use feature stats as primary source for entity counts", () => {
    expect(content).toContain("featureStatCount.leads");
    expect(content).toContain("featureStatCount.journalists");
    expect(content).toContain("featureStatCount.emails");
  });

  it("should NOT pass leads.length directly as leadCount", () => {
    // leads.length should only appear as a fallback, not as the primary value
    expect(content).not.toMatch(/leadCount={leads\.length}/);
  });

  it("should NOT pass emails.length directly as emailCount", () => {
    expect(content).not.toMatch(/emailCount={emails\.length}/);
  });
});
