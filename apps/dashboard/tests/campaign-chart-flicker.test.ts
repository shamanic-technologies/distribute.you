import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: campaign charts must use a merged statsRecord (campaign stats +
 * feature stats) and gate rendering on it, not on raw featureStats alone.
 *
 * The anti-flicker useRef was removed because stats is now a mandatory field
 * and keepPreviousData on react-query prevents transient empty responses.
 */
describe("Campaign chart stats rendering", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/page.tsx"
  );

  it("should not use useRef for stats caching (stats is mandatory)", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toMatch(/lastValidStatsRef/);
  });

  it("should gate chart rendering on statsRecord not on raw featureStats", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toMatch(/Object\.keys\(statsRecord\)\.length > 0/);
  });
});
