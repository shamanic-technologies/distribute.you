import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claude Desktop Integration",
  description: "Add distribute tools to Claude Desktop. Configure the MCP server and start automating distribution.",
};

export default function ClaudeDesktopIntegrationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">Claude Desktop</h1>
      <p className="text-base text-gray-500 mb-8">
        Add distribute tools to the Claude Desktop app.
      </p>

      <div className="prose">
        <h2>Setup</h2>
        <p>Edit your Claude Desktop configuration file:</p>
        <ul>
          <li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
          <li><strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
        </ul>

        <p>Add the distribute MCP server:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "mcpServers": {
    "distribute": {
      "command": "npx",
      "args": ["@distribute/mcp", "--api-key=YOUR_KEY"]
    }
  }
}`}</code>
        </pre>

        <h2>Restart</h2>
        <p>
          Quit and reopen Claude Desktop. You should see &quot;distribute&quot; listed
          in the available tools when you start a new conversation.
        </p>

        <h2>Verify</h2>
        <p>Ask Claude:</p>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200">
          <code>&quot;Check my distribute connection&quot;</code>
        </pre>

        <h2>Usage</h2>
        <p>
          Once connected, you can use all 35 distribute tools from Claude Desktop.
          See the <a href="/mcp/tools">Tools Reference</a> for the full list.
        </p>
      </div>
    </div>
  );
}
