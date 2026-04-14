import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerEmailTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "emails_list",
    "List generated emails for a campaign. Returns the subject, body (HTML and text), email sequence steps, and recipient details.",
    { campaignId: z.string().describe("The campaign UUID") },
    async ({ campaignId }) => {
      const result = await client.listCampaignEmails(campaignId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
