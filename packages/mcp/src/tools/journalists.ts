import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerJournalistTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "journalists_list",
    "List journalists discovered for a brand with enriched data — contact info, outlet, outreach status, email delivery status, and campaign associations.",
    {
      brandId: z.string().describe("The brand UUID"),
      campaignId: z.string().optional().describe("Filter by campaign UUID"),
      featureDynastySlug: z.string().optional().describe("Filter by feature dynasty slug"),
    },
    async ({ brandId, campaignId, featureDynastySlug }) => {
      const result = await client.listJournalists(brandId, { campaignId, featureDynastySlug });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "journalists_by_campaign",
    "List journalists discovered for a specific campaign.",
    { campaignId: z.string().describe("The campaign UUID") },
    async ({ campaignId }) => {
      const result = await client.listCampaignJournalists(campaignId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
