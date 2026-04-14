#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DistributeClient } from "@distribute/api-client";
import { registerIdentityTools } from "./tools/identity.js";
import { registerBrandTools } from "./tools/brands.js";
import { registerFeatureTools } from "./tools/features.js";
import { registerCampaignTools } from "./tools/campaigns.js";
import { registerLeadTools } from "./tools/leads.js";
import { registerEmailTools } from "./tools/emails.js";
import { registerWorkflowTools } from "./tools/workflows.js";
import { registerOutletTools } from "./tools/outlets.js";
import { registerJournalistTools } from "./tools/journalists.js";
import { registerArticleTools } from "./tools/articles.js";
import { registerPressKitTools } from "./tools/press-kits.js";
import { registerBillingTools } from "./tools/billing.js";
import { registerCostTools } from "./tools/costs.js";

function getApiKey(): string {
  // CLI flag: --api-key=dist_xxx
  const flagArg = process.argv.find((a) => a.startsWith("--api-key="));
  if (flagArg) return flagArg.split("=")[1];

  // Environment variable
  if (process.env.DISTRIBUTE_API_KEY) return process.env.DISTRIBUTE_API_KEY;

  console.error("[distribute-mcp] No API key provided. Use --api-key=<key> or set DISTRIBUTE_API_KEY env var.");
  process.exit(1);
}

function getBaseUrl(): string {
  const flagArg = process.argv.find((a) => a.startsWith("--base-url="));
  if (flagArg) return flagArg.split("=")[1];
  return process.env.DISTRIBUTE_API_URL ?? "https://api.distribute.you";
}

async function main(): Promise<void> {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();
  const client = new DistributeClient({ apiKey, baseUrl });

  const server = new McpServer({
    name: "distribute",
    version: "0.1.0",
  });

  registerIdentityTools(server, client);
  registerBrandTools(server, client);
  registerFeatureTools(server, client);
  registerCampaignTools(server, client);
  registerLeadTools(server, client);
  registerEmailTools(server, client);
  registerWorkflowTools(server, client);
  registerOutletTools(server, client);
  registerJournalistTools(server, client);
  registerArticleTools(server, client);
  registerPressKitTools(server, client);
  registerBillingTools(server, client);
  registerCostTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[distribute-mcp] Fatal error:", err);
  process.exit(1);
});
