import Link from "next/link";
import { URLS } from "@distribute/content";
import { CopyForLLM } from "@/components/copy-for-llm";

const LLM_INSTRUCTIONS = `# distribute Documentation

## What is distribute?
AI-powered distribution automation. Provide a URL + budget, distribute handles lead finding, content generation, outreach, and reporting.

## Channels
- Sales Outreach — Cold email to prospects matching your ICP
- Journalist Outreach — Pitch journalists for press coverage
- Hiring Outreach — Reach matching candidates

## Key Concepts
- Brands: your company/product profile, auto-analyzed from URL
- Features: campaign types (Sales Cold Email, Journalist Pitch, etc.)
- Workflows: execution engines behind features, auto-optimized
- Campaigns: running instances with budget limits

## Quick Start
1. Sign up at dashboard.distribute.you
2. Get API key (dist_xxx format)
3. Install MCP: claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY
4. "Create a brand for acme.com"
5. "Launch a cold email campaign targeting CTOs, $10/day budget"

## Access Methods
- MCP Server: npx @distribute/mcp (35 tools)
- REST API: api.distribute.you/v1
- TypeScript Client: @distribute/api-client
- Dashboard: dashboard.distribute.you`;

export default function DocsHome() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">distribute Documentation</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Your distribution, automated. Provide a URL and a budget — distribute handles lead finding,
        content generation, outreach, and reporting.
      </p>

      <div className="prose">
        <h2>What is distribute?</h2>
        <p>
          distribute is an AI-powered distribution automation platform. You provide your website URL and a daily budget.
          distribute finds the right people, writes personalized outreach, sends it, and notifies you when someone replies.
        </p>
        <p>Three channels are live today:</p>
        <ul>
          <li><strong>Sales Outreach</strong> — Cold email campaigns to prospects matching your ICP</li>
          <li><strong>Journalist Outreach</strong> — Pitch journalists who cover your space for press coverage</li>
          <li><strong>Hiring Outreach</strong> — Reach candidates that match your needs</li>
        </ul>

        <h2>Getting Started</h2>
        <ol>
          <li><a href={URLS.signUp}>Create an account</a> and get your API key</li>
          <li>Set up your brand — provide your URL, distribute analyzes your site automatically</li>
          <li>Pick a channel, set a budget, launch a campaign</li>
          <li>Get notified when someone replies</li>
        </ol>

        <h2>Use distribute from</h2>

        <h3>MCP Server (recommended)</h3>
        <p>
          Install the <code>@distribute/mcp</code> package to use distribute from Claude Code, Claude Desktop,
          Cursor, or any MCP-compatible client. See the <Link href="/mcp">MCP Server docs</Link>.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>claude mcp add distribute -- npx @distribute/mcp --api-key=YOUR_KEY</code>
        </pre>

        <h3>REST API</h3>
        <p>
          Use the <code>@distribute/api-client</code> TypeScript client or call the REST API directly.
          See the <Link href="/api">API Reference</Link>.
        </p>

        <h3>Dashboard</h3>
        <p>
          The <a href={URLS.dashboard}>dashboard</a> provides a full UI for managing brands, campaigns,
          workflows, and billing.
        </p>

        <h2>Key Concepts</h2>

        <h3>Brands</h3>
        <p>
          A brand represents your company or product. When you provide a URL, distribute scrapes and analyzes
          your site to understand your business, voice, and value proposition.
        </p>

        <h3>Features</h3>
        <p>
          Features define the types of campaigns you can run (e.g. Sales Cold Email, Journalist Pitch, Press Kit Generation).
          Each feature has specific inputs, outputs, and performance metrics.
        </p>

        <h3>Workflows</h3>
        <p>
          Workflows are the execution engines behind features. Multiple competing workflows run simultaneously
          for each feature, and the best-performing workflow automatically gets more traffic.
        </p>

        <h3>Campaigns</h3>
        <p>
          A campaign is a running instance of a workflow for your brand. You set budget limits and
          distribute handles execution, optimization, and reporting.
        </p>

        <h2>Pricing</h2>
        <p>
          distribute charges at cost — no subscriptions, no markups. You buy credits and only pay for
          what you use (AI calls, lead enrichment, email sends). See your cost breakdown in real-time
          in the dashboard.
        </p>
      </div>
    </div>
  );
}
