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

  it("renders outlets tool link", () => {
    expect(componentSrc).toContain('"Outlets"');
    expect(componentSrc).toContain("outlets");
  });

  it("renders journalists tool link", () => {
    expect(componentSrc).toContain('"Journalists"');
    expect(componentSrc).toContain("journalists");
  });

  it("does NOT render press kits as a tool (moved to campaign)", () => {
    expect(componentSrc).not.toContain('"Press Kits"');
  });

  it("all tools are enabled (none have disabled prop set)", () => {
    const toolCardUsages = componentSrc.match(/<ToolLinkCard[\s\S]*?\/>/g) ?? [];
    for (const usage of toolCardUsages) {
      expect(usage).not.toMatch(/\bdisabled={true}/);
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

  describe("tool pages exist", () => {
    it("outlets tool page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/outlets/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("journalists tool page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/journalists/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("press-kits tool page has been removed", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/press-kits/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });

    it("press-kit detail tool page has been removed", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/press-kits/[kitId]/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });
  });

  describe("campaign press-kit pages exist", () => {
    it("campaign press-kits list page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/press-kits/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("campaign press-kit detail page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/press-kits/[kitId]/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });
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
