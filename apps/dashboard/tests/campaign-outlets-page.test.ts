import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const campaignOutletPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/outlets/page.tsx",
);
const apiPath = path.resolve(__dirname, "../src/lib/api.ts");

describe("campaign-level outlet page scopes costs to campaign", () => {
  const content = fs.readFileSync(campaignOutletPagePath, "utf-8");

  it("should pass campaignId to getOutletStatsCosts", () => {
    expect(content).toContain("campaignId");
    expect(content).toMatch(/getOutletStatsCosts\([^)]*campaignId[^)]*\)/);
  });

  it("should include campaignId in the query key for cache separation", () => {
    expect(content).toContain('"outletStatsCosts", brandId, campaignId, "outletId"');
  });
});

describe("getOutletStatsCosts accepts campaignId parameter", () => {
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  it("should accept campaignId as a parameter", () => {
    expect(apiContent).toContain("campaignId?: string");
  });

  it("should pass campaignId to query params when provided", () => {
    expect(apiContent).toContain('params.set("campaignId", campaignId)');
  });
});

describe("campaign outlet page shows all status tabs", () => {
  const content = fs.readFileSync(campaignOutletPagePath, "utf-8");

  it("should iterate over STATUS_PRIORITY to build tabs (not just existing statuses)", () => {
    expect(content).toContain("for (const status of STATUS_PRIORITY)");
  });

  it("should show tabs even when outlets list is empty", () => {
    // The tab rendering condition should NOT require outlets.length > 0
    expect(content).not.toContain("outlets.length > 0 && (");
  });

  it("should default to first non-empty tab, falling back to all", () => {
    expect(content).toContain('t.key !== "all" && t.outlets.length > 0');
  });
});
