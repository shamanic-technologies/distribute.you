import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";
import { URLS, API_RATE_LIMITS } from "@mcpfactory/content";

export const metadata: Metadata = {
  title: "API Reference",
  description: "Complete REST API reference for MCP Factory. Endpoints for campaigns, leads, company scraping, and more.",
  openGraph: {
    title: "API Reference | MCP Factory Docs",
    description: "REST API documentation for MCP Factory.",
  },
};

const LLM_INSTRUCTIONS = `# MCP Factory REST API Reference

## Base URL
https://api.mcpfactory.org/v1

## Authentication
All requests require X-API-Key header:
curl https://api.mcpfactory.org/v1/me -H "X-API-Key: YOUR_API_KEY"

## Endpoints

### Account
GET /v1/me - Get account info

### Company Scraping  
POST /v1/company/scrape - Scrape company from URL
Body: { "url": "https://acme.com" }

### Lead Search
POST /v1/leads/search - Search leads via Apollo
Body: { "person_titles": ["CEO"], "organization_locations": ["US"] }

POST /v1/leads/enrich - Enrich lead data

### Reply Qualification
POST /v1/qualify - Qualify email reply with AI
Body: { "emailContent": "...", "context": "..." }

### Campaigns
POST /v1/campaigns - Create campaign (provide URL, target audience, outcome, budget)
GET /v1/campaigns - List campaigns
GET /v1/campaigns/:id/stats - Get campaign stats
POST /v1/campaigns/:id/stop - Stop a campaign
POST /v1/campaigns/:id/resume - Resume a stopped campaign

Get API key at: https://dashboard.mcpfactory.org/api-keys`;

export default function ApiOverviewPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-4xl font-bold">API Reference</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-xl text-gray-600 mb-8">
        Direct REST API access to MCP Factory services.
      </p>

      <div className="prose prose-lg">
        <h2>Base URL</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
          <code>https://api.mcpfactory.org/v1</code>
        </pre>

        <h2>Authentication</h2>
        <p>All requests require your API key in the header:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`curl https://api.mcpfactory.org/v1/campaigns \\
  -H "X-API-Key: YOUR_API_KEY"`}</code>
        </pre>
        <p>
          Get your API key at{" "}
          <a href={URLS.apiKeys}>
            {URLS.apiKeys.replace("https://", "")}
          </a>
        </p>

        <h2>Endpoints</h2>

        <h3>Account</h3>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>GET</code></td>
              <td>/me</td>
              <td>Get current user and organization info</td>
            </tr>
          </tbody>
        </table>

        <h3>Company Scraping</h3>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>POST</code></td>
              <td>/company/scrape</td>
              <td>Scrape company info from URL</td>
            </tr>
            <tr>
              <td><code>GET</code></td>
              <td>/company/:id</td>
              <td>Get scraped company by ID</td>
            </tr>
          </tbody>
        </table>

        <h4>Scrape Company</h4>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/company/scrape
Content-Type: application/json

{
  "url": "https://acme.com"
}`}</code>
        </pre>

        <h3>Lead Search</h3>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>POST</code></td>
              <td>/leads/search</td>
              <td>Search leads via Apollo</td>
            </tr>
            <tr>
              <td><code>POST</code></td>
              <td>/leads/enrich</td>
              <td>Enrich a lead with additional info</td>
            </tr>
          </tbody>
        </table>

        <h4>Search Leads</h4>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/leads/search
Content-Type: application/json

{
  "person_titles": ["CEO", "CTO", "Founder"],
  "organization_locations": ["United States"],
  "organization_industries": ["Software"],
  "per_page": 10
}`}</code>
        </pre>

        <h3>Reply Qualification</h3>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>POST</code></td>
              <td>/qualify</td>
              <td>Qualify an email reply with AI</td>
            </tr>
          </tbody>
        </table>

        <h4>Qualify Reply</h4>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/qualify
Content-Type: application/json

{
  "fromEmail": "prospect@company.com",
  "toEmail": "sales@yourbrand.com",
  "subject": "Re: Quick question",
  "bodyText": "Thanks for reaching out! I'd love to learn more..."
}`}</code>
        </pre>

        <h3>Campaigns</h3>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>POST</code></td>
              <td>/campaigns</td>
              <td>Create a new campaign</td>
            </tr>
            <tr>
              <td><code>GET</code></td>
              <td>/campaigns</td>
              <td>List all campaigns</td>
            </tr>
            <tr>
              <td><code>GET</code></td>
              <td>/campaigns/:id</td>
              <td>Get campaign details</td>
            </tr>
            <tr>
              <td><code>GET</code></td>
              <td>/campaigns/:id/stats</td>
              <td>Get campaign statistics</td>
            </tr>
            <tr>
              <td><code>POST</code></td>
              <td>/campaigns/:id/stop</td>
              <td>Stop a campaign</td>
            </tr>
            <tr>
              <td><code>POST</code></td>
              <td>/campaigns/:id/resume</td>
              <td>Resume a stopped campaign</td>
            </tr>
          </tbody>
        </table>

        <h4>Create Campaign</h4>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/campaigns
Content-Type: application/json

{
  "name": "Q1 Outreach",
  "brandUrl": "https://yourbrand.com",
  "targetAudience": "CTOs at SaaS startups with 10-50 employees in the US",
  "targetOutcome": "Book sales demos",
  "valueForTarget": "Access to enterprise analytics at startup pricing",
  "maxBudgetDailyUsd": 10
}`}</code>
        </pre>

        <h2>Rate Limits</h2>
        <p>
          <strong>Rate limit:</strong> {API_RATE_LIMITS.free}
        </p>

        <h2>Errors</h2>
        <p>All errors return a JSON response:</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "error": "Invalid API key"
}`}</code>
        </pre>

        <h3>HTTP Status Codes</h3>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>200</code></td>
              <td>Success</td>
            </tr>
            <tr>
              <td><code>400</code></td>
              <td>Bad request (invalid parameters)</td>
            </tr>
            <tr>
              <td><code>401</code></td>
              <td>Unauthorized (invalid API key)</td>
            </tr>
            <tr>
              <td><code>404</code></td>
              <td>Resource not found</td>
            </tr>
            <tr>
              <td><code>429</code></td>
              <td>Rate limit exceeded</td>
            </tr>
            <tr>
              <td><code>500</code></td>
              <td>Internal server error</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
