import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..");

describe("brand-tools removal", () => {
  it("brand-tools component has been removed", () => {
    const componentPath = path.join(SRC, "src/components/brand-tools.tsx");
    expect(fs.existsSync(componentPath)).toBe(false);
  });

  describe("brand-level tool pages have been removed", () => {
    it("outlets tool page does not exist", () => {
      const p = path.join(SRC, "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/outlets/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });

    it("journalists tool page does not exist", () => {
      const p = path.join(SRC, "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/journalists/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });

    it("press-kits tool page does not exist", () => {
      const p = path.join(SRC, "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/press-kits/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });
  });

  describe("campaign-level entity pages have been removed", () => {
    // The campaign concept is hidden from the UI — everything collapses to the
    // brand level. The whole campaigns/[id] subtree is gone.
    it("campaign outlets page does not exist", () => {
      const p = path.join(SRC, "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]/outlets/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });

    it("campaign journalists page does not exist", () => {
      const p = path.join(SRC, "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]/journalists/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
    });

    it("campaign articles page does not exist", () => {
      const p = path.join(SRC, "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]/articles/page.tsx");
      expect(fs.existsSync(p)).toBe(false);
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

    it("exports listBrandJournalists", () => {
      expect(apiSrc).toContain("export async function listBrandJournalists");
    });

    it("exports listJournalistsEnriched", () => {
      expect(apiSrc).toContain("export async function listJournalistsEnriched");
      expect(apiSrc).toContain("/journalists/list");
    });

    it("exports isJournalistContacted helper", () => {
      expect(apiSrc).toContain("export function isJournalistContacted");
    });

    it("exports EnrichedJournalist type with emailStatus and cost", () => {
      expect(apiSrc).toContain("export interface EnrichedJournalist");
      expect(apiSrc).toContain("emailStatus: EmailStatus | null");
      expect(apiSrc).toContain("cost: JournalistCost | null");
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

  describe("leads server page", () => {
    it("asks the producer for a total order", () => {
      // Equal/null engagement timestamps must not fall back to an unsorted array order
      // (it reshuffles on a poll, and after a follow-up UPDATE). lead-service breaks
      // those ties on the row id, so `sort=activity` is total and a page can neither
      // repeat a lead nor skip one — which a client-side sort of ONE page cannot give.
      const q = fs.readFileSync(path.join(SRC, "src/lib/leads-server-page.ts"), "utf-8");
      expect(q).toContain('sort: "activity"');
    });
  });
});
