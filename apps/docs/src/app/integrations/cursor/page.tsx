import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cursor Integration",
  description: "Connect distribute to Cursor IDE. Configure the MCP server and automate distribution from your editor.",
};

export default function CursorIntegrationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Cursor</h1>
      <p className="text-xl text-gray-500 mb-10">
        Connect distribute to Cursor IDE.
      </p>

      <div className="prose prose-lg">
        <h2>Setup</h2>
        <p>Add to <code>.cursor/mcp.json</code> in your project root (or global config):</p>
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
        <p>Restart Cursor after saving. The distribute tools will appear in Agent mode.</p>

        <h2>Verify</h2>
        <p>In Cursor&apos;s Agent mode, ask:</p>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200">
          <code>&quot;Check my distribute connection&quot;</code>
        </pre>

        <h2>Usage</h2>
        <p>
          Use all 35 distribute tools from Cursor&apos;s Agent mode.
          See the <a href="/mcp/tools">Tools Reference</a> for the full list.
        </p>
      </div>
    </div>
  );
}
