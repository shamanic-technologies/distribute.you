import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "MCP Tools Reference",
  description: "Complete reference for all 35 distribute MCP tools — brands, campaigns, workflows, leads, press kits, billing, and more.",
  openGraph: {
    title: "MCP Tools Reference | distribute Docs",
    description: "All 35 distribute MCP tools documented.",
  },
};

const TOOL_CATEGORIES = [
  {
    name: "Identity",
    tools: [
      { name: "whoami", description: "Check your identity — returns your user ID, org ID, and auth type. Use this to verify your API key is working." },
    ],
  },
  {
    name: "Brands",
    tools: [
      { name: "brands_list", description: "List all brands in your organization." },
      { name: "brands_get", description: "Get detailed information about a specific brand, including bio, mission, location, and categories." },
      { name: "brands_create", description: "Create a new brand by providing its website URL. The platform will automatically scrape and analyze the site." },
      { name: "brands_extract_fields", description: "Extract specific information fields from one or more brands using AI. Results are cached for 30 days. Use this to get structured data like industry, target audience, value proposition, etc." },
    ],
  },
  {
    name: "Features",
    tools: [
      { name: "features_list", description: "List all available automation features (e.g. Sales Cold Email Outreach, Journalist Pitch, Press Kit Generation). Each feature defines a type of campaign you can run." },
      { name: "features_get", description: "Get details of a specific feature, including its required inputs, outputs, charts, and entities." },
      { name: "features_prefill", description: "Pre-fill a feature's input fields using brand data. Returns suggested values for each input based on the brand's website analysis." },
      { name: "features_stats", description: "Get performance statistics for a specific feature — total cost, completed runs, active campaigns, and custom stats. Can be grouped by brand, campaign, or workflow." },
      { name: "features_global_stats", description: "Get aggregate performance statistics across all features. Can be grouped by feature or brand." },
      { name: "features_stats_registry", description: "Get the stats key registry — maps stat keys to their type (count, rate, currency) and human-readable label." },
    ],
  },
  {
    name: "Campaigns",
    tools: [
      { name: "campaigns_list", description: "List campaigns. Optionally filter by brand to see all campaigns for a specific brand." },
      { name: "campaigns_get", description: "Get details of a specific campaign including its status, workflow, brand, feature inputs, and budget settings." },
      { name: "campaigns_create", description: "Create and launch a new campaign. Requires a workflow slug, brand URL(s), and optionally budget limits and feature inputs. The campaign starts running immediately." },
      { name: "campaigns_stop", description: "Stop a running campaign. The campaign can be viewed afterwards but will no longer execute." },
      { name: "campaigns_stats", description: "Get performance statistics for a campaign — leads served, emails sent/delivered/opened/replied, cost breakdown, and reply classifications." },
    ],
  },
  {
    name: "Leads",
    tools: [
      { name: "leads_list", description: "List leads (prospects). Filter by campaign or brand. Returns contact details, company info, and outreach status (contacted, delivered, replied, bounced)." },
    ],
  },
  {
    name: "Emails",
    tools: [
      { name: "emails_list", description: "List generated emails for a campaign. Returns the subject, body (HTML and text), email sequence steps, and recipient details." },
    ],
  },
  {
    name: "Workflows",
    tools: [
      { name: "workflows_list", description: "List available workflows. Optionally filter by feature to see workflows for a specific automation type." },
      { name: "workflows_get", description: "Get full details of a workflow including its DAG (directed acyclic graph), nodes, edges, required providers, and version info." },
      { name: "workflows_summary", description: "Get a human-readable summary of a workflow — what it does, what steps it takes, and what API providers it requires." },
      { name: "workflows_key_status", description: "Check if all required API keys are configured for a workflow. Shows which providers are ready and which are missing." },
    ],
  },
  {
    name: "Outlets",
    tools: [
      { name: "outlets_list", description: "List media outlets discovered for a brand. Shows outlet name, URL, domain, relevance score, outreach status, and associated campaigns." },
      { name: "outlets_by_campaign", description: "List outlets discovered for a specific campaign with their relevance scores and outreach status." },
    ],
  },
  {
    name: "Journalists",
    tools: [
      { name: "journalists_list", description: "List journalists discovered for a brand with enriched data — contact info, outlet, outreach status, email delivery status, and campaign associations." },
      { name: "journalists_by_campaign", description: "List journalists discovered for a specific campaign." },
    ],
  },
  {
    name: "Articles",
    tools: [
      { name: "articles_list", description: "List articles discovered for a campaign or brand. Returns article URLs, titles, descriptions, authors, publication dates, and discovery metadata." },
    ],
  },
  {
    name: "Press Kits",
    tools: [
      { name: "press_kits_list", description: "List press kits (media kits). Optionally filter by brand or campaign." },
      { name: "press_kits_get", description: "Get the full content of a press kit including its MDX page content, status, and metadata." },
      { name: "press_kits_generate", description: "Generate a new press kit using AI. Provide an instruction describing what kind of press kit you want, and optionally associate it with a brand and/or campaign." },
      { name: "press_kits_view_stats", description: "Get view statistics for press kits — total views, unique visitors, and optional grouping by country, media kit, or day." },
    ],
  },
  {
    name: "Billing",
    tools: [
      { name: "billing_balance", description: "Check your current credit balance and whether it's depleted." },
      { name: "billing_account", description: "Get your billing account details — credit balance, auto-reload settings, and payment method status." },
      { name: "billing_transactions", description: "List recent billing transactions — credits, deductions, and reloads with amounts and descriptions." },
    ],
  },
  {
    name: "Costs",
    tools: [
      { name: "costs_brand_breakdown", description: "Get a cost breakdown for a brand — shows costs grouped by cost type (e.g. LLM calls, email sends, lead enrichment)." },
      { name: "costs_by_brand", description: "Get total costs grouped by brand across your entire organization." },
      { name: "costs_delivery_stats", description: "Get email delivery statistics for a brand — emails sent, delivered, opened, clicked, replied, bounced, and reply classifications." },
    ],
  },
];

const LLM_INSTRUCTIONS = TOOL_CATEGORIES.map(
  (cat) => `## ${cat.name}\n${cat.tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}`,
).join("\n\n");

export default function McpToolsPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-5xl font-bold text-gray-900">Tools Reference</h1>
        <CopyForLLM content={`# distribute MCP Tools (35 total)\n\n${LLM_INSTRUCTIONS}`} />
      </div>
      <p className="text-xl text-gray-500 mb-10">
        Complete reference for all 35 distribute MCP tools.
      </p>

      <div className="space-y-12">
        {TOOL_CATEGORIES.map((category) => (
          <section key={category.name}>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">{category.name}</h2>
            <div className="space-y-3">
              {category.tools.map((tool) => (
                <div
                  key={tool.name}
                  className="border border-gray-200 rounded-lg p-4 hover:border-brand-300 transition"
                >
                  <code className="text-brand-700 font-medium text-sm">{tool.name}</code>
                  <p className="text-gray-600 text-sm mt-1">{tool.description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
