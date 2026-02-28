import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Claude Integration",
  description: "Connect distribute to Claude. Use Claude.ai, Claude Desktop, or Claude Code to launch campaigns and automate distribution.",
  openGraph: {
    title: "Claude Integration | distribute",
    description: "Use distribute tools directly in Claude.",
  },
  keywords: ["Claude", "Anthropic", "MCP", "distribution automation", "lead generation", "cold email", "Claude Desktop"],
};

const LLM_INSTRUCTIONS = `# distribute + Claude Integration

## Supported Claude Clients
- Claude.ai (web)
- Claude Desktop
- Claude Code

## Claude.ai Setup
1. Go to Settings → Integrations
2. Click "Add more"
3. Enter:
   - Name: distribute
   - URL: https://mcp.mcpfactory.org/mcp
4. Enable tools in chat

## Claude Desktop Setup
Edit ~/Library/Application Support/Claude/claude_desktop_config.json:
{
  "mcpServers": {
    "mcpfactory": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.mcpfactory.org/mcp"],
      "env": {
        "MCP_HEADERS": "Authorization:Bearer YOUR_API_KEY"
      }
    }
  }
}

## Claude Code Setup
claude mcp add mcpfactory --transport http https://mcp.mcpfactory.org/mcp

## Available Tools
- mcpfactory_status: Check connection
- mcpfactory_create_campaign: Launch campaign
- mcpfactory_list_campaigns: List campaigns
- mcpfactory_stop_campaign: Stop a campaign
- mcpfactory_resume_campaign: Resume a campaign
- mcpfactory_campaign_stats: Get performance
- mcpfactory_list_brands: List your brands
- mcpfactory_suggest_icp: Suggest ideal customer profile for a brand URL

## Get API Key
https://dashboard.mcpfactory.org/api-keys`;

export default function ClaudeIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">Claude Integration</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-600 mb-8">
        Connect distribute to Claude and launch campaigns from Anthropic&apos;s AI assistant.
      </p>

      <div className="prose prose-lg">
        <h2>Supported Claude Clients</h2>
        <ul>
          <li><strong>Claude.ai</strong> - Anthropic&apos;s web interface</li>
          <li><strong>Claude Desktop</strong> - Desktop application</li>
          <li><strong>Claude Code</strong> - Coding assistant CLI</li>
        </ul>

        <h2>Claude.ai Setup</h2>
        <ol>
          <li>Open <strong>Settings</strong> (bottom of sidebar)</li>
          <li>Scroll to <strong>Integrations</strong></li>
          <li>Click <strong>Add more</strong></li>
          <li>
            Enter the integration details:
            <ul>
              <li><strong>Integration name:</strong> distribute</li>
              <li><strong>Integration URL:</strong> <code>https://mcp.mcpfactory.org/mcp</code></li>
            </ul>
          </li>
          <li>Save and enable the integration</li>
          <li>In new chats, make sure to enable the distribute tools</li>
        </ol>

        <h2>Claude Desktop Setup</h2>
        <p>
          Edit the configuration file at{" "}
          <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "mcpServers": {
    "mcpfactory": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.mcpfactory.org/mcp"],
      "env": {
        "MCP_HEADERS": "Authorization:Bearer YOUR_API_KEY"
      }
    }
  }
}`}</code>
        </pre>
        <p>Restart Claude Desktop after saving.</p>

        <h2>Claude Code Setup</h2>
        <p>Add distribute using the CLI:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>claude mcp add mcpfactory --transport http https://mcp.mcpfactory.org/mcp</code>
        </pre>
        <p>
          Then configure your API key, or set the <code>MCPFACTORY_API_KEY</code> environment variable.
        </p>

        <h2>Test Your Connection</h2>
        <p>Ask Claude:</p>
        <pre className="bg-gray-100 p-4 rounded-lg">
          <code className="text-gray-800">&quot;Check my MCPFactory connection status&quot;</code>
        </pre>

        <h2>Available Tools</h2>
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>mcpfactory_status</code></td>
              <td>Check connection and configuration</td>
            </tr>
            <tr>
              <td><code>mcpfactory_create_campaign</code></td>
              <td>Launch a cold email campaign</td>
            </tr>
            <tr>
              <td><code>mcpfactory_list_campaigns</code></td>
              <td>List all your campaigns</td>
            </tr>
            <tr>
              <td><code>mcpfactory_stop_campaign</code></td>
              <td>Stop a running campaign</td>
            </tr>
            <tr>
              <td><code>mcpfactory_resume_campaign</code></td>
              <td>Resume a stopped campaign</td>
            </tr>
            <tr>
              <td><code>mcpfactory_campaign_stats</code></td>
              <td>Get campaign performance metrics</td>
            </tr>
            <tr>
              <td><code>mcpfactory_list_brands</code></td>
              <td>List all your brands</td>
            </tr>
            <tr>
              <td><code>mcpfactory_suggest_icp</code></td>
              <td>Suggest ideal customer profile for a brand URL</td>
            </tr>
          </tbody>
        </table>

        <h2>Example Prompts</h2>

        <h3>Launch a Campaign</h3>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className="text-gray-800">{`"Launch a cold email campaign for mybrand.com
targeting CTOs at SaaS companies with 50-200 employees.
Budget: $10/day max. Run for 5 days as a trial."`}</code>
        </pre>

        <h3>Check Campaign Status</h3>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className="text-gray-800">{`"What's the status of my sales campaign?
How many emails sent, opened, and replied?"`}</code>
        </pre>

        <h2>Troubleshooting</h2>

        <h3>MCP tools not appearing</h3>
        <ul>
          <li>For Claude.ai: Make sure you enabled the tools in the chat</li>
          <li>For Claude Desktop: Restart the app after config changes</li>
          <li>Verify the MCP URL is correct</li>
        </ul>

        <h3>Authorization errors</h3>
        <ul>
          <li>Check your API key is valid</li>
          <li>Ensure the Bearer token format is correct</li>
          <li>Verify at <a href="https://dashboard.mcpfactory.org/api-keys">dashboard.mcpfactory.org/api-keys</a></li>
        </ul>

        <h2>Next Steps</h2>
        <ul>
          <li><a href="/quickstart">Quick Start Guide</a></li>
          <li><a href="/sales-outreach">Sales Outreach MCP</a></li>
          <li><a href="/authentication">Authentication & API Keys</a></li>
        </ul>
      </div>
    </div>
  );
}
