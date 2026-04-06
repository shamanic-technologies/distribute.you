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

describe("campaign outlet page uses deduplicated endpoint and same tab logic as brand page", () => {
  const content = fs.readFileSync(campaignOutletPagePath, "utf-8");

  it("should use listBrandOutlets instead of listCampaignOutlets", () => {
    expect(content).toContain("listBrandOutlets");
    expect(content).not.toContain("listCampaignOutlets");
  });

  it("should show static tabs for all statuses in priority order", () => {
    // Uses static tabs from STATUS_PRIORITY, matching the journalist page pattern
    expect(content).toContain("STATUS_PRIORITY.map");
  });

  it("should auto-select first non-empty tab on initial load", () => {
    expect(content).toContain("STATUS_PRIORITY.find");
    expect(content).toContain("hasAutoSelectedTab");
  });
});
