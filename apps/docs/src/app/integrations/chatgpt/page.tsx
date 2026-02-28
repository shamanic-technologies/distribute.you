import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "ChatGPT Integration",
  description: "Connect distribute to ChatGPT. Launch campaigns, find leads, and automate outreach directly from OpenAI's ChatGPT.",
  openGraph: {
    title: "ChatGPT Integration | distribute",
    description: "Use distribute tools directly in ChatGPT.",
  },
  keywords: ["ChatGPT", "MCP", "distribution automation", "lead generation", "cold email", "OpenAI"],
};

const LLM_INSTRUCTIONS = `# distribute + ChatGPT Integration

## Requirements
- ChatGPT Plus, Pro, Team, or Enterprise subscription
- distribute API key

## Setup Steps
1. Open ChatGPT Settings → Connectors
2. Click "Add Custom Connector"
3. Enter MCP URL: https://mcp.distribute.you/mcp
4. Add Authorization header: Bearer YOUR_API_KEY
5. Save and enable the connector

## Available Tools
- distribute_status: Check connection
- distribute_create_campaign: Launch cold email campaign
- distribute_list_campaigns: List campaigns
- distribute_stop_campaign: Stop a campaign
- distribute_resume_campaign: Resume a campaign
- distribute_campaign_stats: Get campaign performance
- distribute_list_brands: List your brands
- distribute_suggest_icp: Suggest ideal customer profile for a brand URL

## Example Prompts
"Launch a cold email campaign for mybrand.com targeting CTOs at SaaS companies. $10/day budget."
"Check my distribute connection status"
"What's the status of my sales campaign?"

## Get API Key
https://dashboard.distribute.you/api-keys`;

export default function ChatGPTIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">ChatGPT Integration</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-600 mb-8">
        Connect distribute to ChatGPT and launch campaigns directly from OpenAI&apos;s interface.
      </p>

      <div className="prose prose-lg">
        <h2>Requirements</h2>
        <ul>
          <li><strong>ChatGPT Plus, Pro, Team, or Enterprise</strong> subscription</li>
          <li><strong>distribute API key</strong> from your dashboard</li>
        </ul>

        <h2>Setup Steps</h2>
        <ol>
          <li>Open <strong>ChatGPT Settings</strong> (gear icon)</li>
          <li>Navigate to <strong>Connectors</strong></li>
          <li>Click <strong>Add Custom Connector</strong></li>
          <li>
            Enter the MCP URL:
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
              <code>https://mcp.distribute.you/mcp</code>
            </pre>
          </li>
          <li>
            Add your API key in the Authorization header:
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
              <code>Bearer YOUR_API_KEY</code>
            </pre>
          </li>
          <li>Save and enable the connector</li>
        </ol>

        <h2>Test Your Connection</h2>
        <p>Ask ChatGPT:</p>
        <pre className="bg-gray-100 p-4 rounded-lg">
          <code className="text-gray-800">&quot;Check my distribute connection status&quot;</code>
        </pre>
        <p>ChatGPT will call the <code>distribute_status</code> tool and confirm your setup.</p>

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

        <h2>Troubleshooting</h2>

        <h3>Connector not working</h3>
        <ul>
          <li>Verify you have a ChatGPT Plus/Pro/Team subscription</li>
          <li>Check that the MCP URL is exactly: <code>https://mcp.distribute.you/mcp</code></li>
          <li>Ensure your API key is valid</li>
        </ul>

        <h3>Authorization errors</h3>
        <ul>
          <li>Make sure the header is <code>Authorization: Bearer YOUR_KEY</code></li>
          <li>Verify your API key at <a href="https://dashboard.distribute.you/api-keys">dashboard.distribute.you/api-keys</a></li>
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
