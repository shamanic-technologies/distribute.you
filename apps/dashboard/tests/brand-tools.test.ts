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

  it("journalists tool is disabled pending backend endpoint", () => {
    expect(componentSrc).toContain('title="Journalists"');
    expect(componentSrc).toContain("disabled");
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

    it("exports listBrandMediaKits", () => {
      expect(apiSrc).toContain("export async function listBrandMediaKits");
    });

    it("listBrandMediaKits filters by brandId", () => {
      expect(apiSrc).toContain("kit => kit.brandId === brandId");
    });
  });
});
