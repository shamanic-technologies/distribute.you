import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..");

describe("campaign-prefill-chat", () => {
  const chatComponentPath = path.join(
    SRC,
    "src/components/campaigns/campaign-prefill-chat.tsx",
  );
  const campaignNewPagePath = path.join(
    SRC,
    "src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
  );
  const instrumentationPath = path.join(SRC, "src/instrumentation.ts");

  describe("CampaignPrefillChat component", () => {
    it("exists", () => {
      expect(fs.existsSync(chatComponentPath)).toBe(true);
    });

    const chatSrc = fs.readFileSync(chatComponentPath, "utf-8");

    it("exports CampaignPrefillChat", () => {
      expect(chatSrc).toContain("export function CampaignPrefillChat");
    });

    it("uses configKey campaign-prefill", () => {
      expect(chatSrc).toContain('configKey: "campaign-prefill"');
    });

    it("accepts onFieldsUpdate callback", () => {
      expect(chatSrc).toContain("onFieldsUpdate");
    });

    it("detects update_campaign_fields tool calls", () => {
      expect(chatSrc).toContain('"update_campaign_fields"');
    });

    it("uses localStorage with campaign-prefill-chat prefix", () => {
      expect(chatSrc).toContain('"campaign-prefill-chat"');
    });
  });

  describe("campaign new page", () => {
    const pageSrc = fs.readFileSync(campaignNewPagePath, "utf-8");

    it("imports CampaignPrefillChat", () => {
      expect(pageSrc).toContain("CampaignPrefillChat");
    });

    it("does not have a close button (×) on Campaign Details card", () => {
      // The old × close button pattern
      expect(pageSrc).not.toContain("&times;</button>");
    });

    it("has Edit with AI button", () => {
      expect(pageSrc).toContain("Edit with AI");
    });

    it("has showChat state toggle", () => {
      expect(pageSrc).toContain("showChat");
    });

    it("passes campaignContext with brandId, fieldDefinitions, and currentFields", () => {
      expect(pageSrc).toContain("campaignContext=");
      expect(pageSrc).toContain("currentFields:");
      expect(pageSrc).toContain("fieldDefinitions:");
    });

    it("applies field updates from chat to form state", () => {
      expect(pageSrc).toContain("onFieldsUpdate=");
    });
  });

  describe("instrumentation config", () => {
    const instrSrc = fs.readFileSync(instrumentationPath, "utf-8");

    it("registers campaign-prefill platform config", () => {
      expect(instrSrc).toContain('"campaign-prefill"');
    });

    it("defines CAMPAIGN_PREFILL_SYSTEM_PROMPT", () => {
      expect(instrSrc).toContain("CAMPAIGN_PREFILL_SYSTEM_PROMPT");
    });

    it("defines CAMPAIGN_PREFILL_ALLOWED_TOOLS with update_campaign_fields", () => {
      expect(instrSrc).toContain("CAMPAIGN_PREFILL_ALLOWED_TOOLS");
      expect(instrSrc).toContain('"update_campaign_fields"');
    });

    it("includes prefill_feature in allowed tools", () => {
      expect(instrSrc).toContain('"prefill_feature"');
    });
  });
});
