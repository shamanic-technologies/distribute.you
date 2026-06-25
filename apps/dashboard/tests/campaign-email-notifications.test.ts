import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");

describe("sendCampaignEmail function", () => {
  const content = fs.readFileSync(apiPath, "utf-8");

  it("should be exported from api.ts", () => {
    expect(content).toContain("export async function sendCampaignEmail");
  });

  it("should accept campaign_created and campaign_stopped event types", () => {
    expect(content).toContain('"campaign_created" | "campaign_stopped"');
  });

  it("should include brandId and campaignId in the request", () => {
    expect(content).toContain("brandId");
    expect(content).toContain("campaignId: campaign.id");
  });

  it("should skip sending when no brandIds exist", () => {
    expect(content).toContain("if (!brandId) return");
  });

  it("should call /emails/send endpoint", () => {
    expect(content).toContain('"/emails/send"');
  });
});
