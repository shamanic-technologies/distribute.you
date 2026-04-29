import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerFeatureTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "features_list",
    "List all available automation features (e.g. Sales Cold Email Outreach, Journalist Pitch, Press Kit Generation). Each feature defines a type of campaign you can run.",
    {
      implemented: z.boolean().optional().describe("Filter by implementation status"),
    },
    async ({ implemented }) => {
      const result = await client.listFeatures(implemented !== undefined ? { implemented } : undefined);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "features_get",
    "Get details of a specific feature, including its required inputs, outputs, charts, and entities.",
    { slug: z.string().describe("The feature slug (e.g. 'sales-email-cold-outreach')") },
    async ({ slug }) => {
      const result = await client.getFeature(slug);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "features_prefill",
    "Pre-fill a feature's input fields using brand data. Returns suggested values for each input based on the brand's website analysis.",
    {
      featureSlug: z.string().describe("The feature slug"),
      brandIds: z.array(z.string()).describe("Brand UUIDs to extract input data from"),
    },
    async ({ featureSlug, brandIds }) => {
      const result = await client.prefillFeatureInputs(featureSlug, brandIds);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "features_stats",
    "Get performance statistics for a specific feature — total cost, completed runs, active campaigns, and custom stats. Can be grouped by brand, campaign, or workflow.",
    {
      featureSlug: z.string().describe("The feature slug"),
      groupBy: z.string().optional().describe("Group results by: 'brandId', 'campaignId', or 'workflowDynastySlug'"),
      brandId: z.string().optional().describe("Filter stats to a specific brand"),
      campaignId: z.string().optional().describe("Filter stats to a specific campaign"),
    },
    async ({ featureSlug, groupBy, brandId, campaignId }) => {
      const result = await client.getFeatureStats(featureSlug, { groupBy, brandId, campaignId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "features_global_stats",
    "Get aggregate performance statistics across all features. Can be grouped by feature or brand.",
    {
      groupBy: z.string().optional().describe("Group results by: 'featureSlug' or 'brandId'"),
      brandId: z.string().optional().describe("Filter stats to a specific brand"),
    },
    async ({ groupBy, brandId }) => {
      const result = await client.getGlobalStats({ groupBy, brandId });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "features_stats_registry",
    "Get the stats key registry — maps stat keys to their type (count, rate, currency) and human-readable label. Use this to interpret stats values from other endpoints.",
    {},
    async () => {
      const result = await client.getStatsRegistry();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
