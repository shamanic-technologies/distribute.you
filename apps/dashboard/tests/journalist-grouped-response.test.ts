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
    expect(body).toContain("status:");
    expect(body).toContain("relevanceScore:");
    expect(body).toContain("whyRelevant:");
    expect(body).toContain("articleUrls:");
    expect(body).toContain("campaignId:");
    expect(body).toContain("createdAt:");
  });
});

describe("Journalist pages use journalistId as key (not flat id)", () => {
  it("feature-level page uses journalistId for React keys and selection", () => {
    const content = fs.readFileSync(featurePagePath, "utf-8");
    expect(content).toContain("key={j.journalistId}");
    expect(content).toContain("selected?.journalistId === j.journalistId");
    // Must NOT use j.id (which doesn't exist on the grouped response)
    expect(content).not.toMatch(/key=\{j\.id\}/);
    expect(content).not.toMatch(/selected\?\.id === j\.id/);
  });

  it("campaign-level page uses journalistId for React keys and selection", () => {
    const content = fs.readFileSync(campaignPagePath, "utf-8");
    expect(content).toContain("key={j.journalistId}");
    expect(content).toContain("selected?.journalistId === j.journalistId");
    expect(content).not.toMatch(/key=\{j\.id\}/);
    expect(content).not.toMatch(/selected\?\.id === j\.id/);
  });
});

describe("Journalist pages derive status from campaigns array", () => {
  it("feature-level page calls bestStatus for status derivation", () => {
    const content = fs.readFileSync(featurePagePath, "utf-8");
    expect(content).toContain("bestStatus(j.campaigns)");
    // Must NOT read j.status directly (it doesn't exist on grouped response)
    expect(content).not.toMatch(/\bj\.status\b/);
  });

  it("campaign-level page calls bestStatus for status derivation", () => {
    const content = fs.readFileSync(campaignPagePath, "utf-8");
    expect(content).toContain("bestStatus(j.campaigns)");
    expect(content).not.toMatch(/\bj\.status\b/);
  });
});

describe("Journalist detail panel shows per-campaign entries", () => {
  it("feature-level page renders CampaignEntryCard for each campaign", () => {
    const content = fs.readFileSync(featurePagePath, "utf-8");
    expect(content).toContain("j.campaigns.map");
    expect(content).toContain("CampaignEntryCard");
  });

  it("campaign-level page renders CampaignEntryCard for each campaign", () => {
    const content = fs.readFileSync(campaignPagePath, "utf-8");
    expect(content).toContain("j.campaigns.map");
    expect(content).toContain("CampaignEntryCard");
  });
});
