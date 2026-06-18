import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..");

// NOTE: the press-kit dashboard pages lived ONLY under the campaign subtree
// (campaigns/[id]/press-kits) and were removed with the campaign concept, along
// with the press-kit-results component. There is no brand-level press-kits page
// (it was never built — see CLAUDE.md). The MediaKit API types below survive and
// remain the contract for any future brand-level re-home.
describe("press-kit-dashboard", () => {
  const apiPath = path.join(SRC, "src/lib/api.ts");
  const apiSrc = fs.readFileSync(apiPath, "utf-8");

  describe("API types", () => {
    it("exports MediaKitSummary with contentExcerpt", () => {
      expect(apiSrc).toContain("export interface MediaKitSummary");
      expect(apiSrc).toContain("contentExcerpt: string | null");
    });

    it("exports MediaKit extending MediaKitSummary with mdxPageContent", () => {
      expect(apiSrc).toContain("export interface MediaKit extends MediaKitSummary");
      expect(apiSrc).toContain("mdxPageContent: string | null");
    });

    it("exports MediaKitViewStats type", () => {
      expect(apiSrc).toContain("export interface MediaKitViewStats");
      expect(apiSrc).toContain("totalViews: number");
      expect(apiSrc).toContain("uniqueVisitors: number");
    });

    it("list functions return MediaKitSummary[]", () => {
      expect(apiSrc).toContain("Promise<MediaKitSummary[]>");
    });

    it("exports getMediaKitViewStats function", () => {
      expect(apiSrc).toContain("export async function getMediaKitViewStats");
      expect(apiSrc).toContain("/press-kits/media-kits/stats/views");
    });

    it("MediaKitSummary has parentMediaKitId for version tracking", () => {
      expect(apiSrc).toContain("parentMediaKitId: string | null");
    });

    it("MediaKitSummary has publicUrl from backend", () => {
      expect(apiSrc).toContain("publicUrl: string | null");
    });

    it("MediaKitStatus type includes 'failed'", () => {
      expect(apiSrc).toContain('"failed"');
    });
  });

  describe("tools + campaign press-kits pages removed", () => {
    it("tools press-kits list page does not exist", () => {
      const pagePath = path.join(
        SRC,
        "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/press-kits/page.tsx",
      );
      expect(fs.existsSync(pagePath)).toBe(false);
    });

    it("campaign press-kits list page does not exist", () => {
      const pagePath = path.join(
        SRC,
        "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]/press-kits/page.tsx",
      );
      expect(fs.existsSync(pagePath)).toBe(false);
    });

    it("campaign press-kit detail page does not exist", () => {
      const detailPath = path.join(
        SRC,
        "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]/press-kits/[kitId]/page.tsx",
      );
      expect(fs.existsSync(detailPath)).toBe(false);
    });
  });
});
