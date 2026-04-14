import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerBrandTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "brands_list",
    "List all brands in your organization.",
    {},
    async () => {
      const result = await client.listBrands();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "brands_get",
    "Get detailed information about a specific brand, including bio, mission, location, and categories.",
    { brandId: z.string().describe("The brand UUID") },
    async ({ brandId }) => {
      const result = await client.getBrand(brandId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "brands_create",
    "Create a new brand by providing its website URL. The platform will automatically scrape and analyze the site.",
    { url: z.string().describe("The brand's website URL (e.g. https://acme.com)") },
    async ({ url }) => {
      const result = await client.createBrand(url);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "brands_extract_fields",
    "Extract specific information fields from one or more brands using AI. Results are cached for 30 days. Use this to get structured data like industry, target audience, value proposition, etc.",
    {
      brandIds: z.array(z.string()).describe("Array of brand UUIDs to extract fields from"),
      fields: z.array(z.object({
        key: z.string().describe("Field key (e.g. 'industry', 'targetAudience')"),
        description: z.string().describe("Description of what to extract"),
      })).describe("Fields to extract"),
    },
    async ({ brandIds, fields }) => {
      const result = await client.extractBrandFields(brandIds, fields);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
