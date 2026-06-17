import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Regression: Go button on /orgs/[orgId]/brands/[brandId]/campaigns/new
// was disabled because brand-service /internal/brands/:id returns `url` (deployed minimal
// shape) but dashboard `BrandDetail` declared `brandUrl`. resolvedBrandUrl resolved to "",
// disabling the button. Brand-service is also inconsistent: /orgs/brands still emits
// `brandUrl`. Dashboard normalizes that wire field to canonical `url` in listBrands.

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const apiContent = fs.readFileSync(apiPath, "utf-8");

describe("Brand URL field alignment (regression: Go button disabled)", () => {
  describe("api.ts", () => {
    it("Brand uses `url` not `brandUrl`", () => {
      expect(apiContent).toMatch(/interface Brand\s*\{[^}]*\burl:\s*string\s*\|\s*null/);
      expect(apiContent).not.toMatch(/interface Brand\s*\{[^}]*\bbrandUrl:\s*string/);
    });

    it("listBrands normalizes wire `brandUrl` -> `url`", () => {
      expect(apiContent).toContain("normalizeBrandFromOrgs");
      expect(apiContent).toContain("BrandWireOrgs");
    });
  });

  // The new-campaign/launch page case (where this bug was reported) was removed
  // with the manual launch/create flow; api.ts normalization remains the guard
  // for `url` vs `brandUrl` wire-field alignment.

  // The "brand detail page renders brand.url for href" case was removed: the
  // brand root page is now the (sole) feature's Revenue overview and no longer
  // displays a brand-URL link (the feature segment was flattened into the brand).
  // The legacy app-level `features/[featureId]/new` create page was removed in
  // the #1768 follow-up.
});
