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
    "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
  );

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

    it("resolves tool name from part.type (AI SDK v6 static tool parts), not part.toolName alone", () => {
      // Regression: AI SDK v6 puts the name in `type` as "tool-<name>"; reading
      // `toolName` alone yields "unknown" and the field-apply gate never fires.
      expect(chatSrc).toContain("resolveToolName");
      expect(chatSrc).toContain('.type.slice(5)');
    });

    it("applies field updates in real-time during streaming (not just onFinish)", () => {
      expect(chatSrc).toContain("appliedToolCallsRef");
      expect(chatSrc).toContain("useEffect");
      // Verify the real-time effect watches messages and calls onFieldsUpdate
      expect(chatSrc).toContain("[messages, onFieldsUpdate]");
    });

    it("uses localStorage with campaign-prefill-chat prefix", () => {
      expect(chatSrc).toContain('"campaign-prefill-chat"');
    });
  });

  describe("campaign new page", () => {
    const pageSrc = fs.readFileSync(campaignNewPagePath, "utf-8");

    it("imports CampaignAIPanel (which wraps CampaignPrefillChat)", () => {
      expect(pageSrc).toContain("CampaignAIPanel");
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

  describe("CampaignAIPanel component", () => {
    const aiPanelPath = path.join(
      SRC,
      "src/components/campaigns/campaign-ai-panel.tsx",
    );

    it("exists", () => {
      expect(fs.existsSync(aiPanelPath)).toBe(true);
    });

    const panelSrc = fs.readFileSync(aiPanelPath, "utf-8");

    it("exports CampaignAIPanel", () => {
      expect(panelSrc).toContain("export function CampaignAIPanel");
    });

    it("renders two-column layout with inputs and chat", () => {
      expect(panelSrc).toContain("Campaign Inputs");
      expect(panelSrc).toContain("CampaignPrefillChat");
    });

    it("has a backdrop overlay", () => {
      expect(panelSrc).toContain("bg-black/20");
      expect(panelSrc).toContain("fixed inset-0");
    });

    it("handles Escape key to close", () => {
      expect(panelSrc).toContain('"Escape"');
    });

    it("passes onFieldsUpdate to CampaignPrefillChat", () => {
      expect(panelSrc).toContain("onFieldsUpdate={onFieldsUpdate}");
    });
  });
});
