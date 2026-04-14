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

  describe("Field extraction fetching", () => {
    it("should use listExtractedFields to read cached fields", () => {
      expect(content).toContain("listExtractedFields(brandId)");
    });

    it("should use extractBrandFields for regeneration", () => {
      expect(content).toContain("extractBrandFields([brandId], SALES_PROFILE_FIELDS");
    });

    it("should use brandExtractedFields query key", () => {
      expect(content).toContain('"brandExtractedFields"');
    });
  });

  describe("Scraped URLs display", () => {
    it("should collect unique sourceUrls from field results", () => {
      expect(content).toContain("scrapedUrls");
      expect(content).toContain("sourceUrls");
    });

    it("should show Scraped Pages section in run detail panel for extraction runs", () => {
      expect(content).toContain("Scraped Pages");
      expect(content).toContain('target="_blank"');
      expect(content).toContain("shortenUrl(url)");
    });

    it("should have a shortenUrl helper", () => {
      expect(content).toContain("function shortenUrl");
    });
  });

  describe("Regenerate button", () => {
    it("should show button when brand exists (Generate or Regenerate)", () => {
      expect(content).toContain("brand && (");
      expect(content).toContain('"Generate"');
    });

    it("should show Regenerate label (not Generate)", () => {
      expect(content).toContain('"Regenerate"');
      expect(content).toContain('"Regenerating..."');
    });

    it("should use extractBrandFields for regeneration with resetCache", () => {
      expect(content).toContain("extractBrandFields([brandId], SALES_PROFILE_FIELDS, { resetCache: true })");
    });

    it("should invalidate queries after regeneration", () => {
      expect(content).toContain('invalidateQueries({ queryKey: ["brandExtractedFields"');
      expect(content).toContain('invalidateQueries({ queryKey: ["brandRuns"');
    });
  });
});

describe("API brand functions", () => {
  const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
  const content = fs.readFileSync(apiPath, "utf-8");

  it("should have extractBrandFields function returning map-based results", () => {
    expect(content).toContain("export async function extractBrandFields");
    expect(content).toContain('method: "POST"');
    expect(content).toContain("/extract-fields");
    expect(content).toContain("Record<string, ExtractFieldResult>");
  });

  it("should have listExtractedFields function for GET /extracted-fields", () => {
    expect(content).toContain("export async function listExtractedFields");
    expect(content).toContain("/extracted-fields");
    expect(content).toContain("CachedField[]");
  });

  it("should have CachedField type with key, value, sourceUrls, extractedAt, expiresAt", () => {
    expect(content).toContain("interface CachedField");
    expect(content).toMatch(/CachedField[\s\S]*key: string/);
  });

  it("should have ExtractFieldResult type without key field", () => {
    expect(content).toContain("interface ExtractFieldResult");
    expect(content).toContain("cached: boolean");
    expect(content).toContain("extractedAt: string");
    expect(content).toContain("sourceUrls: string[] | null");
  });

  it("should have Brand interface with new fields (logoUrl, elevatorPitch, updatedAt)", () => {
    expect(content).toContain("logoUrl: string | null");
    expect(content).toContain("elevatorPitch: string | null");
    expect(content).toContain("updatedAt: string | null");
  });

  it("should have BrandDetail extending Brand", () => {
    expect(content).toContain("interface BrandDetail extends Brand");
    expect(content).toContain("bio: string | null");
    expect(content).toContain("mission: string | null");
    expect(content).toContain("location: string | null");
    expect(content).toContain("categories: string | null");
  });

  it("should have BrandRun without id field", () => {
    expect(content).toContain("interface BrandRun");
    expect(content).toContain("serviceName: string | null");
    expect(content).toContain("taskName: string | null");
    expect(content).toContain("descendantRuns: unknown[]");
  });

  it("should have RunCost with actualCostInUsdCents instead of unitCostInUsdCents", () => {
    expect(content).toContain("actualCostInUsdCents: string");
    expect(content).toContain("provisionedCostInUsdCents: string");
    expect(content).not.toContain("unitCostInUsdCents");
  });

  it("should have fieldResultsToMap accepting map-based results", () => {
    expect(content).toContain("function fieldResultsToMap(results: Record<string, ExtractFieldResult>)");
  });

  it("should have SALES_PROFILE_FIELDS constant", () => {
    expect(content).toContain("export const SALES_PROFILE_FIELDS");
    expect(content).toContain("valueProposition");
    expect(content).toContain("customerPainPoints");
    expect(content).toContain("callToAction");
  });

  it("should NOT have old sales-profile functions", () => {
    expect(content).not.toContain("export async function getBrandSalesProfile");
    expect(content).not.toContain("export async function createBrandSalesProfile");
    expect(content).not.toContain("export async function refreshBrandSalesProfile");
    expect(content).not.toContain("interface SalesProfile");
  });
});
