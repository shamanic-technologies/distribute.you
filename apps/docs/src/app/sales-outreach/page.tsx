import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";
const DOCS_PRICING = {
  free: { price: "$0", emails: "Unlimited", detail: "Free + your API costs" },
  estimatedApiCost: "~$0.02/email",
};
const BYOK_COST_ESTIMATES = { totalPerEmail: "~$0.02/email" };
const BYOK_PROVIDERS = [
  { name: "OpenAI or Anthropic", purpose: "Email generation" },
  { name: "Apollo", purpose: "Lead finding & enrichment" },
  { name: "Resend", purpose: "Email sending" },
];

export const metadata: Metadata = {
  title: "Sales Outreach MCP",
  description: "Cold email campaigns from your URL. Find leads, generate emails, send & optimize automatically with the Sales Outreach MCP.",
  openGraph: {
    title: "Sales Outreach MCP | distribute",
    description: "Automate cold email campaigns with AI. Just provide your URL and budget.",
  },
};

const LLM_INSTRUCTIONS = `# Sales Outreach MCP

Cold email campaigns from your URL. Find leads, generate emails, send & optimize.

## Installation
npx @distribute/sales-outreach

Or add to MCP config:
{
  "mcpServers": {
    "sales-outreach": {
      "command": "npx",
      "args": ["@distribute/sales-outreach"],
      "env": {
        "MCPFACTORY_API_KEY": "your-api-key"
      }
    }
  }
}

## API Keys Required
- OpenAI or Anthropic: Email generation
- Apollo: Lead finding & enrichment
- Resend: Email sending

## Usage
"Launch a cold email campaign for acme.com targeting CTOs at tech startups to book sales demos, $10/day budget"

## Available Tools
- launch_campaign: Start new outreach campaign (target_url, target_audience, target_outcome, value_for_target, urgency, scarcity, risk_reversal, social_proof, budget)
- get_campaign_results: Get campaign stats
- pause_campaign / resume_campaign: Control execution
- list_campaigns: List all campaigns
- get_stats: Usage and community benchmarks

## Pricing
- Free: $0, you only pay your API costs (~$0.02/email)`;

export default function SalesOutreachDocs() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-brand-500" />
          <span className="text-sm text-brand-600 font-medium">Available</span>
        </div>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      
      <h1 className="text-4xl font-bold mb-4">Sales Outreach MCP</h1>
      <p className="text-xl text-gray-600 mb-8">
        Cold email campaigns from your URL. Find leads, generate emails, send & optimize.
      </p>

      <div className="prose prose-lg">
        <h2>Installation</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>npx @distribute/sales-outreach</code>
        </pre>

        <p>Or add to your MCP config:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "mcpServers": {
    "sales-outreach": {
      "command": "npx",
      "args": ["@distribute/sales-outreach"],
      "env": {
        "MCPFACTORY_API_KEY": "your-api-key"
      }
    }
  }
}`}</code>
        </pre>

        <h2>API Keys Required</h2>
        <p>Configure these in your distribute dashboard:</p>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {BYOK_PROVIDERS.map((provider) => (
              <tr key={provider.name}>
                <td>{provider.name}</td>
                <td>{provider.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Usage</h2>
        <p>In Claude, Cursor, or any MCP-compatible client:</p>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          <code className="text-gray-800">
            "Launch a cold email campaign for acme.com targeting CTOs at tech startups
            to book sales demos, $10/day budget"
          </code>
        </pre>

        <h2>Available Tools</h2>

        <h3>launch_campaign</h3>
        <p>Start a new outreach campaign.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "target_url": "acme.com",
  "target_audience": "CTOs at tech startups, 10-200 employees",
  "target_outcome": "Book sales demos",
  "value_for_target": "Access to enterprise analytics at startup pricing",
  "urgency": "Early-adopter pricing ends March 31st",
  "scarcity": "Onboarding limited to 20 companies this quarter",
  "risk_reversal": "14-day free trial, cancel anytime, no commitment",
  "social_proof": "Used by 500+ SaaS companies including Vercel and Linear",
  "budget": {
    "max_daily_usd": 10
  }
}`}</code>
        </pre>

        <h3>get_campaign_results</h3>
        <p>Get results for a campaign.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaign_id": "camp_abc123"
}`}</code>
        </pre>
        <p>Returns:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "status": "running",
  "stats": {
    "emails_sent": 247,
    "delivered": 231,
    "opened": 54,
    "replied": 12,
    "meetings_booked": 3
  },
  "costs": {
    "total_byok_usd": 4.23,
    "budget_remaining_usd": 5.77
  },
  "dashboard_url": "https://dashboard.distribute.you/campaigns/camp_abc123"
}`}</code>
        </pre>

        <h3>pause_campaign / resume_campaign</h3>
        <p>Control campaign execution.</p>

        <h3>get_stats</h3>
        <p>Get your usage and community benchmarks.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "your_usage": {
    "emails_this_month": 247,
    "estimated_byok_cost": "$4.23"
  },
  "community_benchmarks": {
    "delivery_rate": "94.2%",
    "open_rate": "23.1%",
    "reply_rate": "4.8%",
    "avg_cost_per_email": "$0.017"
  }
}`}</code>
        </pre>

        <h2>Pricing</h2>
        <p>
          <strong>Free</strong> — {DOCS_PRICING.free.detail}. {DOCS_PRICING.free.emails}.
        </p>
        <p>
          <strong>Estimated API cost:</strong> {BYOK_COST_ESTIMATES.totalPerEmail} (OpenAI + Apollo + Resend)
        </p>
      </div>
    </div>
  );
}
