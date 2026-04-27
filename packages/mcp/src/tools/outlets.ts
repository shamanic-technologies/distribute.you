import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerOutletTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "outlets_list",
    "List media outlets discovered for a brand. Shows outlet name, URL, domain, relevance score, outreach status, and associated campaigns.",
    {
      brandId: z.string().describe("The brand UUID"),
      featureSlug: z.string().optional().describe("Filter by feature dynasty slug"),
      campaignId: z.string().optional().describe("Filter by campaign UUID"),
    },
    async ({ brandId, featureSlug, campaignId }) => {
      const result = await client.listBrandOutlets(brandId, { featureSlug, campaignId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "outlets_by_campaign",
    "List outlets discovered for a specific campaign with their relevance scores and outreach status.",
    { campaignId: z.string().describe("The campaign UUID") },
    async ({ campaignId }) => {
      const result = await client.listCampaignOutlets(campaignId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
