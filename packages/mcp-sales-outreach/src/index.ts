#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "@mcpfactory/sales-outreach",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
const TOOLS = [
  {
    name: "launch_campaign",
    description:
      "Launch a DFY cold email outreach campaign. Provide a URL, describe your target audience, set a budget — we handle everything else.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target_url: {
          type: "string",
          description: "The URL of the product/service to promote",
        },
        target_audience: {
          type: "string",
          description:
            "Description of ideal customers in plain text (e.g., 'CTOs at SaaS startups with 10-50 employees in the US')",
        },
        target_outcome: {
          type: "string",
          description:
            "What you want to achieve (e.g., 'Book sales demos', 'Recruit community ambassadors', 'Get press coverage')",
        },
        value_for_target: {
          type: "string",
          description:
            "What the target audience gains from responding (e.g., 'Access to enterprise analytics at startup pricing')",
        },
        max_leads: {
          type: "number",
          description:
            "Optional: Maximum total number of leads for this campaign. Once reached, the campaign stops automatically.",
        },
        budget: {
          type: "object",
          properties: {
            max_daily_usd: { type: "number" },
            max_weekly_usd: { type: "number" },
            max_monthly_usd: { type: "number" },
          },
          description: "BYOK budget limits (at least one required)",
        },
      },
      required: ["target_url", "target_audience", "target_outcome", "value_for_target"],
    },
  },
  {
    name: "get_campaign_results",
    description: "Get results and stats for a campaign",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: {
          type: "string",
          description: "The campaign ID",
        },
      },
      required: ["campaign_id"],
    },
  },
  {
    name: "pause_campaign",
    description: "Pause a running campaign",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
      },
      required: ["campaign_id"],
    },
  },
  {
    name: "resume_campaign",
    description: "Resume a paused campaign",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
      },
      required: ["campaign_id"],
    },
  },
  {
    name: "list_campaigns",
    description: "List all your campaigns",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_stats",
    description:
      "Get your usage stats and community benchmarks for transparency",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// Handle list tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // WAITLIST MODE: All tools return waitlist message for now
  const waitlistResponse = {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            status: "waitlist",
            message:
              "Thanks for your interest in @mcpfactory/sales-outreach! This MCP is currently in development.",
            next_steps: [
              "Join our waitlist at https://mcpfactory.org/waitlist",
              "Star our repo: https://github.com/mcpfactory/mcpfactory",
              "You'll get early access when we launch",
            ],
            your_request: {
              tool: name,
              args: args,
            },
            eta: "Q1 2026",
          },
          null,
          2
        ),
      },
    ],
  };

  switch (name) {
    case "launch_campaign":
    case "get_campaign_results":
    case "pause_campaign":
    case "resume_campaign":
    case "list_campaigns":
    case "get_stats":
      return waitlistResponse;

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("@mcpfactory/sales-outreach MCP server running on stdio");
}

main().catch(console.error);
