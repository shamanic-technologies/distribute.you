import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerWorkflowTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "workflows_list",
    "List available workflows. Optionally filter by feature to see workflows for a specific automation type.",
    {
      featureDynastySlug: z.string().optional().describe("Filter by feature dynasty slug"),
    },
    async ({ featureDynastySlug }) => {
      const result = await client.listWorkflows(featureDynastySlug ? { featureDynastySlug } : undefined);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "workflows_get",
    "Get full details of a workflow including its DAG (directed acyclic graph), nodes, edges, required providers, and version info.",
    { workflowId: z.string().describe("The workflow UUID") },
    async ({ workflowId }) => {
      const result = await client.getWorkflow(workflowId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "workflows_summary",
    "Get a human-readable summary of a workflow — what it does, what steps it takes, and what API providers it requires.",
    { workflowId: z.string().describe("The workflow UUID") },
    async ({ workflowId }) => {
      const result = await client.getWorkflowSummary(workflowId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "workflows_key_status",
    "Check if all required API keys are configured for a workflow. Shows which providers are ready and which are missing.",
    { workflowId: z.string().describe("The workflow UUID") },
    async ({ workflowId }) => {
      const result = await client.getWorkflowKeyStatus(workflowId);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
