import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Regression: Go button on /orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new
// was disabled because brand-service /internal/brands/:id returns `url` (deployed minimal
// shape) but dashboard `BrandDetail` declared `brandUrl`. resolvedBrandUrl resolved to "",
// disabling the button. Brand-service is also inconsistent: /orgs/brands still emits
// `brandUrl`. Dashboard normalizes that wire field to canonical `url` in listBrands.

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const apiContent = fs.readFileSync(apiPath, "utf-8");

const newCampaignPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
);
const newCampaignPage = fs.readFileSync(newCampaignPagePath, "utf-8");

const brandDetailPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
);
const brandDetailPage = fs.readFileSync(brandDetailPagePath, "utf-8");

const legacyNewPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/features/[featureId]/new/page.tsx",
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

  describe("new campaign page (the page where the bug was reported)", () => {
    it("reads brand?.url for resolvedBrandUrl (not brand?.brandUrl)", () => {
      expect(newCampaignPage).toContain("brand?.url ?? \"\"");
      expect(newCampaignPage).not.toContain("brand?.brandUrl");
    });

    it("reads b.url when mapping additionalBrands to URLs", () => {
      expect(newCampaignPage).toContain("additionalBrands.map((b) => b.url)");
      expect(newCampaignPage).not.toContain("additionalBrands.map((b) => b.brandUrl)");
    });
  });

  describe("brand detail page", () => {
    it("renders brand.url for href, not brand.brandUrl", () => {
      expect(brandDetailPage).toContain("href={brand.url}");
      expect(brandDetailPage).not.toContain("href={brand.brandUrl}");
    });
  });

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
