import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerArticleTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "articles_list",
    "List articles discovered for a campaign or brand. Returns article URLs, titles, descriptions, authors, publication dates, and discovery metadata.",
    {
      campaignId: z.string().optional().describe("Filter by campaign UUID"),
      brandId: z.string().optional().describe("Filter by brand UUID"),
      featureSlug: z.string().optional().describe("Filter by feature slug"),
    },
    async ({ campaignId, brandId, featureSlug }) => {
      const result = await client.listArticles({ campaignId, brandId, featureSlug });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
