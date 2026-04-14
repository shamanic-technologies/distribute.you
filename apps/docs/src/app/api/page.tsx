import { Metadata } from "next";
import Link from "next/link";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS } from "@distribute/content";

export const metadata: Metadata = {
  title: "API Reference",
  description: "Complete REST API reference for distribute. Manage brands, campaigns, workflows, leads, press kits, billing, and more.",
  openGraph: {
    title: "API Reference | distribute Docs",
    description: "REST API documentation for distribute.",
  },
};

const LLM_INSTRUCTIONS = `# distribute REST API

## Base URL
https://api.distribute.you/v1

## Authentication
All requests require X-API-Key header:
X-API-Key: dist_YOUR_KEY

## TypeScript Client
npm install @distribute/api-client

import { DistributeClient } from "@distribute/api-client";
const client = new DistributeClient({ apiKey: "dist_YOUR_KEY" });

## Endpoint Groups
- /me, /api-keys — Identity
- /brands — Brand management
- /features — Automation features and stats
- /campaigns — Campaign CRUD and stats
- /workflows — Workflow inspection
- /leads — Lead listing
- /emails — Email listing
- /outlets — Media outlet discovery
- /journalists — Journalist discovery
- /discoveries — Article discovery
- /press-kits — Press kit generation
- /billing — Balance and transactions
- /runs/stats — Cost analytics
- /email-gateway — Delivery stats`;

const API_SECTIONS = [
  { name: "Brands", href: "/api/brands", description: "Create brands from URLs, extract structured data with AI" },
  { name: "Features", href: "/api/features", description: "Browse automation types, stats, and prefill inputs" },
  { name: "Campaigns", href: "/api/campaigns", description: "Create, stop, and monitor campaigns" },
  { name: "Workflows", href: "/api/workflows", description: "Inspect workflows, DAGs, and key status" },
  { name: "Leads", href: "/api/leads", description: "List discovered leads and their outreach status" },
  { name: "Emails", href: "/api/emails", description: "View generated emails and sequences" },
  { name: "Outlets", href: "/api/outlets", description: "Media outlets discovered for your brand" },
  { name: "Journalists", href: "/api/journalists", description: "Journalists discovered for PR outreach" },
  { name: "Articles", href: "/api/articles", description: "Articles mentioning your brand" },
  { name: "Press Kits", href: "/api/press-kits", description: "Generate and manage press kits" },
  { name: "Billing", href: "/api/billing", description: "Balance, account settings, transactions" },
  { name: "Costs", href: "/api/costs", description: "Cost breakdown and delivery statistics" },
  { name: "Webhooks", href: "/api/webhooks", description: "Real-time event notifications" },
];

export default function ApiOverviewPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-5xl font-bold text-gray-900">API Reference</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-500 mb-4">
        Direct REST API access to distribute.
      </p>

      <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mb-10 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-brand-800">Interactive API Reference</p>
          <p className="text-sm text-brand-600">Try endpoints directly in the browser with our Scalar-powered docs.</p>
        </div>
        <a
          href={URLS.apiDocs}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition whitespace-nowrap"
        >
          Open API Docs
        </a>
      </div>

      <div className="prose prose-lg">
        <h2>Base URL</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
          <code>https://api.distribute.you/v1</code>
        </pre>

        <h2>Authentication</h2>
        <p>All requests require your API key in the <code>X-API-Key</code> header:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`curl https://api.distribute.you/v1/me \\
  -H "X-API-Key: dist_YOUR_KEY"`}</code>
        </pre>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`npm install @distribute/api-client`}</code>
        </pre>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`import { DistributeClient } from "@distribute/api-client";

const client = new DistributeClient({ apiKey: "dist_YOUR_KEY" });
const { brands } = await client.listBrands();`}</code>
        </pre>

        <h2>Errors</h2>
        <table>
          <thead>
            <tr><th>Code</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td><code>400</code></td><td>Bad request — invalid parameters</td></tr>
            <tr><td><code>401</code></td><td>Unauthorized — invalid or missing API key</td></tr>
            <tr><td><code>404</code></td><td>Resource not found</td></tr>
            <tr><td><code>429</code></td><td>Rate limit exceeded</td></tr>
            <tr><td><code>500</code></td><td>Internal server error</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="font-display text-2xl font-bold text-gray-900 mt-12 mb-6">Endpoints</h2>
      <div className="grid gap-3">
        {API_SECTIONS.map((section) => (
          <Link
            key={section.name}
            href={section.href}
            className="block p-4 border border-gray-200 rounded-lg hover:border-brand-300 hover:shadow-sm transition"
          >
            <h3 className="text-base font-semibold text-gray-900">{section.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
