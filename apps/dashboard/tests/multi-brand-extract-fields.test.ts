import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Multi-brand extract-fields response types", () => {
  const apiContent = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");

  it("defines BrandFieldExtraction with value, cached, extractedAt, expiresAt, sourceUrls", () => {
    expect(apiContent).toContain("export interface BrandFieldExtraction");
    expect(apiContent).toContain("extractedAt: string");
    expect(apiContent).toContain("expiresAt: string");
  });

  it("ExtractFieldResult includes optional byBrand map", () => {
    const start = apiContent.indexOf("export interface ExtractFieldResult");
    const end = apiContent.indexOf("}", start) + 1;
    const block = apiContent.slice(start, end);
    expect(block).toContain("byBrand?: Record<string, BrandFieldExtraction>");
  });

  it("defines ExtractFieldsResponse with brands[] and fields map", () => {
    expect(apiContent).toContain("export interface ExtractFieldsResponse");
    expect(apiContent).toContain("brands: ExtractFieldBrandInfo[]");
    expect(apiContent).toContain("fields: Record<string, ExtractFieldResult>");
  });

  it("extractBrandFields uses header-based endpoint (no brandId in path)", () => {
    const fnStart = apiContent.indexOf("export async function extractBrandFields");
    const fnEnd = apiContent.indexOf("\n}", fnStart) + 2;
    const fn = apiContent.slice(fnStart, fnEnd);
    expect(fn).toContain("`/brands/extract-fields`");
    expect(fn).not.toContain("${brandId}");
    expect(fn).toContain("headers");
  });

  it("defines PrefillFullFieldResult with byBrand for format=full", () => {
    expect(apiContent).toContain("export interface PrefillFullFieldResult");
    const start = apiContent.indexOf("export interface PrefillFullFieldResult");
    const end = apiContent.indexOf("}", start) + 1;
    const block = apiContent.slice(start, end);
    expect(block).toContain("byBrand?: Record<string, BrandFieldExtraction>");
  });

  it("callers pass x-brand-id via headers instead of brandId path param", () => {
    const brandsPage = fs.readFileSync(
      path.join(__dirname, "../src/app/(dashboard)/orgs/[orgId]/brands/page.tsx"),
      "utf-8",
    );
    const brandInfoPage = fs.readFileSync(
      path.join(__dirname, "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info/page.tsx"),
      "utf-8",
    );
    expect(brandsPage).toContain('"x-brand-id"');
    expect(brandInfoPage).toContain('"x-brand-id"');
  });
});
