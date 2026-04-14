import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claude Desktop Integration",
  description: "Add distribute tools to Claude Desktop. Configure the MCP server and start automating distribution.",
};

export default function ClaudeDesktopIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Claude Desktop</h1>
      <p className="text-xl text-gray-500 mb-10">
        Add distribute tools to the Claude Desktop app.
      </p>

      <div className="prose prose-lg">
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
