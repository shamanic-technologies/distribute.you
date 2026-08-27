import { docsMetadata } from "@/lib/docs-metadata";
import { docsHeading } from "@/lib/docs-routes";
import Link from "next/link";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS } from "@distribute/content";
import {
  AUTH_HEADER_LINE,
  CLI_INSTALL_COMMAND,
  CLI_NPM_URL,
  CLI_PACKAGE,
  DEVELOPER_HUB_URL,
  curlExample,
} from "@/lib/developer-surfaces";

export const metadata = docsMetadata("/api");

const LLM_INSTRUCTIONS = `# distribute.you REST API

## Base URL
https://api.distribute.you/v1

## Authentication
All requests carry one header:
${AUTH_HEADER_LINE}

## Command line
npx @distribute.you/cli --help
The command distribute ops lists every operation this API has, read from the API itself.

## Endpoint Groups
- /me, /api-keys: Identity
- /brands: Brand management
- /features: Automation features and stats
- /campaigns: Campaign CRUD and stats
- /workflows: Workflow inspection
- /leads: Lead listing
- /emails: Email listing
- /billing: Balance and transactions
- /runs/stats: Cost analytics
- /email-gateway: Delivery stats`;

const API_SECTIONS = [
  { name: "Brands", href: "/api/brands", description: "Create brands from URLs, extract structured data with AI" },
  { name: "Features", href: "/api/features", description: "Browse automation types, stats, and prefill inputs" },
  { name: "Campaigns", href: "/api/campaigns", description: "Create, stop, and monitor campaigns" },
  { name: "Workflows", href: "/api/workflows", description: "Inspect workflows, DAGs, and key status" },
  { name: "Leads", href: "/api/leads", description: "List discovered leads and their outreach status" },
  { name: "Emails", href: "/api/emails", description: "View generated emails and sequences" },
  { name: "Billing", href: "/api/billing", description: "Balance, account settings, transactions" },
  { name: "Costs", href: "/api/costs", description: "Cost breakdown and delivery statistics" },
  { name: "Webhooks", href: "/api/webhooks", description: "Real-time event notifications" },
];

export default function ApiOverviewPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">{docsHeading("/api")}</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-4">
        Direct REST API access to distribute.you. The machine-readable contract
        for everything on this page is the{" "}
        <a href="/openapi/" className="underline">OpenAPI document</a>.
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

      <div className="prose">
        <h2>Base URL</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
          <code>https://api.distribute.you/v1</code>
        </pre>

        <h2>Authentication</h2>
        <p>All requests require your API key in the <code>Authorization</code> header:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{curlExample("/v1/me")}</code>
        </pre>

        <h2>From a shell</h2>
        <p>
          The CLI is the shortest path from a terminal or a CI job. It authenticates once with an
          API key, prints JSON on stdout, prints JSON on stderr when it fails, and exits non-zero,
          so it can be driven without parsing prose.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{CLI_INSTALL_COMMAND}</code>
        </pre>
        <p>
          <code>distribute ops</code> lists every operation this API has, read from the API itself
          rather than from a list that can go stale. The package is on npm as{" "}
          <a href={CLI_NPM_URL}>{CLI_PACKAGE}</a>.
        </p>

        <h2>Errors</h2>
        <table>
          <thead>
            <tr><th>Code</th><th>Meaning</th></tr>
          </thead>
          <tbody>
            <tr><td><code>400</code></td><td>Bad request: invalid parameters</td></tr>
            <tr><td><code>401</code></td><td>Unauthorized: invalid or missing API key</td></tr>
            <tr><td><code>404</code></td><td>Resource not found</td></tr>
            <tr><td><code>429</code></td><td>Rate limit exceeded</td></tr>
            <tr><td><code>500</code></td><td>Internal server error</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mt-10 mb-4">Endpoints</h2>
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

      <p className="text-sm text-gray-500 mt-10">
        Every developer surface distribute.you publishes, this API included, is named together at{" "}
        <a href={DEVELOPER_HUB_URL} className="underline">{DEVELOPER_HUB_URL}</a>.
      </p>
    </div>
  );
}
