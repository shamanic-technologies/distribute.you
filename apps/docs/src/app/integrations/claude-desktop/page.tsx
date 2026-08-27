import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import {
  AUTH_HEADER_LINE,
  MCP_REMOTE_BRIDGE_PACKAGE,
  MCP_STDIO_BRIDGE_CONFIG,
  MCP_TOOL_COUNT,
  MCP_URL,
} from "@/lib/developer-surfaces";

export const metadata = docsMetadata("/integrations/claude-desktop");

export default function ClaudeDesktopIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">{docsHeading("/integrations/claude-desktop")}</h1>
      <p className="text-base text-gray-500 mb-8">
        Add distribute.you tools to the Claude Desktop app.
      </p>

      <div className="prose">
        <h2>Setup</h2>
        <p>
          The distribute.you MCP server is hosted at <code>{MCP_URL}</code> and speaks Streamable
          HTTP. On a build with remote connectors, add it under{" "}
          <strong>Settings, Connectors, Add custom connector</strong>, with that URL and this
          header:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{AUTH_HEADER_LINE}</code>
        </pre>
        <p>
          Otherwise bridge the desktop app to the hosted server with{" "}
          <code>{MCP_REMOTE_BRIDGE_PACKAGE}</code>, which is published on npm and is not ours. Edit
          your configuration file:
        </p>
        <ul>
          <li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
          <li><strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
        </ul>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{MCP_STDIO_BRIDGE_CONFIG}</code>
        </pre>

        <h2>Restart</h2>
        <p>
          Quit and reopen Claude Desktop. You should see &quot;distribute&quot; listed
          in the available tools when you start a new conversation.
        </p>

        <h2>Verify</h2>
        <p>Ask Claude:</p>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200">
          <code>&quot;Check my distribute.you connection&quot;</code>
        </pre>

        <h2>Usage</h2>
        <p>
          Once connected, you can use all {MCP_TOOL_COUNT} distribute.you tools from Claude Desktop.
          See the <a href="/mcp/tools">Tools Reference</a> for the full list.
        </p>
      </div>
    </div>
  );
}
