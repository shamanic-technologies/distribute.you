import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Brand info page", () => {
  const pagePath = path.resolve(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should be a client component", () => {
    expect(content).toContain('"use client"');
  });

  describe("Sales profile fetching", () => {
    it("should use getBrandSalesProfile to fetch profile", () => {
      expect(content).toContain("getBrandSalesProfile(brandId)");
    });

    it("should extract cached field from profile response", () => {
      expect(content).toContain("profileData?.cached");
    });
  });

  describe("Regenerate button", () => {
    it("should only show button when profile exists", () => {
      expect(content).toContain("brandUrl && profile");
    });

    it("should show Regenerate label (not Generate)", () => {
      expect(content).toContain('"Regenerate"');
      expect(content).toContain('"Regenerating..."');
    });

    it("should use refreshBrandSalesProfile for regeneration", () => {
      expect(content).toContain("refreshBrandSalesProfile");
    });

    it("should invalidate queries after regeneration", () => {
      expect(content).toContain('invalidateQueries({ queryKey: ["brandSalesProfile"');
      expect(content).toContain('invalidateQueries({ queryKey: ["brandRuns"');
    });
  });
});

describe("API getBrandSalesProfile function", () => {
  const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
  const content = fs.readFileSync(apiPath, "utf-8");

  it("should return cached and brandId fields alongside profile", () => {
    expect(content).toContain("cached: boolean");
    expect(content).toContain("profile: SalesProfile; cached: boolean; brandId: string");
  });

  it("should have createBrandSalesProfile for triggering extraction", () => {
    expect(content).toContain("export async function createBrandSalesProfile");
    expect(content).toContain('method: "POST"');
  });

  it("should have refreshBrandSalesProfile for re-extraction", () => {
    expect(content).toContain("export async function refreshBrandSalesProfile");
    expect(content).toContain('method: "PUT"');
  });
});
