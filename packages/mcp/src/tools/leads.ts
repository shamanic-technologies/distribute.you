import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerLeadTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "leads_list",
    "List leads (prospects). Filter by campaign or brand. Returns contact details, company info, and outreach status (contacted, delivered, replied, bounced).",
    {
      campaignId: z.string().optional().describe("Filter by campaign UUID"),
      brandId: z.string().optional().describe("Filter by brand UUID"),
    },
    async ({ campaignId, brandId }) => {
      const result = await client.listLeads({ campaignId, brandId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
