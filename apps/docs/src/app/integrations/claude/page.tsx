import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Claude Code Integration",
  description: "Use distribute from Claude Code. One command to install, 35 tools for brands, campaigns, leads, and more.",
};

const LLM_INSTRUCTIONS = `# distribute + Claude Code

## Install
claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY

## Verify
Ask: "Check my distribute connection" → whoami tool

## Example Prompts
- "Create a brand for acme.com"
- "Launch a cold email campaign targeting CTOs, $10/day budget"
- "Show stats for my latest campaign"
- "Generate a press kit for my brand"
- "What's my billing balance?"

## 35 tools available
See full list: docs.distribute.you/mcp/tools`;

export default function ClaudeIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-5xl font-bold text-gray-900">Claude Code</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-500 mb-10">
        Use distribute directly from Claude Code.
      </p>

      <div className="prose prose-lg">
        <h2>Install</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY</code>
        </pre>
        <p>
          This registers <code>@distribute/mcp</code> as a local MCP server.
          Claude Code will have access to 35 tools for managing your entire distribution pipeline.
        </p>

        <h2>Verify</h2>
        <p>Ask Claude Code:</p>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200">
          <code>&quot;Check my distribute connection&quot;</code>
        </pre>
        <p>Claude will call the <code>whoami</code> tool and show your user ID and org ID.</p>

        <h2>Usage</h2>
        <p>Just describe what you want in natural language:</p>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200 overflow-x-auto">
          <code>{`"Create a brand for acme.com and launch a cold email campaign
targeting CTOs at SaaS startups with $50/day budget"`}</code>
        </pre>

        <p>Claude Code will:</p>
        <ol>
          <li>Call <code>brands_create</code> with your URL</li>
          <li>Call <code>features_list</code> to find the right feature</li>
          <li>Call <code>workflows_list</code> to pick the best workflow</li>
          <li>Call <code>campaigns_create</code> with your parameters</li>
        </ol>

        <h2>Example Prompts</h2>
        <ul>
          <li>&quot;Show me all my brands&quot;</li>
          <li>&quot;What workflows are available for journalist outreach?&quot;</li>
          <li>&quot;Get the stats for campaign camp_abc123&quot;</li>
          <li>&quot;Generate a press kit highlighting our latest product launch&quot;</li>
          <li>&quot;How much have I spent this month?&quot;</li>
          <li>&quot;List all journalists discovered for my brand&quot;</li>
        </ul>

        <h2>All 35 Tools</h2>
        <p>
          See the full <a href="/mcp/tools">Tools Reference</a> for detailed descriptions.
        </p>
      </div>
    </div>
  );
}
