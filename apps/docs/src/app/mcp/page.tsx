import { Metadata } from "next";
import Link from "next/link";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS } from "@distribute/content";

export const metadata: Metadata = {
  title: "MCP Server",
  description: "Use distribute from Claude Code, Claude Desktop, Cursor, or any MCP-compatible client. 35 tools for brands, campaigns, workflows, and more.",
  openGraph: {
    title: "MCP Server | distribute Docs",
    description: "Complete guide to using distribute via MCP.",
  },
};

const LLM_INSTRUCTIONS = `# distribute MCP Server

## Install
npm: npx @distribute/mcp --api-key=dist_YOUR_KEY
Claude Code: claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY

## 35 Tools Available
Identity: whoami
Brands: brands_list, brands_get, brands_create, brands_extract_fields
Features: features_list, features_get, features_prefill, features_stats, features_global_stats, features_stats_registry
Campaigns: campaigns_list, campaigns_get, campaigns_create, campaigns_stop, campaigns_stats
Leads: leads_list
Emails: emails_list
Workflows: workflows_list, workflows_get, workflows_summary, workflows_key_status
Outlets: outlets_list, outlets_by_campaign
Journalists: journalists_list, journalists_by_campaign
Articles: articles_list
Press Kits: press_kits_list, press_kits_get, press_kits_generate, press_kits_view_stats
Billing: billing_balance, billing_account, billing_transactions
Costs: costs_brand_breakdown, costs_by_brand, costs_delivery_stats

## Auth
--api-key=dist_xxx or DISTRIBUTE_API_KEY env var`;

export default function McpOverviewPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">MCP Server</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Use distribute from Claude Code, Claude Desktop, Cursor, or any MCP-compatible client.
      </p>

      <div className="prose">
        <h2>What is MCP?</h2>
        <p>
          The <strong>Model Context Protocol (MCP)</strong> is an open standard that allows AI assistants
          to connect to external tools. distribute provides an MCP server with 35 tools for managing
          your entire distribution pipeline.
        </p>

        <h2>Quick Install</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY</code>
        </pre>
        <p>
          See <Link href="/mcp/installation">Installation</Link> for Claude Desktop, Cursor, and other clients.
        </p>

        <h2>How It Works</h2>
        <p>
          The <code>@distribute/mcp</code> package runs as a local stdio server. Your AI client
          communicates with it via the MCP protocol, and it calls the distribute API on your behalf.
        </p>
        <ol>
          <li>Install via <code>npx @distribute/mcp</code> with your API key</li>
          <li>Your AI client discovers 35 available tools</li>
          <li>Describe what you want in natural language</li>
          <li>The AI translates to the appropriate tool calls</li>
        </ol>

        <h2>Example Prompts</h2>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg overflow-x-auto border border-gray-200">
          <code>{`"Create a brand for acme.com"
"Launch a cold email campaign targeting CTOs at tech startups, $10/day budget"
"Show me the stats for my latest campaign"
"Generate a press kit for my brand"
"What's my current billing balance?"
"List all journalists discovered for acme.com"`}</code>
        </pre>

        <h2>Tool Categories</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Tools</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Identity</td>
              <td>1</td>
              <td>Verify connection and API key</td>
            </tr>
            <tr>
              <td>Brands</td>
              <td>4</td>
              <td>Create and manage brand profiles</td>
            </tr>
            <tr>
              <td>Features</td>
              <td>6</td>
              <td>Browse automation types and stats</td>
            </tr>
            <tr>
              <td>Campaigns</td>
              <td>5</td>
              <td>Create, stop, and monitor campaigns</td>
            </tr>
            <tr>
              <td>Workflows</td>
              <td>4</td>
              <td>Inspect workflow details and key status</td>
            </tr>
            <tr>
              <td>Leads</td>
              <td>1</td>
              <td>List discovered leads</td>
            </tr>
            <tr>
              <td>Emails</td>
              <td>1</td>
              <td>View generated emails</td>
            </tr>
            <tr>
              <td>Outlets</td>
              <td>2</td>
              <td>Media outlets discovered for your brand</td>
            </tr>
            <tr>
              <td>Journalists</td>
              <td>2</td>
              <td>Journalists discovered for your brand</td>
            </tr>
            <tr>
              <td>Articles</td>
              <td>1</td>
              <td>Articles mentioning your brand</td>
            </tr>
            <tr>
              <td>Press Kits</td>
              <td>4</td>
              <td>Generate and manage press kits</td>
            </tr>
            <tr>
              <td>Billing</td>
              <td>3</td>
              <td>Balance, account, transactions</td>
            </tr>
            <tr>
              <td>Costs</td>
              <td>3</td>
              <td>Cost breakdown and delivery stats</td>
            </tr>
          </tbody>
        </table>
        <p>
          See the full <Link href="/mcp/tools">Tools Reference</Link> for detailed descriptions of each tool.
        </p>

        <h2>Authentication</h2>
        <p>
          The MCP server requires your API key, provided via CLI flag or environment variable:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`# CLI flag (recommended)
npx @distribute/mcp --api-key=dist_YOUR_KEY

# Environment variable
DISTRIBUTE_API_KEY=dist_YOUR_KEY npx @distribute/mcp`}</code>
        </pre>
        <p>
          Get your API key at{" "}
          <a href={URLS.apiKeys}>{URLS.apiKeys.replace("https://", "")}</a>.
        </p>
      </div>
    </div>
  );
}
