import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS } from "@distribute/content";

export const metadata: Metadata = {
  title: "Quick Start",
  description: "Get started with distribute in 5 minutes. Install the MCP server and launch your first campaign from Claude Code or Cursor.",
  openGraph: {
    title: "Quick Start | distribute Docs",
    description: "Get started with distribute in 5 minutes.",
  },
};

const LLM_INSTRUCTIONS = `# distribute Quick Start

## 1. Create Account
Sign up at dashboard.distribute.you/sign-up

## 2. Get API Key
Dashboard → API Keys → Create Key
Format: dist_xxxxxxxxxxxxxxxxxxxx

## 3. Install MCP Server
claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY

## 4. Test Connection
Ask: "Check my distribute connection" → calls whoami tool

## 5. Create a Brand
"Create a brand for acme.com" → calls brands_create

## 6. Launch Campaign
"Launch a cold email campaign for acme.com targeting CTOs at SaaS startups, $10/day budget"
→ calls campaigns_create

## Available Tools (35 total)
whoami, brands_list, brands_get, brands_create, brands_extract_fields,
features_list, features_get, features_prefill, features_stats, features_global_stats, features_stats_registry,
campaigns_list, campaigns_get, campaigns_create, campaigns_stop, campaigns_stats,
leads_list, emails_list,
workflows_list, workflows_get, workflows_summary, workflows_key_status,
outlets_list, outlets_by_campaign,
journalists_list, journalists_by_campaign,
articles_list,
press_kits_list, press_kits_get, press_kits_generate, press_kits_view_stats,
billing_balance, billing_account, billing_transactions,
costs_brand_breakdown, costs_by_brand, costs_delivery_stats`;

export default function QuickstartPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-5xl font-bold text-gray-900">Quick Start</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-500 mb-10">
        Get up and running with distribute in 5 minutes.
      </p>

      <div className="prose prose-lg">
        <h2>1. Create an Account</h2>
        <p>
          Go to{" "}
          <a href={URLS.signUp}>dashboard.distribute.you</a>{" "}
          and create your account.
        </p>

        <h2>2. Get Your API Key</h2>
        <p>
          In the dashboard, go to <strong>API Keys</strong> and create a new key.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>dist_xxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
        </pre>
        <p>
          <strong>Keep this key secret.</strong> It grants full access to your account.
        </p>

        <h2>3. Install the MCP Server</h2>
        <p>The fastest way to use distribute is from Claude Code:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY</code>
        </pre>
        <p>
          This installs <code>@distribute/mcp</code> as a local MCP server, giving your AI assistant
          access to 35 tools for managing brands, campaigns, workflows, leads, press kits, and more.
        </p>
        <p>
          For other clients (Claude Desktop, Cursor), see the{" "}
          <a href="/mcp/installation">Installation guide</a>.
        </p>

        <h2>4. Test the Connection</h2>
        <p>In your AI client, ask:</p>
        <pre className="bg-gray-100 text-gray-800 p-4 rounded-lg">
          <code>&quot;Check my distribute connection&quot;</code>
        </pre>
        <p>
          The AI will call the <code>whoami</code> tool and confirm your user ID,
          org ID, and that your key is working.
        </p>

        <h2>5. Create a Brand</h2>
        <p>Tell your AI client:</p>
        <pre className="bg-gray-100 text-gray-800 p-4 rounded-lg">
          <code>&quot;Create a brand for acme.com&quot;</code>
        </pre>
        <p>
          distribute will scrape your website, analyze your business, and create a brand profile
          that powers all future campaigns.
        </p>

        <h2>6. Launch Your First Campaign</h2>
        <p>Describe what you want in natural language:</p>
        <pre className="bg-gray-100 text-gray-800 p-4 rounded-lg overflow-x-auto">
          <code>&quot;Launch a cold email campaign for acme.com targeting CTOs at SaaS startups. $10/day budget.&quot;</code>
        </pre>

        <p>distribute will:</p>
        <ol>
          <li>Use your brand profile to understand your business</li>
          <li>Find matching leads via Apollo</li>
          <li>Generate personalized emails with AI</li>
          <li>Send emails and track delivery</li>
          <li>Qualify replies and notify you of interested prospects</li>
        </ol>

        <h2>What&apos;s Next?</h2>
        <ul>
          <li><a href="/mcp">MCP Server</a> — Full MCP documentation and all 35 tools</li>
          <li><a href="/api">API Reference</a> — REST API for programmatic access</li>
          <li><a href="/integrations">Integrations</a> — Claude, Cursor, n8n, Zapier, Make.com</li>
        </ul>
      </div>
    </div>
  );
}
