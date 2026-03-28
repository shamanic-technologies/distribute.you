import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..");

describe("brand-tools", () => {
  const componentPath = path.join(SRC, "src/components/brand-tools.tsx");
  const componentSrc = fs.readFileSync(componentPath, "utf-8");

  it("component file exists", () => {
    expect(fs.existsSync(componentPath)).toBe(true);
  });

  it("exports BrandToolsSection", () => {
    expect(componentSrc).toContain("export function BrandToolsSection");
  });

  it("renders outlets tool with listBrandOutlets", () => {
    expect(componentSrc).toContain("listBrandOutlets");
    expect(componentSrc).toContain("OutletsTool");
  });

  it("press kits tool is disabled pending backend brand_id filter", () => {
    expect(componentSrc).toContain('title="Press Kits"');
    expect(componentSrc).toContain("Needs brand_id filter on GET /media-kits from backend");
  });

  it("journalists tool is disabled pending backend brand_id filter", () => {
    expect(componentSrc).toContain('title="Journalists"');
    expect(componentSrc).toContain("Needs brand_id filter on GET /campaign-outlet-journalists from backend");
  });

  it("does not use listBrandMediaKits workaround", () => {
    expect(componentSrc).not.toContain("listBrandMediaKits");
  });

  it("brand page imports BrandToolsSection", () => {
    const pagePath = path.join(
      SRC,
      "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"
    );
    const pageSrc = fs.readFileSync(pagePath, "utf-8");
    expect(pageSrc).toContain("BrandToolsSection");
    expect(pageSrc).toContain("<BrandToolsSection");
  });

  describe("api.ts functions", () => {
    const apiPath = path.join(SRC, "src/lib/api.ts");
    const apiSrc = fs.readFileSync(apiPath, "utf-8");

    it("exports listBrandOutlets", () => {
      expect(apiSrc).toContain("export async function listBrandOutlets");
    });

    it("listBrandOutlets calls /outlets?brandId=", () => {
      expect(apiSrc).toContain("/outlets?brandId=${brandId}");
    });

    it("does not have listBrandMediaKits workaround", () => {
      expect(apiSrc).not.toContain("export async function listBrandMediaKits");
    });
  });
});
