import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: When the feature stats API intermittently returns a response
 * without the optional `stats` field, the campaign charts would unmount
 * (all bars drop to 0) and remount on the next successful poll 5s later,
 * causing visible flicker.
 *
 * Fix: the page retains the last valid statsRecord so charts never show
 * empty data when valid data was previously available.
 */
describe("Campaign chart flicker prevention", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/page.tsx"
  );

  it("should retain last valid stats via useRef to prevent flicker", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    // The page must use a ref to hold the last valid stats record
    expect(content).toMatch(/lastValidStatsRef/);
    expect(content).toMatch(/useRef/);
  });

  it("should gate chart rendering on statsRecord (stable) not on raw featureStats", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    // The chart conditional must use statsRecord (which is stable) not the raw featureStats
    // It should NOT contain a condition like `Object.keys(featureStats).length > 0`
    // for gating chart rendering
    expect(content).toMatch(/Object\.keys\(statsRecord\)\.length > 0/);
  });
});
