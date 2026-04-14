import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerPressKitTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "press_kits_list",
    "List press kits (media kits). Optionally filter by brand or campaign.",
    {
      brandId: z.string().optional().describe("Filter by brand UUID"),
      campaignId: z.string().optional().describe("Filter by campaign UUID"),
    },
    async ({ brandId, campaignId }) => {
      const result = await client.listPressKits({ brandId, campaignId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "press_kits_get",
    "Get the full content of a press kit including its MDX page content, status, and metadata.",
    { id: z.string().describe("The press kit UUID") },
    async ({ id }) => {
      const result = await client.getPressKit(id);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "press_kits_generate",
    "Generate a new press kit using AI. Provide an instruction describing what kind of press kit you want, and optionally associate it with a brand and/or campaign.",
    {
      instruction: z.string().describe("Instruction for the AI press kit generator (e.g. 'Create a press kit highlighting our Series B funding')"),
      brandId: z.string().optional().describe("Brand UUID to associate with the press kit"),
      campaignId: z.string().optional().describe("Campaign UUID to associate with the press kit"),
    },
    async ({ instruction, brandId, campaignId }) => {
      const result = await client.generatePressKit(instruction, { brandId, campaignId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "press_kits_view_stats",
    "Get view statistics for press kits — total views, unique visitors, and optional grouping by country, media kit, or day.",
    {
      brandId: z.string().optional().describe("Filter by brand UUID"),
      mediaKitId: z.string().optional().describe("Filter by specific press kit UUID"),
      groupBy: z.enum(["country", "mediaKitId", "day"]).optional().describe("Group results by dimension"),
    },
    async ({ brandId, mediaKitId, groupBy }) => {
      const result = await client.getPressKitViewStats({ brandId, mediaKitId, groupBy });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
