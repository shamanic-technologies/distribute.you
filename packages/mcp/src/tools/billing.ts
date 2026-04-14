import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DistributeClient } from "@distribute/api-client";

export function registerBillingTools(server: McpServer, client: DistributeClient): void {
  server.tool(
    "billing_balance",
    "Check your current credit balance and whether it's depleted.",
    {},
    async () => {
      const result = await client.getBillingBalance();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "billing_account",
    "Get your billing account details — credit balance, auto-reload settings, and payment method status.",
    {},
    async () => {
      const result = await client.getBillingAccount();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "billing_transactions",
    "List recent billing transactions — credits, deductions, and reloads with amounts and descriptions.",
    {},
    async () => {
      const result = await client.listBillingTransactions();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}
