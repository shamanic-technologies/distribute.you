import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerIdentityTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "whoami",
    "Check your identity — returns your user ID, org ID, and auth type. Use this to verify your API key is working.",
    {},
    async () => {
      const info = await client.getMe();
      return { content: [{ type: "text", text: JSON.stringify(info, null, 2) }] };
    },
  );
}
