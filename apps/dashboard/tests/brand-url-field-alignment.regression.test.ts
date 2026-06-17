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

const legacyNewPagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/features/[featureId]/new/page.tsx",
);
const legacyNewPage = fs.readFileSync(legacyNewPagePath, "utf-8");

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

  // The new-campaign-page case (where this bug was reported) was removed with the
  // campaigns/new create form; the api.ts normalization + the legacy features/new
  // page below still guard the `url` vs `brandUrl` wire-field alignment.

  // The "brand detail page renders brand.url for href" case was removed: the
  // brand root page is now the (sole) feature's Revenue overview and no longer
  // displays a brand-URL link (the feature segment was flattened into the brand).

  describe("legacy features/[featureId]/new page", () => {
    it("reads b.url for the selected brand lookup", () => {
      expect(legacyNewPage).toContain("?.url ?? \"\"");
      expect(legacyNewPage).not.toMatch(/\.find\([^)]+\)\?\.brandUrl/);
    });

    it("reads b.url in the brand option label fallback chain", () => {
      expect(legacyNewPage).toContain("b.name || b.domain || b.url");
    });
  });
});
