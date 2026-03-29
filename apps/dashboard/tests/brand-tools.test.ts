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

  it("renders press kits tool with listBrandMediaKits", () => {
    expect(componentSrc).toContain("listBrandMediaKits");
    expect(componentSrc).toContain("PressKitsTool");
  });

  it("press kits tool is enabled (not disabled)", () => {
    // Press Kits ToolCard should NOT have disabled prop
    const pressKitSection = componentSrc.slice(
      componentSrc.indexOf('title="Press Kits"'),
      componentSrc.indexOf('title="Journalists"'),
    );
    expect(pressKitSection).not.toContain("disabled");
  });

  it("journalists tool is disabled pending api-service route", () => {
    expect(componentSrc).toContain('title="Journalists"');
    expect(componentSrc).toContain("Needs api-service route");
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

    it("exports listBrandMediaKits using backend brand_id filter", () => {
      expect(apiSrc).toContain("export async function listBrandMediaKits");
      expect(apiSrc).toContain("/press-kits/media-kits?brand_id=${brandId}");
    });

    it("listBrandMediaKits does NOT filter client-side", () => {
      // Should use the backend filter, not .filter()
      const fnStart = apiSrc.indexOf("async function listBrandMediaKits");
      const fnEnd = apiSrc.indexOf("}", fnStart + 100);
      const fnBody = apiSrc.slice(fnStart, fnEnd);
      expect(fnBody).not.toContain(".filter(");
    });
  });
});
