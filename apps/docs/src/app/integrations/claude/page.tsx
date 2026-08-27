import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import { CopyForLLM } from "@/components/copy-for-llm";
import {
  CLAUDE_CODE_MCP_COMMAND,
  MCP_TOOLS,
  MCP_TOOL_COUNT,
  MCP_URL,
} from "@/lib/developer-surfaces";

export const metadata = docsMetadata("/integrations/claude");

const LLM_INSTRUCTIONS = `# distribute.you + Claude Code

## Connect
The server is hosted at ${MCP_URL}. Nothing to install.
${CLAUDE_CODE_MCP_COMMAND}

## Verify
Ask: "Check my distribute.you connection" -> distribute_status tool

## Example prompts
- "Show me all my brands"
- "Read acme.com and suggest who I should be targeting"
- "Which of my campaigns are still running?"
- "What did campaign camp_abc123 produce, and what did it cost?"
- "Which workflows can I run?"

## Tools (${MCP_TOOL_COUNT} total)
${MCP_TOOLS.map((t) => t.name).join(", ")}
Full list: docs.distribute.you/mcp/tools`;

export default function ClaudeIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/integrations/claude")}</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Use distribute.you directly from Claude Code.
      </p>

      <div className="prose">
        <h2>Connect</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{CLAUDE_CODE_MCP_COMMAND}</code>
        </pre>
        <p>
          The server is hosted at <code>{MCP_URL}</code> and speaks Streamable HTTP, so this
          registers a URL rather than installing anything. Claude Code then has the{" "}
          {MCP_TOOL_COUNT} distribute.you tools.
        </p>

        <h2>Verify</h2>
        <p>Ask Claude Code:</p>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200">
          <code>&quot;Check my distribute.you connection&quot;</code>
        </pre>
        <p>
          It calls the <code>distribute_status</code> tool and shows your user id and org id.
        </p>

        <h2>Usage</h2>
        <p>Describe what you want in natural language:</p>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200 overflow-x-auto">
          <code>{`"Read acme.com, suggest who I should be targeting,
then show me what my running campaigns are costing"`}</code>
        </pre>

        <p>Claude Code will:</p>
        <ol>
          <li>Call <code>distribute_suggest_icp</code> with the website</li>
          <li>Call <code>distribute_list_campaigns</code> to find what is running</li>
          <li>Call <code>distribute_campaign_stats</code> for each one</li>
        </ol>
        <p>
          Creating a brand or launching a campaign is not one of these tools. That is a call to the{" "}
          <a href="/api">REST API</a>, or a signup in the dashboard.
        </p>

        <h2>Example prompts</h2>
        <ul>
          <li>&quot;Show me all my brands&quot;</li>
          <li>&quot;Which workflows can I run?&quot;</li>
          <li>&quot;Get the stats for campaign camp_abc123&quot;</li>
          <li>&quot;Read acme.com and tell me who to target&quot;</li>
          <li>&quot;Which of my campaigns stopped?&quot;</li>
        </ul>

        <h2>All {MCP_TOOL_COUNT} tools</h2>
        <p>
          See the full <a href="/mcp/tools">Tools Reference</a> for what each one does.
        </p>
      </div>
    </div>
  );
}
