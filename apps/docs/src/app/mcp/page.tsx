import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import Link from "next/link";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS } from "@distribute/content";
import {
  AUTH_HEADER_LINE,
  CLAUDE_CODE_MCP_COMMAND,
  DEVELOPER_HUB_URL,
  MCP_TOOLS,
  MCP_TOOL_COUNT,
  MCP_URL,
} from "@/lib/developer-surfaces";

export const metadata = docsMetadata("/mcp");

const LLM_INSTRUCTIONS = `# distribute.you MCP Server

Hosted, Streamable HTTP. Nothing to install.

Endpoint: ${MCP_URL}
Header:   ${AUTH_HEADER_LINE}

## Connect from Claude Code
${CLAUDE_CODE_MCP_COMMAND}

## Tools (${MCP_TOOL_COUNT} total)
${MCP_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

## Auth
One header on every request, carrying an API key issued in the dashboard. The
key carries the org and user identity, so no other header is needed.`;

export default function McpOverviewPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/mcp")}</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Use distribute.you from Claude Code, Claude Desktop, Cursor, or any MCP-compatible client.
      </p>

      <div className="prose">
        <h2>What is MCP?</h2>
        <p>
          The <strong>Model Context Protocol (MCP)</strong> is an open standard that lets AI
          assistants connect to external tools. distribute.you runs a hosted MCP server with{" "}
          {MCP_TOOL_COUNT} tools for reading and steering your outreach.
        </p>

        <h2>Connect</h2>
        <p>
          The server is hosted and speaks Streamable HTTP, so there is no package to install. From
          Claude Code, one command:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{CLAUDE_CODE_MCP_COMMAND}</code>
        </pre>
        <p>
          See <Link href="/mcp/installation">Installation</Link> for Claude Desktop, Cursor, and
          every other client.
        </p>

        <h2>How it works</h2>
        <p>
          Your client opens an HTTP connection to <code>{MCP_URL}</code> and sends your API key as a
          Bearer token. The server calls the distribute.you API on your behalf, as the org that key
          belongs to.
        </p>
        <ol>
          <li>Register the endpoint and the header with your client</li>
          <li>Your client discovers the {MCP_TOOL_COUNT} tools it advertises</li>
          <li>Describe what you want in natural language</li>
          <li>The AI translates that into tool calls</li>
        </ol>

        <h2>Example prompts</h2>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg overflow-x-auto border border-gray-200">
          <code>{`"Show me the brands on my account"
"Which of my campaigns are still running?"
"What did my latest campaign produce, and what did it cost?"
"Read acme.com and suggest who I should be targeting"
"Which workflows can I run?"`}</code>
        </pre>

        <h2>Tools</h2>
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {MCP_TOOLS.map((tool) => (
              <tr key={tool.name}>
                <td><code>{tool.name}</code></td>
                <td>{tool.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          The full <Link href="/mcp/tools">Tools Reference</Link> carries the same list with each
          tool&apos;s arguments. Anything beyond these is reachable over the{" "}
          <Link href="/api">REST API</Link>, which covers every operation the platform has.
        </p>

        <h2>Authentication</h2>
        <p>The server takes one header, the same one the REST API takes:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{AUTH_HEADER_LINE}</code>
        </pre>
        <p>
          Get your API key at{" "}
          <a href={URLS.apiKeys}>{URLS.apiKeys.replace("https://", "")}</a>. Every developer surface
          is named together at <a href={DEVELOPER_HUB_URL}>{DEVELOPER_HUB_URL}</a>.
        </p>
      </div>
    </div>
  );
}
