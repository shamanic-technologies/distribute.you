import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerCampaignTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "campaigns_list",
    "List campaigns. Optionally filter by brand to see all campaigns for a specific brand.",
    {
      brandId: z.string().optional().describe("Filter campaigns by brand UUID"),
    },
    async ({ brandId }) => {
      const result = await client.listCampaigns(brandId ? { brandId } : undefined);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "campaigns_get",
    "Get details of a specific campaign including its status, workflow, brand, feature inputs, and budget settings.",
    { campaignId: z.string().describe("The campaign UUID") },
    async ({ campaignId }) => {
      const result = await client.getCampaign(campaignId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "campaigns_create",
    "Create and launch a new campaign. Requires a workflow slug, brand URL(s), and optionally budget limits and feature inputs. The campaign starts running immediately after creation.",
    {
      name: z.string().describe("Campaign name"),
      workflowSlug: z.string().describe("Slug of the workflow to execute"),
      brandUrls: z.array(z.string()).describe("Array of brand website URLs"),
      featureInputs: z.record(z.string()).optional().describe("Key-value pairs of feature input values (use features_prefill to get suggested values)"),
      maxBudgetDailyUsd: z.string().optional().describe("Max daily budget in USD (e.g. '50')"),
      maxBudgetWeeklyUsd: z.string().optional().describe("Max weekly budget in USD"),
      maxBudgetMonthlyUsd: z.string().optional().describe("Max monthly budget in USD"),
      maxBudgetTotalUsd: z.string().optional().describe("Max total budget in USD"),
    },
    async (params) => {
      const result = await client.createCampaign(params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "campaigns_stop",
    "Stop a running campaign. The campaign can be viewed afterwards but will no longer execute.",
    { campaignId: z.string().describe("The campaign UUID") },
    async ({ campaignId }) => {
      const result = await client.stopCampaign(campaignId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "campaigns_stats",
    "Get performance statistics for a campaign — leads served, emails sent/delivered/opened/replied, cost breakdown, and reply classifications.",
    { campaignId: z.string().describe("The campaign UUID") },
    async ({ campaignId }) => {
      const result = await client.getCampaignStats(campaignId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
