import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const featurePagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/journalists/page.tsx",
);
const campaignPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/journalists/page.tsx",
);
const brandPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/journalists/page.tsx",
);

describe("EnrichedJournalist type matches grouped API response", () => {
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  it("should have a campaigns array field on EnrichedJournalist", () => {
    expect(apiContent).toContain("campaigns: JournalistCampaignEntry[]");
  });

  it("should NOT have flat status/relevanceScore/articleUrls on EnrichedJournalist (they belong in campaigns[])", () => {
    // Extract the EnrichedJournalist interface block
    const match = apiContent.match(
      /export interface EnrichedJournalist \{([\s\S]*?)\n\}/,
    );
    expect(match).not.toBeNull();
    const body = match![1];
    // These fields should be on JournalistCampaignEntry, not EnrichedJournalist
    expect(body).not.toContain("status:");
    expect(body).not.toContain("relevanceScore:");
    expect(body).not.toContain("articleUrls:");
    expect(body).not.toContain("whyRelevant:");
    expect(body).not.toContain("whyNotRelevant:");
  });

  it("should have JournalistCampaignEntry type with per-campaign fields", () => {
    expect(apiContent).toContain("export interface JournalistCampaignEntry");
    const match = apiContent.match(
      /export interface JournalistCampaignEntry \{([\s\S]*?)\n\}/,
    );
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).toContain("outreachStatus:");
    expect(body).toContain("relevanceScore:");
    expect(body).toContain("whyRelevant:");
    expect(body).toContain("articleUrls:");
    expect(body).toContain("campaignId:");
    expect(body).toContain("createdAt:");
  });
});

describe("Journalist pages use journalistId as key (not flat id)", () => {
  const pages = [
    { name: "feature-level", path: featurePagePath },
    { name: "campaign-level", path: campaignPagePath },
    { name: "brand-level", path: brandPagePath },
  ];

  for (const page of pages) {
    it(`${page.name} page uses journalistId for React keys and selection`, () => {
      const content = fs.readFileSync(page.path, "utf-8");
      expect(content).toContain("key={j.journalistId}");
      expect(content).toContain("selected?.journalistId === j.journalistId");
      expect(content).not.toMatch(/key=\{j\.id\}/);
      expect(content).not.toMatch(/selected\?\.id === j\.id/);
    });
  }
});

describe("Journalist pages derive status from campaigns array", () => {
  const pages = [
    { name: "feature-level", path: featurePagePath },
    { name: "campaign-level", path: campaignPagePath },
    { name: "brand-level", path: brandPagePath },
  ];

  for (const page of pages) {
    it(`${page.name} page calls bestStatus for status derivation`, () => {
      const content = fs.readFileSync(page.path, "utf-8");
      expect(content).toContain("bestStatus(j.campaigns)");
      expect(content).not.toMatch(/\bj\.status\b/);
    });
  }
});

describe("Journalist pages auto-select first non-empty tab on load", () => {
  const pages = [
    { name: "feature-level", path: featurePagePath },
    { name: "campaign-level", path: campaignPagePath },
    { name: "brand-level", path: brandPagePath },
  ];

  for (const page of pages) {
    it(`${page.name} page auto-selects the first non-empty status tab`, () => {
      const content = fs.readFileSync(page.path, "utf-8");
      // Must use a ref to track whether auto-selection has happened (only once)
      expect(content).toContain("hasAutoSelectedTab");
      // Must find the first status with entries and set it as active
      expect(content).toContain("CAMPAIGN_STATUS_ORDER.find");
      // Must NOT hardcode initial tab to a specific status without auto-selection
      expect(content).toContain("useEffect");
    });
  }
});

describe("Journalist detail panel shows per-campaign entries", () => {
  const pages = [
    { name: "feature-level", path: featurePagePath },
    { name: "campaign-level", path: campaignPagePath },
    { name: "brand-level", path: brandPagePath },
  ];

  for (const page of pages) {
    it(`${page.name} page renders CampaignEntryCard for each campaign`, () => {
      const content = fs.readFileSync(page.path, "utf-8");
      expect(content).toContain("j.campaigns.map");
      expect(content).toContain("CampaignEntryCard");
    });
  }
});
