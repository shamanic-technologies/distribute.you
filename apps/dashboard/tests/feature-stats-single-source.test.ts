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
// The campaigns LIST page was removed with the campaign concept; the brand
// Overview (brands/[brandId]/page.tsx) is the surviving feature-stats surface.
// It derives stats from the centralized fetchFeatureStats endpoint (the
// formatStatValue / chart rendering now lives in the revenue/outreach
// components, not inline on this page).
describe("Brand overview stats use the centralized feature stats endpoint", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"
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
});
