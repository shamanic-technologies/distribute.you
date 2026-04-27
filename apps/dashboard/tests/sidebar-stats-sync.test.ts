import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the campaign sidebar badges must use entity.countKey
 * (from the feature definition) to look up feature stats, ensuring the
 * sidebar counts match the campaign list page. No hardcoded stat key
 * mappings — the backend provides the mapping via countKey.
 */
describe("Campaign sidebar badges use entity.countKey from feature definition", () => {
  const wrapperPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/sidebar-wrapper.tsx"
  );
  const content = fs.readFileSync(wrapperPath, "utf-8");

  it("should use entity.countKey to resolve stat values", () => {
    expect(content).toContain("entity.countKey");
    expect(content).toContain("fStats[entity.countKey]");
  });

  it("should NOT have hardcoded entity-to-stat-key mappings", () => {
    expect(content).not.toContain("ENTITY_STAT_PREFIX");
    expect(content).not.toContain("stats?.leadsServed");
    expect(content).not.toContain("stats?.emailsGenerated");
  });

  it("should NOT pass leads.length directly as leadCount", () => {
    expect(content).not.toMatch(/leadCount={leads\.length}/);
  });

  it("should NOT pass emails.length directly as emailCount", () => {
    expect(content).not.toMatch(/emailCount={emails\.length}/);
  });

  it("should use != null (not !== undefined) so null stats fall through to listing fallback", () => {
    expect(content).toContain("fStats[entity.countKey] != null");
    expect(content).not.toContain("fStats[entity.countKey] !== undefined");
  });

  it("should have emails in listingFallback so badge shows even when stats return null", () => {
    // Emails now come from useCampaign() context (campaignEmails), not a separate query
    expect(content).toMatch(/emails:\s*campaignEmails\.length/);
  });
});
