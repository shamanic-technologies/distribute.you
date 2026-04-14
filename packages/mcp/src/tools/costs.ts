import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerCostTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "costs_brand_breakdown",
    "Get a cost breakdown for a brand — shows costs grouped by cost type (e.g. LLM calls, email sends, lead enrichment).",
    {
      brandId: z.string().describe("The brand UUID"),
      featureDynastySlug: z.string().optional().describe("Filter by feature dynasty slug"),
    },
    async ({ brandId, featureDynastySlug }) => {
      const result = await client.getCostBreakdown({ brandId, groupBy: "costName", featureDynastySlug });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "costs_by_brand",
    "Get total costs grouped by brand across your entire organization.",
    {},
    async () => {
      const result = await client.getCostBreakdown({ groupBy: "brandId" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "costs_delivery_stats",
    "Get email delivery statistics for a brand — emails sent, delivered, opened, clicked, replied, bounced, and reply classifications.",
    { brandId: z.string().describe("The brand UUID") },
    async ({ brandId }) => {
      const result = await client.getBrandDeliveryStats(brandId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
