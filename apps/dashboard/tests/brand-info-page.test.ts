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

  describe("Sales profile fetching (get-or-create)", () => {
    it("should use getBrandSalesProfile to fetch profile", () => {
      expect(content).toContain("getBrandSalesProfile(brandId)");
    });

    it("should extract cached field from profile response", () => {
      expect(content).toContain("profileData?.cached");
    });

    it("should not handle 404 — endpoint is get-or-create", () => {
      expect(content).not.toContain("not found");
      expect(content).not.toContain("404");
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

    it("should use generateSalesProfile with skipCache for regeneration", () => {
      expect(content).toContain("generateSalesProfile");
      expect(content).toContain("skipCache: true");
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

  it("should NOT have 404 fallback — endpoint is get-or-create", () => {
    // getBrandSalesProfile should not catch 404 errors
    const fnMatch = content.match(
      /export async function getBrandSalesProfile[\s\S]*?^}/m
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).not.toContain("not found");
    expect(fnBody).not.toContain("null");
  });
});
