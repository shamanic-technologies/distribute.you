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

    it("MediaKitSummary has publicUrl from backend", () => {
      expect(apiSrc).toContain("publicUrl: string | null");
    });
  });

  describe("tools press-kits pages removed", () => {
    it("tools press-kits list page does not exist", () => {
      const pagePath = path.join(
        SRC,
        "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/press-kits/page.tsx",
      );
      expect(fs.existsSync(pagePath)).toBe(false);
    });

    it("tools press-kit detail page does not exist", () => {
      const detailPath = path.join(
        SRC,
        "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/tools/press-kits/[kitId]/page.tsx",
      );
      expect(fs.existsSync(detailPath)).toBe(false);
    });
  });

  describe("campaign press-kits list page", () => {
    const pagePath = path.join(
      SRC,
      "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/press-kits/page.tsx",
    );
    const pageSrc = fs.readFileSync(pagePath, "utf-8");

    it("page file exists", () => {
      expect(fs.existsSync(pagePath)).toBe(true);
    });

    it("uses editMediaKit for retry on failed kits", () => {
      expect(pageSrc).toContain("editMediaKit");
    });

    it("has stats bar with getMediaKitViewStats", () => {
      expect(pageSrc).toContain("getMediaKitViewStats");
      expect(pageSrc).toContain("StatsBar");
    });

    it("has latest validated preview section", () => {
      expect(pageSrc).toContain("LatestValidatedPreview");
      expect(pageSrc).toContain("latestValidated");
    });

    it("links to individual kit detail pages within campaign", () => {
      expect(pageSrc).toContain("basePath");
      expect(pageSrc).toContain("`${basePath}/${kit.id}`");
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

    it("handles failed status with retry action", () => {
      expect(pageSrc).toContain('"failed"');
      expect(pageSrc).toContain("Generation Failed");
      expect(pageSrc).toContain("Retry");
    });

    it("uses listMediaKitsByCampaign (campaign-scoped)", () => {
      expect(pageSrc).toContain("listMediaKitsByCampaign");
    });
  });

  describe("campaign press-kit detail page", () => {
    const detailPath = path.join(
      SRC,
      "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/press-kits/[kitId]/page.tsx",
    );
    const detailSrc = fs.readFileSync(detailPath, "utf-8");

    it("detail page file exists", () => {
      expect(fs.existsSync(detailPath)).toBe(true);
    });

    it("renders MDX content with neutral isolated preview", () => {
      expect(detailSrc).toContain("NeutralPreview");
      expect(detailSrc).toContain("mdxPageContent");
    });

    it("has breadcrumb with press kits link", () => {
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

    it("shows version history sidebar using campaign kits", () => {
      expect(detailSrc).toContain("VersionHistory");
      expect(detailSrc).toContain("listMediaKitsByCampaign");
    });

    it("shows public URL for validated kits", () => {
      expect(detailSrc).toContain("publicUrl");
      expect(detailSrc).toContain("View Public Page");
      expect(detailSrc).toContain("Copy Link");
    });

    it("shows denial reason when denied", () => {
      expect(detailSrc).toContain("denialReason");
    });

    it("handles failed status with retry button", () => {
      expect(detailSrc).toContain('"failed"');
      expect(detailSrc).toContain("Generation Failed");
      expect(detailSrc).toContain("Retry Generation");
    });

    it("includes PressKitChat component", () => {
      expect(detailSrc).toContain("PressKitChat");
      expect(detailSrc).toContain("Edit with AI");
    });
  });

  describe("failed status support", () => {
    it("MediaKitStatus type includes 'failed'", () => {
      expect(apiSrc).toContain('"failed"');
    });

    const pagePath = path.join(
      SRC,
      "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/press-kits/page.tsx",
    );
    const pageSrc = fs.readFileSync(pagePath, "utf-8");

    it("list page has failed style and label", () => {
      expect(pageSrc).toContain("failed:");
      expect(pageSrc).toContain("Generation Failed");
    });

    it("list page has retry action for failed kits", () => {
      expect(pageSrc).toContain("retryMut");
      expect(pageSrc).toContain('kit.status === "failed"');
    });

    const detailPath = path.join(
      SRC,
      "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/press-kits/[kitId]/page.tsx",
    );
    const detailSrc = fs.readFileSync(detailPath, "utf-8");

    it("detail page has failed style and label", () => {
      expect(detailSrc).toContain("failed:");
      expect(detailSrc).toContain("Generation Failed");
    });

    it("detail page has retry action for failed kits", () => {
      expect(detailSrc).toContain("retryMut");
      expect(detailSrc).toContain("Retry Generation");
    });

    const resultsPath = path.join(SRC, "src/components/campaign/press-kit-results.tsx");
    const resultsSrc = fs.readFileSync(resultsPath, "utf-8");

    it("press-kit-results has failed style", () => {
      expect(resultsSrc).toContain("failed:");
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

    it("handles failed status", () => {
      expect(resultsSrc).toContain("failed");
      expect(resultsSrc).toContain("Generation failed");
    });

    it("accepts detailBasePath prop for linking to detail pages", () => {
      expect(resultsSrc).toContain("detailBasePath");
    });
  });

  describe("public URL uses backend publicUrl field", () => {
    const pressKitFiles = [
      path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/press-kits/page.tsx"),
      path.join(SRC, "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/[id]/press-kits/[kitId]/page.tsx"),
      path.join(SRC, "src/components/campaign/press-kit-results.tsx"),
    ];

    for (const filePath of pressKitFiles) {
      const fileName = path.relative(SRC, filePath);
      const src = fs.readFileSync(filePath, "utf-8");

      it(`${fileName} does not hardcode press-kits/public URL`, () => {
        expect(src).not.toContain("/press-kits/public/");
      });

      it(`${fileName} uses kit.publicUrl`, () => {
        expect(src).toContain("publicUrl");
      });
    }
  });
});
