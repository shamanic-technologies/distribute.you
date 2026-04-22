import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the feature overview page must derive ALL stats from the
 * centralized fetchFeatureStats endpoint so that charts and campaign rows
 * update in sync on every poll cycle.
 *
 * The new architecture uses feature.charts[] to drive chart rendering and
 * feature.outputs[] + stats registry for dynamic stat display, replacing
 * hardcoded field aggregation.
 */
describe("Feature page stats use centralized feature stats endpoint", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should NOT import getBrandDeliveryStats", () => {
    expect(content).not.toContain("getBrandDeliveryStats");
  });

  it("should NOT fetch from email-gateway/stats", () => {
    expect(content).not.toContain("email-gateway/stats");
  });

  it("should NOT manually aggregate individual stat fields", () => {
    // Old pattern: manual reduce over individual fields
    expect(content).not.toContain("acc.emailsContacted");
    expect(content).not.toContain("acc.emailsDelivered");
  });

  it("should use fetchFeatureStats as the single data source", () => {
    expect(content).toContain("fetchFeatureStats");
  });

  it("should use formatStatValue for dynamic stat display", () => {
    expect(content).toContain("formatStatValue");
  });

  it("should use charts from featureDef for rendering", () => {
    expect(content).toContain("funnelChart");
    expect(content).toContain("breakdownChart");
    expect(content).toContain("featureDef?.charts");
  });
});
