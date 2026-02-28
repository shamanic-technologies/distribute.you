import { Metadata } from "next";
import Link from "next/link";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect distribute to ChatGPT, Claude, Cursor, n8n, Zapier, Make.com, and more. Automate workflows with MCP and REST API.",
  openGraph: {
    title: "Integrations | distribute Docs",
    description: "Connect distribute to your favorite tools.",
  },
};

const LLM_INSTRUCTIONS = `# distribute Integrations

## AI Clients (MCP Protocol)
- ChatGPT: Settings → Connectors → Add https://mcp.mcpfactory.org/mcp
- Claude.ai: Settings → Integrations → Add https://mcp.mcpfactory.org/mcp
- Claude Desktop: Edit claude_desktop_config.json
- Cursor: Add to .cursor/mcp.json

## Automation Platforms
- n8n: Use HTTP Request node with API
- Zapier: Use Webhooks by Zapier
- Make.com: Use HTTP module

## Integration Methods
1. MCP Protocol (Recommended): Full automation from AI clients
2. REST API: Direct HTTP calls from any platform
3. Webhooks: Real-time event notifications

## MCP Endpoint
https://mcp.mcpfactory.org/mcp

## API Base URL
https://api.mcpfactory.org/v1`;

const AI_CLIENTS = [
  {
    name: "ChatGPT",
    description: "Connect distribute to OpenAI's ChatGPT (Plus, Pro, Team, Enterprise).",
    href: "/integrations/chatgpt",
    icon: "🤖",
  },
  {
    name: "Claude",
    description: "Use distribute with Claude.ai, Claude Desktop, or Claude Code.",
    href: "/integrations/claude",
    icon: "🧠",
  },
  {
    name: "Cursor",
    description: "Connect distribute to Cursor IDE for AI-assisted workflows.",
    href: "/integrations/cursor",
    icon: "🖥️",
  },
  {
    name: "Cursor Skill",
    description: "Advanced: Install distribute as a Cursor skill with custom instructions.",
    href: "/integrations/cursor-skill",
    icon: "⚙️",
  },
];

const AUTOMATION_PLATFORMS = [
  {
    name: "n8n",
    description: "Build automated workflows with n8n using HTTP requests or custom nodes.",
    href: "/integrations/n8n",
    icon: "🔄",
  },
  {
    name: "Zapier",
    description: "Connect distribute to 5,000+ apps with Zapier automations.",
    href: "/integrations/zapier",
    icon: "⚡",
  },
  {
    name: "Make.com",
    description: "Create visual automation scenarios with Make.com integration.",
    href: "/integrations/make",
    icon: "🔧",
  },
];

export default function IntegrationsPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">Integrations</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-600 mb-8">
        Connect distribute to your favorite tools and platforms.
      </p>

      <h2 className="text-2xl font-semibold mb-4">AI Clients</h2>
      <div className="grid gap-4 mb-8">
        {AI_CLIENTS.map((integration) => (
          <Link
            key={integration.name}
            href={integration.href}
            className="block p-6 border border-gray-200 rounded-lg hover:border-primary-500 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{integration.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {integration.name}
                </h3>
                <p className="text-gray-600 mt-1">{integration.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="text-2xl font-semibold mb-4">Automation Platforms</h2>
      <div className="grid gap-4">
        {AUTOMATION_PLATFORMS.map((integration) => (
          <Link
            key={integration.name}
            href={integration.href}
            className="block p-6 border border-gray-200 rounded-lg hover:border-primary-500 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{integration.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {integration.name}
                </h3>
                <p className="text-gray-600 mt-1">{integration.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="prose prose-lg mt-12">
        <h2>Integration Methods</h2>
        <p>distribute can be integrated in three ways:</p>

        <h3>1. MCP Protocol (Recommended)</h3>
        <p>
          Use our MCPs directly from Claude, Cursor, or any MCP-compatible
          client. This is the most powerful option with full automation.
        </p>

        <h3>2. REST API</h3>
        <p>
          Call our REST API from any platform that supports HTTP requests. See
          the <Link href="/api">API Reference</Link> for details.
        </p>

        <h3>3. Webhooks</h3>
        <p>
          Receive real-time updates when campaigns change status, reach
          milestones, or complete. Configure webhooks in your dashboard.
        </p>

        <h2>Need Help?</h2>
        <p>
          If you need help integrating distribute with your stack, reach out at{" "}
          <a href="mailto:support@mcpfactory.org">support@mcpfactory.org</a>.
        </p>
      </div>
    </div>
  );
}
