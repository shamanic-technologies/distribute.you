import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign sidebar uses feature stats for entity counts", () => {
  const sidebarWrapperPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/sidebar-wrapper.tsx"
  );
  const overviewPagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/page.tsx"
  );

  const sidebarContent = fs.readFileSync(sidebarWrapperPath, "utf-8");
  const overviewContent = fs.readFileSync(overviewPagePath, "utf-8");

  describe("sidebar-wrapper", () => {
    it("should fetch feature stats for the campaign", () => {
      expect(sidebarContent).toContain("fetchFeatureStats(featureSlug, { campaignId })");
    });

    it("should use the same query key pattern as the list page", () => {
      expect(sidebarContent).toContain('"featureStats"');
      expect(sidebarContent).toContain('"campaign"');
    });

    it("should map entity names to stat key prefixes", () => {
      expect(sidebarContent).toContain("ENTITY_STAT_PREFIX");
      expect(sidebarContent).toContain('journalists: "journalist"');
      expect(sidebarContent).toContain('outlets: "outlet"');
    });

    it("should prefer feature stats over entity listing counts", () => {
      // The entityCounts should use featureStatCount first, then fall back
      expect(sidebarContent).toContain("featureStatCount.journalists ?? listingCounts.journalists");
      expect(sidebarContent).toContain("featureStatCount.outlets ?? listingCounts.outlets");
    });
  });

  describe("overview page", () => {
    it("should fetch feature stats for charts", () => {
      expect(overviewContent).toContain("fetchFeatureStats(featureSlug, { campaignId })");
    });

    it("should merge feature stats over campaign stats for chart data", () => {
      // Feature stats should take precedence (spread last)
      expect(overviewContent).toContain("{ ...campaignStatsRecord, ...featureStats }");
    });
  });
});
