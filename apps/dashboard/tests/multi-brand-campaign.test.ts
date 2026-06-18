import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Multi-brand support on the api.ts client surface + its live callers. (The
// campaigns/new create form that drove the brand picker was removed; its
// page-level guards went with it — the wire-shape guards below remain.)
describe("Multi-brand campaign support", () => {
  const apiRel = "../src/lib/api.ts";
  const apiContent = fs.readFileSync(path.join(__dirname, apiRel), "utf-8");

  it("createCampaign in api.ts uses brandUrls: string[] and no custom headers param", () => {
    // Extract just the createCampaign function block
    const fnStart = apiContent.indexOf("export async function createCampaign");
    const fnEnd = apiContent.indexOf("\n}", fnStart) + 2;
    const fnBody = apiContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain("brandUrls: string[]");
    expect(fnBody).not.toContain("brandUrl: string");
    expect(fnBody).not.toContain("headers?: Record<string, string>");
  });

  it("extractBrandFields sends brandIds in the body, not via headers", () => {
    const fnStart = apiContent.indexOf("export async function extractBrandFields");
    const fnEnd = apiContent.indexOf("\n}", fnStart) + 2;
    const fnBody = apiContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain("brandIds: string[]");
    expect(fnBody).toContain("body: { brandIds, fields, resetCache, urlStrategy }");
    expect(fnBody).not.toContain("headers");
  });

  it("callers of extractBrandFields pass brandIds array as first arg", () => {
    const onboardingPageRel = "../src/components/onboarding/default-onboarding.tsx";
    const onboardingPage = fs.readFileSync(path.join(__dirname, onboardingPageRel), "utf-8");
    expect(onboardingPage).toContain("extractBrandFields([newBrandId]");

    const brandInfoRel = "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info/page.tsx";
    const brandInfo = fs.readFileSync(path.join(__dirname, brandInfoRel), "utf-8");
    expect(brandInfo).toContain("extractBrandFields([brandId]");
  });
});
