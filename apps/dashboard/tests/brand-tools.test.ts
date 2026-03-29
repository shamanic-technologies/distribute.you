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

  it("renders journalists tool with listBrandJournalists", () => {
    expect(componentSrc).toContain("listBrandJournalists");
    expect(componentSrc).toContain("JournalistsTool");
  });

  it("all three tools are enabled (none have disabled prop set)", () => {
    // No ToolCard should have disabled or disabledReason props passed
    const toolCardUsages = componentSrc.match(/<ToolCard[\s\S]*?>/g) ?? [];
    for (const usage of toolCardUsages) {
      expect(usage).not.toMatch(/\bdisabled\b/);
    }
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

    it("exports listBrandOutlets calling /outlets?brandId=", () => {
      expect(apiSrc).toContain("export async function listBrandOutlets");
      expect(apiSrc).toContain("/outlets?brandId=${brandId}");
    });

    it("exports listBrandMediaKits calling /press-kits/media-kits?brand_id=", () => {
      expect(apiSrc).toContain("export async function listBrandMediaKits");
      expect(apiSrc).toContain("/press-kits/media-kits?brand_id=${brandId}");
    });

    it("exports listBrandJournalists calling /journalists?brandId=", () => {
      expect(apiSrc).toContain("export async function listBrandJournalists");
      expect(apiSrc).toContain("/journalists?brandId=${brandId}");
    });

    it("exports BrandJournalist type", () => {
      expect(apiSrc).toContain("export interface BrandJournalist");
    });
  });
});
