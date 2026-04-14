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
      featureDynastySlug: z.string().optional().describe("Filter by feature dynasty slug"),
    },
    async ({ campaignId, brandId, featureDynastySlug }) => {
      const result = await client.listArticles({ campaignId, brandId, featureDynastySlug });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
