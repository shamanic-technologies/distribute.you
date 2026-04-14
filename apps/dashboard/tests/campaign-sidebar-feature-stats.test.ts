import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign sidebar uses feature stats via entity.countKey", () => {
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
    it("should fetch feature stats for the campaign using versioned slug", () => {
      expect(sidebarContent).toContain("featureVersionedSlug = featureDef?.slug");
      expect(sidebarContent).toContain("fetchFeatureStats(featureVersionedSlug!, { campaignId })");
    });

    it("should use entity.countKey to look up stats (no hardcoded prefix mapping)", () => {
      expect(sidebarContent).toContain("entity.countKey");
      expect(sidebarContent).not.toContain("ENTITY_STAT_PREFIX");
    });

    it("should fall back to listing counts when countKey is absent", () => {
      expect(sidebarContent).toContain("listingFallback");
    });
  });

  describe("overview page", () => {
    it("should fetch feature stats for charts using versioned slug", () => {
      expect(overviewContent).toContain("featureVersionedSlug = featureDef?.slug");
      expect(overviewContent).toContain("fetchFeatureStats(featureVersionedSlug!, { campaignId })");
    });

    it("should merge feature stats over campaign stats for chart data", () => {
      expect(overviewContent).toContain("{ ...campaignStatsRecord, ...featureStats }");
    });
  });
});
