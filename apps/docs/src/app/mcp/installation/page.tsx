import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import { CopyForLLM } from "@/components/copy-for-llm";
import {
  API_KEYS_URL,
  AUTH_HEADER_LINE,
  CLAUDE_CODE_MCP_COMMAND,
  DEVELOPER_HUB_URL,
  MCP_HTTP_CONFIG,
  MCP_REMOTE_BRIDGE_PACKAGE,
  MCP_STDIO_BRIDGE_CONFIG,
  MCP_URL,
} from "@/lib/developer-surfaces";

export const metadata = docsMetadata("/mcp/installation");

const LLM_INSTRUCTIONS = `# distribute.you MCP Installation

The server is hosted and spoken over Streamable HTTP. There is nothing to
install: a client connects to a URL with a Bearer token.

Endpoint: ${MCP_URL}
Header:   ${AUTH_HEADER_LINE}
Keys:     ${API_KEYS_URL}

## Claude Code
${CLAUDE_CODE_MCP_COMMAND}

## Cursor, and any client that speaks Streamable HTTP
Edit .cursor/mcp.json:
${MCP_HTTP_CONFIG}

## Claude Desktop, and any client that only speaks stdio
Edit ~/Library/Application Support/Claude/claude_desktop_config.json and bridge
through ${MCP_REMOTE_BRIDGE_PACKAGE}:
${MCP_STDIO_BRIDGE_CONFIG}

## Verify
Ask the client to check the distribute.you connection. It calls the
distribute_status tool, which answers with the user and org the key acts for.`;

export default function McpInstallationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/mcp/installation")}</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Connect the distribute.you MCP server to your AI client.
      </p>

      <div className="prose">
        <p>
          The server is <strong>hosted</strong>, and it speaks Streamable HTTP. There is no package
          to install and no subprocess to run: a client connects to one URL and sends one header.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`${MCP_URL}
${AUTH_HEADER_LINE}`}</code>
        </pre>
        <p>
          Issue a key at <a href={API_KEYS_URL}>{API_KEYS_URL}</a>. The key carries your org and
          user identity, so no other header is needed.
        </p>

        <h2>Claude Code</h2>
        <p>One command:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{CLAUDE_CODE_MCP_COMMAND}</code>
        </pre>
        <p>Restart Claude Code. You now have access to the distribute.you tools.</p>

        <h2>Cursor</h2>
        <p>
          Cursor speaks Streamable HTTP natively. Add this to <code>.cursor/mcp.json</code> in your
          project root, or to the global config:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{MCP_HTTP_CONFIG}</code>
        </pre>
        <p>Restart Cursor after saving.</p>

        <h2>Claude Desktop</h2>
        <p>
          Claude Desktop can add a remote server directly under{" "}
          <strong>Settings, Connectors, Add custom connector</strong>, using the same URL and
          header. On a build without that screen, bridge a stdio client to the hosted server with{" "}
          <code>{MCP_REMOTE_BRIDGE_PACKAGE}</code>, which is published on npm and is not ours. Edit
          your config file:
        </p>
        <ul>
          <li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
          <li><strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
        </ul>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{MCP_STDIO_BRIDGE_CONFIG}</code>
        </pre>
        <p>Restart Claude Desktop after saving.</p>

        <h2>Any other MCP client</h2>
        <p>
          A client that speaks Streamable HTTP takes the URL and the header as they are. A client
          that only speaks stdio takes the bridge configuration above. Either way the endpoint is{" "}
          <code>{MCP_URL}</code>.
        </p>

        <h2>Verify</h2>
        <p>After connecting, ask your AI client:</p>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200">
          <code>&quot;Check my distribute.you connection&quot;</code>
        </pre>
        <p>
          It calls the <code>distribute_status</code> tool, which answers with the user and org your
          key acts for. An answer of anything else means the key is wrong or the header is missing.
        </p>

        <h2>Every developer surface</h2>
        <p>
          The REST API, its OpenAPI document, this server and the CLI are named together at{" "}
          <a href={DEVELOPER_HUB_URL}>{DEVELOPER_HUB_URL}</a>.
        </p>
      </div>
    </div>
  );
}
