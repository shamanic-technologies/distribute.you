import { Metadata } from "next";
import Link from "next/link";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect distribute to Claude Code, Claude Desktop, Cursor, ChatGPT, n8n, Zapier, Make.com, and more.",
};

const LLM_INSTRUCTIONS = `# distribute Integrations

## MCP Clients (recommended)
- Claude Code: claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY
- Claude Desktop: add to claude_desktop_config.json
- Cursor: add to .cursor/mcp.json
- ChatGPT: MCP connector or GPT Actions

## Automation Platforms (REST API)
- n8n: HTTP Request node
- Zapier: Webhooks by Zapier
- Make.com: HTTP module

## Integration Methods
1. MCP Server: 35 tools, recommended for AI clients
2. REST API: api.distribute.you/v1, TypeScript client available
3. Webhooks: real-time event notifications`;

const MCP_CLIENTS = [
  {
    name: "Claude Code",
    description: "Use distribute from Claude Code with one command.",
    href: "/integrations/claude",
  },
  {
    name: "Claude Desktop",
    description: "Add distribute tools to Claude Desktop app.",
    href: "/integrations/claude-desktop",
  },
  {
    name: "Cursor",
    description: "Connect distribute to Cursor IDE.",
    href: "/integrations/cursor",
  },
  {
    name: "ChatGPT",
    description: "Use distribute with ChatGPT Plus, Pro, Team, or Enterprise.",
    href: "/integrations/chatgpt",
  },
];

const AUTOMATION_PLATFORMS = [
  {
    name: "n8n",
    description: "Build automated workflows using HTTP requests.",
    href: "/integrations/n8n",
  },
  {
    name: "Zapier",
    description: "Connect distribute to 5,000+ apps with Zapier.",
    href: "/integrations/zapier",
  },
  {
    name: "Make.com",
    description: "Create visual automation scenarios with Make.com.",
    href: "/integrations/make",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Connect distribute to your favorite tools and platforms.
      </p>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">MCP Clients</h2>
      <p className="text-gray-500 text-sm mb-4">
        Use the <code className="text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded text-xs">@distribute/mcp</code> server
        from any MCP-compatible AI client.
      </p>
      <div className="grid gap-2 mb-10">
        {MCP_CLIENTS.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="block p-3 border border-gray-200 rounded-lg hover:border-brand-300 hover:shadow-sm transition"
          >
            <h3 className="text-sm font-semibold text-gray-900">{item.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
          </Link>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Automation Platforms</h2>
      <p className="text-gray-500 text-sm mb-4">
        Use the REST API to integrate distribute with automation platforms.
      </p>
      <div className="grid gap-2 mb-10">
        {AUTOMATION_PLATFORMS.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="block p-3 border border-gray-200 rounded-lg hover:border-brand-300 hover:shadow-sm transition"
          >
            <h3 className="text-sm font-semibold text-gray-900">{item.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
          </Link>
        ))}
      </div>

      <div className="prose">
        <h2>Integration Methods</h2>

        <h3>1. MCP Server (Recommended)</h3>
        <p>
          Install <code>@distribute/mcp</code> for full automation from AI clients.
          35 tools for brands, campaigns, workflows, leads, press kits, billing, and more.
        </p>

        <h3>2. REST API</h3>
        <p>
          Call the REST API directly or use the <code>@distribute/api-client</code> TypeScript client.
          See the <Link href="/api">API Reference</Link>.
        </p>

        <h3>3. Webhooks</h3>
        <p>
          Receive real-time notifications when campaigns reach milestones, receive replies,
          or complete. See <Link href="/api/webhooks">Webhooks</Link>.
        </p>
      </div>
    </div>
  );
}
