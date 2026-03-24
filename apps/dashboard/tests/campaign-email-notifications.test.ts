import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const createPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx"
);
const overviewPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/page.tsx"
);
const listPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/page.tsx"
);

describe("sendCampaignEmail function", () => {
  const content = fs.readFileSync(apiPath, "utf-8");

  it("should be exported from api.ts", () => {
    expect(content).toContain("export async function sendCampaignEmail");
  });

  it("should accept campaign_created and campaign_stopped event types", () => {
    expect(content).toContain('"campaign_created" | "campaign_stopped"');
  });

  it("should include brandId, campaignId, and campaignName in the request", () => {
    expect(content).toContain("brandId: campaign.brandId");
    expect(content).toContain("campaignId: campaign.id");
    expect(content).toContain("campaignName: campaign.name");
  });

  it("should skip sending when brandId is null", () => {
    expect(content).toContain("if (!campaign.brandId) return");
  });

  it("should call /emails/send endpoint", () => {
    expect(content).toContain('"/emails/send"');
  });
});

describe("campaign_created email on creation page", () => {
  const content = fs.readFileSync(createPagePath, "utf-8");

  it("should import sendCampaignEmail", () => {
    expect(content).toContain("sendCampaignEmail");
  });

  it("should fire campaign_created email after successful creation", () => {
    expect(content).toContain('sendCampaignEmail("campaign_created"');
  });

  it("should be best-effort (catch errors silently)", () => {
    expect(content).toMatch(/sendCampaignEmail\(.*\)\.catch\(\(\) => \{\}\)/s);
  });

  it("should capture the campaign from createCampaign response", () => {
    expect(content).toContain("const { campaign } = await createCampaign(");
  });
});

describe("campaign_stopped email on overview page", () => {
  const content = fs.readFileSync(overviewPagePath, "utf-8");

  it("should import sendCampaignEmail", () => {
    expect(content).toContain("sendCampaignEmail");
  });

  it("should fire campaign_stopped email after stop", () => {
    expect(content).toContain('sendCampaignEmail("campaign_stopped"');
  });

  it("should be best-effort (catch errors silently)", () => {
    expect(content).toMatch(/sendCampaignEmail\(.*\)\.catch\(\(\) => \{\}\)/s);
  });
});

describe("campaign_stopped email on campaigns list page", () => {
  const content = fs.readFileSync(listPagePath, "utf-8");

  it("should import sendCampaignEmail", () => {
    expect(content).toContain("sendCampaignEmail");
  });

  it("should fire campaign_stopped email after stop", () => {
    expect(content).toContain('sendCampaignEmail("campaign_stopped"');
  });

  it("should be best-effort (catch errors silently)", () => {
    expect(content).toMatch(/sendCampaignEmail\(.*\)\.catch\(\(\) => \{\}\)/s);
  });

  it("should capture the campaign from stopCampaign response", () => {
    expect(content).toContain("const { campaign } = await stopCampaign(");
  });
});
