import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";
import { registerIdentityTools } from "../../src/tools/identity.js";
import { registerBrandTools } from "../../src/tools/brands.js";
import { registerCampaignTools } from "../../src/tools/campaigns.js";
import { registerFeatureTools } from "../../src/tools/features.js";
import { registerWorkflowTools } from "../../src/tools/workflows.js";
import { registerBillingTools } from "../../src/tools/billing.js";
import { registerLeadTools } from "../../src/tools/leads.js";
import { registerEmailTools } from "../../src/tools/emails.js";
import { registerOutletTools } from "../../src/tools/outlets.js";
import { registerJournalistTools } from "../../src/tools/journalists.js";
import { registerArticleTools } from "../../src/tools/articles.js";
import { registerPressKitTools } from "../../src/tools/press-kits.js";
import { registerCostTools } from "../../src/tools/costs.js";

// Track registered tools
const registeredTools: string[] = [];
const mockServer = {
  tool: vi.fn((...args: unknown[]) => {
    registeredTools.push(args[0] as string);
  }),
} as unknown as McpServer;

const mockClient = {} as DistributeClient;

describe("MCP tool registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools.length = 0;
  });

  it("registers all expected tools", () => {
    registerIdentityTools(mockServer, mockClient);
    registerBrandTools(mockServer, mockClient);
    registerFeatureTools(mockServer, mockClient);
    registerCampaignTools(mockServer, mockClient);
    registerLeadTools(mockServer, mockClient);
    registerEmailTools(mockServer, mockClient);
    registerWorkflowTools(mockServer, mockClient);
    registerOutletTools(mockServer, mockClient);
    registerJournalistTools(mockServer, mockClient);
    registerArticleTools(mockServer, mockClient);
    registerPressKitTools(mockServer, mockClient);
    registerBillingTools(mockServer, mockClient);
    registerCostTools(mockServer, mockClient);

    const expectedTools = [
      "whoami",
      "brands_list", "brands_get", "brands_create", "brands_extract_fields",
      "features_list", "features_get", "features_prefill", "features_stats", "features_global_stats", "features_stats_registry",
      "campaigns_list", "campaigns_get", "campaigns_create", "campaigns_stop", "campaigns_stats",
      "leads_list",
      "emails_list",
      "workflows_list", "workflows_get", "workflows_summary", "workflows_key_status",
      "outlets_list", "outlets_by_campaign",
      "journalists_list", "journalists_by_campaign",
      "articles_list",
      "press_kits_list", "press_kits_get", "press_kits_generate", "press_kits_view_stats",
      "billing_balance", "billing_account", "billing_transactions",
      "costs_brand_breakdown", "costs_by_brand", "costs_delivery_stats",
    ];

    expect(registeredTools.sort()).toEqual(expectedTools.sort());
    expect(registeredTools).toHaveLength(expectedTools.length);
  });

  it("every tool has a name, description, and handler", () => {
    registerIdentityTools(mockServer, mockClient);
    registerBrandTools(mockServer, mockClient);
    registerCampaignTools(mockServer, mockClient);

    for (const call of mockServer.tool.mock.calls) {
      const [name, description, _schema, handler] = call;
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
      expect(typeof description).toBe("string");
      expect(description.length).toBeGreaterThan(0);
      expect(typeof handler).toBe("function");
    }
  });
});
