import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..");

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
  });

  describe("press-kits list page", () => {
    const pagePath = path.join(
      SRC,
      "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/press-kits/page.tsx",
    );
    const pageSrc = fs.readFileSync(pagePath, "utf-8");

    it("page file exists", () => {
      expect(fs.existsSync(pagePath)).toBe(true);
    });

    it("has generate form with editMediaKit", () => {
      expect(pageSrc).toContain("editMediaKit");
      expect(pageSrc).toContain("GenerateForm");
      expect(pageSrc).toContain("instruction");
    });

    it("has stats bar with getMediaKitViewStats", () => {
      expect(pageSrc).toContain("getMediaKitViewStats");
      expect(pageSrc).toContain("StatsBar");
    });

    it("has latest validated preview section", () => {
      expect(pageSrc).toContain("LatestValidatedPreview");
      expect(pageSrc).toContain("latestValidated");
    });

    it("links to individual kit detail pages", () => {
      expect(pageSrc).toContain("/tools/press-kits/${kit.id}");
    });

    it("has validate, archive, cancel actions", () => {
      expect(pageSrc).toContain("validateMediaKit");
      expect(pageSrc).toContain("updateMediaKitStatus");
      expect(pageSrc).toContain("cancelDraftMediaKit");
    });

    it("shows archived kits in collapsible section", () => {
      expect(pageSrc).toContain("showArchived");
      expect(pageSrc).toContain("archived");
    });

    it("polls for updates", () => {
      expect(pageSrc).toContain("POLL_INTERVAL");
      expect(pageSrc).toContain("refetchInterval");
    });
  });

  describe("press-kit detail page", () => {
    const detailPath = path.join(
      SRC,
      "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/press-kits/[kitId]/page.tsx",
    );
    const detailSrc = fs.readFileSync(detailPath, "utf-8");

    it("detail page file exists", () => {
      expect(fs.existsSync(detailPath)).toBe(true);
    });

    it("renders MDX content with react-markdown", () => {
      expect(detailSrc).toContain("react-markdown");
      expect(detailSrc).toContain("MdxPreview");
      expect(detailSrc).toContain("mdxPageContent");
    });

    it("has breadcrumb with 3 levels (brand > press kits > kit)", () => {
      expect(detailSrc).toContain("/tools/press-kits`");
      expect(detailSrc).toContain("Press Kits");
      expect(detailSrc).toContain("kit?.title");
    });

    it("shows view stats for validated kits", () => {
      expect(detailSrc).toContain("getMediaKitViewStats");
      expect(detailSrc).toContain("totalViews");
      expect(detailSrc).toContain("uniqueVisitors");
    });

    it("has regenerate flow", () => {
      expect(detailSrc).toContain("showRegenerate");
      expect(detailSrc).toContain("regenerateInstruction");
      expect(detailSrc).toContain("editMediaKit");
    });

    it("has validate and archive actions", () => {
      expect(detailSrc).toContain("validateMediaKit");
      expect(detailSrc).toContain("updateMediaKitStatus");
      expect(detailSrc).toContain("cancelDraftMediaKit");
    });

    it("shows version history sidebar", () => {
      expect(detailSrc).toContain("VersionHistory");
      expect(detailSrc).toContain("listBrandMediaKits");
    });

    it("shows public URL for validated kits", () => {
      expect(detailSrc).toContain("publicUrl");
      expect(detailSrc).toContain("View Public Page");
      expect(detailSrc).toContain("Copy Link");
    });

    it("shows denial reason when denied", () => {
      expect(detailSrc).toContain("denialReason");
    });
  });

  describe("press-kit-results component updated", () => {
    const resultsPath = path.join(SRC, "src/components/campaign/press-kit-results.tsx");
    const resultsSrc = fs.readFileSync(resultsPath, "utf-8");

    it("uses MediaKitSummary instead of MediaKit", () => {
      expect(resultsSrc).toContain("MediaKitSummary");
    });

    it("uses contentExcerpt instead of mdxPageContent", () => {
      expect(resultsSrc).toContain("contentExcerpt");
      expect(resultsSrc).not.toContain("mdxPageContent");
    });
  });
});
