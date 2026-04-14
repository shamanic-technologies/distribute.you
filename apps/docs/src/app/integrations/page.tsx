import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect distribute to Claude Code, Claude Desktop, Cursor, ChatGPT, n8n, Zapier, Make.com, and more.",
};

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
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Integrations</h1>
      <p className="text-xl text-gray-500 mb-10">
        Connect distribute to your favorite tools and platforms.
      </p>

      <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">MCP Clients</h2>
      <p className="text-gray-500 mb-6">
        Use the <code className="text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded text-sm">@distribute/mcp</code> server
        from any MCP-compatible AI client.
      </p>
      <div className="grid gap-3 mb-12">
        {MCP_CLIENTS.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="block p-4 border border-gray-200 rounded-lg hover:border-brand-300 hover:shadow-sm transition"
          >
            <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
          </Link>
        ))}
      </div>

      <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">Automation Platforms</h2>
      <p className="text-gray-500 mb-6">
        Use the REST API to integrate distribute with automation platforms.
      </p>
      <div className="grid gap-3 mb-12">
        {AUTOMATION_PLATFORMS.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="block p-4 border border-gray-200 rounded-lg hover:border-brand-300 hover:shadow-sm transition"
          >
            <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
          </Link>
        ))}
      </div>

      <div className="prose prose-lg">
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
