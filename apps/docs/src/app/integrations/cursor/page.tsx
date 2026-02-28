import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Cursor Integration",
  description: "Connect distribute to Cursor IDE. Launch campaigns and automate distribution directly from your code editor.",
  openGraph: {
    title: "Cursor Integration | distribute",
    description: "Use distribute tools directly in Cursor IDE.",
  },
  keywords: ["Cursor", "Cursor IDE", "MCP", "distribution automation", "lead generation", "cold email", "AI coding"],
};

const LLM_INSTRUCTIONS = `# distribute + Cursor Integration

## Setup
Add to .cursor/mcp.json (project) or ~/.cursor/mcp.json (global):

{
  "mcpServers": {
    "distribute": {
      "url": "https://mcp.distribute.you/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}

Restart Cursor after saving.

## Available Tools
- distribute_status: Check connection
- distribute_create_campaign: Launch campaign
- distribute_list_campaigns: List campaigns
- distribute_stop_campaign: Stop a campaign
- distribute_resume_campaign: Resume a campaign
- distribute_campaign_stats: Get performance
- distribute_list_brands: List your brands
- distribute_suggest_icp: Suggest ideal customer profile for a brand URL

## Example Prompts
"Launch a cold email campaign for mybrand.com targeting CTOs at SaaS companies. $10/day budget."
"Check my distribute connection status"
"What's the status of my sales campaign?"

## Get API Key
https://dashboard.distribute.you/api-keys`;

export default function CursorIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">Cursor Integration</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-600 mb-8">
        Connect distribute to Cursor IDE and launch campaigns from your code editor.
      </p>

      <div className="prose prose-lg">
        <h2>Setup</h2>
        <p>
          Add the following configuration to your <code>.cursor/mcp.json</code> file.
          You can add it to your project folder for project-specific config, or to{" "}
          <code>~/.cursor/mcp.json</code> for global access.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "mcpServers": {
    "distribute": {
      "url": "https://mcp.distribute.you/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}</code>
        </pre>
        <p>
          Replace <code>YOUR_API_KEY</code> with your distribute API key from{" "}
          <a href="https://dashboard.distribute.you/api-keys">your dashboard</a>.
        </p>
        <p><strong>Restart Cursor</strong> after saving the configuration.</p>

        <h2>Test Your Connection</h2>
        <p>In Cursor&apos;s AI chat, ask:</p>
        <pre className="bg-gray-100 p-4 rounded-lg">
          <code className="text-gray-800">&quot;Check my distribute connection status&quot;</code>
        </pre>
        <p>Cursor will call the <code>distribute_status</code> tool and confirm your setup.</p>

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
              <td><code>distribute_status</code></td>
              <td>Check connection and configuration</td>
            </tr>
            <tr>
              <td><code>distribute_create_campaign</code></td>
              <td>Launch a cold email campaign</td>
            </tr>
            <tr>
              <td><code>distribute_list_campaigns</code></td>
              <td>List all your campaigns</td>
            </tr>
            <tr>
              <td><code>distribute_stop_campaign</code></td>
              <td>Stop a running campaign</td>
            </tr>
            <tr>
              <td><code>distribute_resume_campaign</code></td>
              <td>Resume a stopped campaign</td>
            </tr>
            <tr>
              <td><code>distribute_campaign_stats</code></td>
              <td>Get campaign performance metrics</td>
            </tr>
            <tr>
              <td><code>distribute_list_brands</code></td>
              <td>List all your brands</td>
            </tr>
            <tr>
              <td><code>distribute_suggest_icp</code></td>
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

        <h3>Pause/Resume Campaign</h3>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className="text-gray-800">{`"Pause my sales outreach campaign"

"Resume the campaign"`}</code>
        </pre>

        <h2>Advanced: Cursor Skills</h2>
        <p>
          For more advanced usage, you can also install distribute as a{" "}
          <a href="/integrations/cursor-skill">Cursor Skill</a> which provides
          additional context and guidance to the AI.
        </p>

        <h2>Troubleshooting</h2>

        <h3>MCP not found</h3>
        <ul>
          <li>Ensure the <code>mcp.json</code> file is in the correct location</li>
          <li>Restart Cursor after making changes</li>
          <li>Check JSON syntax is valid</li>
        </ul>

        <h3>Authorization errors</h3>
        <ul>
          <li>Verify your API key is correct</li>
          <li>Ensure the Authorization header format is <code>Bearer YOUR_KEY</code></li>
          <li>Check your key at <a href="https://dashboard.distribute.you/api-keys">dashboard.distribute.you/api-keys</a></li>
        </ul>

        <h2>Next Steps</h2>
        <ul>
          <li><a href="/quickstart">Quick Start Guide</a></li>
          <li><a href="/integrations/cursor-skill">Cursor Skill Setup</a></li>
          <li><a href="/sales-outreach">Sales Outreach MCP</a></li>
        </ul>
      </div>
    </div>
  );
}
