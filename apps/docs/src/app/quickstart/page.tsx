import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS } from "@distribute/content";
import {
  API_KEY_PREFIX,
  CLAUDE_CODE_MCP_COMMAND,
  CLI_INSTALL_COMMAND,
  DEVELOPER_HUB_URL,
  MCP_TOOLS,
  MCP_TOOL_COUNT,
  curlExample,
} from "@/lib/developer-surfaces";

export const metadata = docsMetadata("/quickstart");

const LLM_INSTRUCTIONS = `# distribute.you Quick Start

## 1. Create an account
Sign up at dashboard.distribute.you/sign-up

## 2. Get an API key
Dashboard, API Keys, Create key.
Format: ${API_KEY_PREFIX}xxxxxxxxxxxxxxxxxxxx

## 3. Connect the MCP server (hosted, nothing to install)
${CLAUDE_CODE_MCP_COMMAND}

## 4. Test the connection
Ask: "Check my distribute.you connection" -> calls distribute_status

## 5. Read and steer
"Show me my brands" -> distribute_list_brands
"Read acme.com and suggest who to target" -> distribute_suggest_icp
"Which campaigns are running?" -> distribute_list_campaigns
"What did campaign X produce, and what did it cost?" -> distribute_campaign_stats

## 6. Create things over the REST API or the CLI
${curlExample("/v1/brands", '-H "Content-Type: application/json" \\\\\n  -d \'{"url":"https://acme.com"}\'')}

Or from a shell:
${CLI_INSTALL_COMMAND}

## Tools (${MCP_TOOL_COUNT} total)
${MCP_TOOLS.map((t) => t.name).join(", ")}`;

export default function QuickstartPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/quickstart")}</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Get up and running with distribute.you in 5 minutes.
      </p>

      <div className="prose">
        <h2>1. Create an account</h2>
        <p>
          Go to <a href={URLS.signUp}>dashboard.distribute.you</a> and create your account.
        </p>

        <h2>2. Get your API key</h2>
        <p>
          In the dashboard, go to <strong>API Keys</strong> and create a new key.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`${API_KEY_PREFIX}xxxxxxxxxxxxxxxxxxxxxxxx`}</code>
        </pre>
        <p>
          <strong>Keep this key secret.</strong> It grants full access to your account.
        </p>

        <h2>3. Connect the MCP server</h2>
        <p>
          The server is hosted, so there is nothing to install. From Claude Code, one command:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{CLAUDE_CODE_MCP_COMMAND}</code>
        </pre>
        <p>
          That gives your AI client the {MCP_TOOL_COUNT} distribute.you tools. For Claude Desktop,
          Cursor and every other client, see the{" "}
          <a href="/mcp/installation">Installation guide</a>.
        </p>

        <h2>4. Test the connection</h2>
        <p>In your AI client, ask:</p>
        <pre className="bg-gray-100 text-gray-800 p-4 rounded-lg">
          <code>&quot;Check my distribute.you connection&quot;</code>
        </pre>
        <p>
          It calls the <code>distribute_status</code> tool and answers with your user id, your org
          id, and confirmation that the key works.
        </p>

        <h2>5. Read and steer from the client</h2>
        <p>Describe what you want in natural language:</p>
        <pre className="bg-gray-100 text-gray-800 p-4 rounded-lg overflow-x-auto">
          <code>{`"Show me the brands on my account"
"Read acme.com and suggest who I should be targeting"
"Which of my campaigns are still running?"
"What did my latest campaign produce, and what did it cost?"`}</code>
        </pre>

        <h2>6. Create things over the API</h2>
        <p>
          The MCP tools read and steer. Creating a brand or launching a campaign is a call to the
          REST API, which covers every operation the platform has:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{curlExample("/v1/brands", `-H "Content-Type: application/json" \\\\
  -d '{"url":"https://acme.com"}'`)}</code>
        </pre>
        <p>From a terminal or a CI job, the CLI is shorter:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{CLI_INSTALL_COMMAND}</code>
        </pre>
        <p>
          If you would rather not touch any of this, sign up in the dashboard and give it a website:
          the campaign is set up for you at the same price.
        </p>

        <h2>What happens next</h2>
        <ol>
          <li>Your brand profile is read from your website</li>
          <li>Matching people are found</li>
          <li>Emails are written and sent from domains we own and warm</li>
          <li>Delivery is tracked</li>
          <li>Replies are qualified, and the interested ones reach you</li>
        </ol>

        <h2>What&apos;s next?</h2>
        <ul>
          <li><a href="/mcp">MCP Server</a>: the hosted server and all {MCP_TOOL_COUNT} tools</li>
          <li><a href="/api">API Reference</a>: REST API for programmatic access</li>
          <li><a href="/integrations">Integrations</a>: Claude, Cursor, n8n, Zapier, Make.com</li>
          <li><a href={DEVELOPER_HUB_URL}>Developer resources</a>: every surface, named on one page</li>
        </ul>
      </div>
    </div>
  );
}
