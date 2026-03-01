import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Brands list page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/page.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should fetch brands with listBrands", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("listBrands");
    expect(content).toContain("useAuthQuery");
  });

  it("should show brand cards with links to brand detail", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("BrandLogo");
    expect(content).toContain("`/orgs/${orgId}/brands/${brand.id}`");
  });

  it("should show empty state when no brands", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("No brands yet");
  });

  it("should have Brands heading", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain(">Brands<");
  });
});
