import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "MCP Installation",
  description: "Install the distribute MCP server for Claude Code, Claude Desktop, Cursor, and other MCP-compatible clients.",
  openGraph: {
    title: "MCP Installation | distribute Docs",
    description: "Install distribute MCP for Claude, Cursor, and more.",
  },
};

const LLM_INSTRUCTIONS = `# distribute MCP Installation

## Claude Code
claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY

## Claude Desktop
Edit ~/Library/Application Support/Claude/claude_desktop_config.json:
{
  "mcpServers": {
    "distribute": {
      "command": "npx",
      "args": ["@distribute/mcp", "--api-key=YOUR_KEY"]
    }
  }
}

## Cursor
Edit .cursor/mcp.json:
{
  "mcpServers": {
    "distribute": {
      "command": "npx",
      "args": ["@distribute/mcp", "--api-key=YOUR_KEY"]
    }
  }
}

## Environment Variable (alternative)
DISTRIBUTE_API_KEY=dist_YOUR_KEY npx @distribute/mcp

## Custom API URL
npx @distribute/mcp --api-key=YOUR_KEY --base-url=https://custom.api.url`;

export default function McpInstallationPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-5xl font-bold text-gray-900">Installation</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-500 mb-10">
        Install the distribute MCP server for your preferred AI client.
      </p>

      <div className="prose prose-lg">
        <h2>Claude Code</h2>
        <p>One command:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY</code>
        </pre>
        <p>Restart Claude Code. You now have access to 35 distribute tools.</p>

        <h2>Claude Desktop</h2>
        <p>Edit your Claude Desktop config file:</p>
        <ul>
          <li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
          <li><strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
        </ul>
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
        <p>Restart Claude Desktop after saving.</p>

        <h2>Cursor</h2>
        <p>
          Add to <code>.cursor/mcp.json</code> in your project root (or global config):
        </p>
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
        <p>Restart Cursor after saving.</p>

        <h2>Any MCP Client</h2>
        <p>
          The distribute MCP server uses <strong>stdio transport</strong>. Configure your client to run:
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>npx @distribute/mcp --api-key=YOUR_KEY</code>
        </pre>

        <h2>Configuration Options</h2>
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>Description</th>
              <th>Default</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>--api-key=KEY</code></td>
              <td>Your distribute API key</td>
              <td>—</td>
            </tr>
            <tr>
              <td><code>--base-url=URL</code></td>
              <td>Custom API base URL</td>
              <td><code>https://api.distribute.you</code></td>
            </tr>
            <tr>
              <td><code>DISTRIBUTE_API_KEY</code></td>
              <td>API key via environment variable</td>
              <td>—</td>
            </tr>
            <tr>
              <td><code>DISTRIBUTE_API_URL</code></td>
              <td>Base URL via environment variable</td>
              <td><code>https://api.distribute.you</code></td>
            </tr>
          </tbody>
        </table>
        <p>CLI flags take precedence over environment variables.</p>

        <h2>Verify Installation</h2>
        <p>After installing, ask your AI client:</p>
        <pre className="bg-gray-50 text-gray-800 p-4 rounded-lg border border-gray-200">
          <code>&quot;Check my distribute connection&quot;</code>
        </pre>
        <p>
          The AI will call the <code>whoami</code> tool and return your user ID and org ID.
        </p>
      </div>
    </div>
  );
}
