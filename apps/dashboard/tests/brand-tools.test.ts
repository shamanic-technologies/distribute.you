import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..");

describe("brand-tools removal", () => {
  it("brand-tools component has been removed", () => {
    const componentPath = path.join(SRC, "src/components/brand-tools.tsx");
    expect(fs.existsSync(componentPath)).toBe(false);
  });

  it("brand page does NOT import BrandToolsSection", () => {
    const pagePath = path.join(
      SRC,
      "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"
    );
    const pageSrc = fs.readFileSync(pagePath, "utf-8");
    expect(pageSrc).not.toContain("BrandToolsSection");
    expect(pageSrc).not.toContain("brand-tools");
  });

  describe("brand-level tool pages have been removed", () => {
    it("outlets tool page does not exist", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/outlets/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });

    it("journalists tool page does not exist", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/journalists/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });

    it("press-kits tool page does not exist", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/press-kits/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });
  });

  describe("campaign-level entity pages exist", () => {
    it("campaign outlets page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/outlets/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("campaign journalists page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/journalists/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("campaign press-kits list page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/press-kits/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("campaign press-kit detail page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/press-kits/[kitId]/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("campaign articles page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/articles/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });
  });

  describe("api.ts functions", () => {
    const apiPath = path.join(SRC, "src/lib/api.ts");
    const apiSrc = fs.readFileSync(apiPath, "utf-8");

    it("exports fetchEntityRegistry", () => {
      expect(apiSrc).toContain("export async function fetchEntityRegistry");
      expect(apiSrc).toContain("/features/entities/registry");
    });

    it("exports EntityRegistry type", () => {
      expect(apiSrc).toContain("export type EntityRegistry");
      expect(apiSrc).toContain("export interface EntityRegistryEntry");
    });

    it("exports listCampaignOutlets", () => {
      expect(apiSrc).toContain("export async function listCampaignOutlets");
    });

    it("exports listBrandJournalists", () => {
      expect(apiSrc).toContain("export async function listBrandJournalists");
    });

    it("exports listBrandLeads", () => {
      expect(apiSrc).toContain("export async function listBrandLeads");
    });

    it("exports listBrandEmails", () => {
      expect(apiSrc).toContain("export async function listBrandEmails");
    });

    it("exports listBrandArticles", () => {
      expect(apiSrc).toContain("export async function listBrandArticles");
    });
  });

  describe("feature-level entity pages exist", () => {
    it("feature outlets page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/outlets/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("feature journalists page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/journalists/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("feature leads page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/leads/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("feature emails page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/emails/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("feature articles page exists", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/articles/page.tsx");
      expect(fs.existsSync(p)).toBe(true);
    });

    it("feature outlets page uses listBrandOutlets (brand-level filter)", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/outlets/page.tsx");
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("listBrandOutlets");
      expect(src).not.toContain("listCampaignOutlets");
    });

    it("feature journalists page uses listBrandJournalists (brand-level filter)", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/journalists/page.tsx");
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("listBrandJournalists");
      expect(src).not.toContain("listCampaignJournalists");
    });

    it("feature journalists page only shows skeleton on first load (not on refetch)", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/journalists/page.tsx");
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("isFirstLoad");
      expect(src).toContain("if (isFirstLoad)");
      expect(src).not.toMatch(/if \(journalistsLoading\)\s*\{/);
    });

    it("campaign journalists page only shows skeleton on first load (not on refetch)", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/journalists/page.tsx");
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("isFirstLoad");
      expect(src).toContain("if (isFirstLoad)");
      expect(src).not.toMatch(/if \(journalistsLoading\)\s*\{/);
    });

    it("feature leads page uses listBrandLeads (brand-level filter)", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/leads/page.tsx");
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("listBrandLeads");
    });

    it("feature emails page uses listBrandEmails (brand-level filter)", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/emails/page.tsx");
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("listBrandEmails");
    });

    it("feature articles page uses listBrandArticles (brand-level filter)", () => {
      const p = path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/articles/page.tsx");
      const src = fs.readFileSync(p, "utf-8");
      expect(src).toContain("listBrandArticles");
    });
  });

  describe("context-sidebar shows entity tabs at feature level", () => {
    const sidebarPath = path.join(SRC, "src/components/context-sidebar.tsx");
    const sidebarSrc = fs.readFileSync(sidebarPath, "utf-8");

    it("imports useEntityRegistry", () => {
      expect(sidebarSrc).toContain("useEntityRegistry");
      expect(sidebarSrc).toContain("entity-registry-context");
    });

    it("FeatureLevelSidebar uses entity registry to build entity items", () => {
      expect(sidebarSrc).toContain("registry[e.name]");
      expect(sidebarSrc).toContain("entityItems");
    });

    it("FeatureLevelSidebar fetches brand-level counts for entity badges", () => {
      expect(sidebarSrc).toContain("fetchFeatureStats");
      expect(sidebarSrc).toContain("entityCounts");
      expect(sidebarSrc).toContain("badge: entityCounts[e.name]");
    });
  });

  describe("campaign-sidebar uses entity registry", () => {
    const sidebarPath = path.join(SRC, "src/components/campaign-sidebar.tsx");
    const sidebarSrc = fs.readFileSync(sidebarPath, "utf-8");

    it("does NOT have hardcoded ENTITY_CONFIG", () => {
      expect(sidebarSrc).not.toContain("ENTITY_CONFIG");
    });

    it("imports useEntityRegistry", () => {
      expect(sidebarSrc).toContain("useEntityRegistry");
      expect(sidebarSrc).toContain("entity-registry-context");
    });

    it("uses registry from context to build entity items", () => {
      expect(sidebarSrc).toContain("registry[e.name]");
    });
  });
});
