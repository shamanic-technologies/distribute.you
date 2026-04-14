import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Campaigns API",
  description: "Create, stop, and monitor campaigns via the distribute REST API.",
};

const LLM_INSTRUCTIONS = `# Campaigns API

## List Campaigns
GET /v1/campaigns
GET /v1/campaigns?brandId=brand_abc123&status=all

## Get Campaign
GET /v1/campaigns/:campaignId

## Create Campaign
POST /v1/campaigns
Required: name, workflowSlug, brandUrls
Optional: featureInputs, maxBudgetDailyUsd, maxBudgetWeeklyUsd, maxBudgetMonthlyUsd, maxBudgetTotalUsd

## Stop Campaign
POST /v1/campaigns/:campaignId/stop

## Campaign Stats
GET /v1/campaigns/:campaignId/stats

## Batch Campaign Stats
GET /v1/campaigns/stats
GET /v1/campaigns/stats?brandId=brand_abc123

## TypeScript Client
const { campaigns } = await client.listCampaigns({ brandId: "brand_abc" });
const { campaign } = await client.createCampaign({ name: "Q2", workflowSlug: "...", brandUrls: ["https://acme.com"] });
const stats = await client.getCampaignStats("camp_abc123");
await client.stopCampaign("camp_abc123");`;

export default function CampaignsApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Create, stop, and monitor distribution campaigns.
      </p>

      <div className="prose">
        <h2>List Campaigns</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns
GET /v1/campaigns?brandId=brand_abc123&status=all
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>

        <h2>Get Campaign</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns/:campaignId
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>

        <h2>Create Campaign</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/campaigns
Content-Type: application/json
X-API-Key: dist_YOUR_KEY

{
  "name": "Q2 Sales Outreach",
  "workflowSlug": "sales-email-cold-outreach-apex-v4",
  "brandUrls": ["https://acme.com"],
  "featureInputs": {
    "target_audience": "CTOs at SaaS startups, 10-200 employees",
    "target_outcome": "Book sales demos",
    "value_for_target": "Enterprise analytics at startup pricing"
  },
  "maxBudgetDailyUsd": "10"
}`}</code>
        </pre>
        <p>The campaign starts running immediately after creation.</p>
        <h3>Required Fields</h3>
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>name</code></td><td>string</td><td>Campaign name</td></tr>
            <tr><td><code>workflowSlug</code></td><td>string</td><td>Workflow to execute</td></tr>
            <tr><td><code>brandUrls</code></td><td>string[]</td><td>Brand URLs (one or more)</td></tr>
          </tbody>
        </table>
        <h3>Optional Fields</h3>
        <table>
          <thead>
            <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>featureInputs</code></td><td>object</td><td>Key-value inputs for the feature</td></tr>
            <tr><td><code>maxBudgetDailyUsd</code></td><td>string</td><td>Daily budget cap in USD</td></tr>
            <tr><td><code>maxBudgetWeeklyUsd</code></td><td>string</td><td>Weekly budget cap</td></tr>
            <tr><td><code>maxBudgetMonthlyUsd</code></td><td>string</td><td>Monthly budget cap</td></tr>
            <tr><td><code>maxBudgetTotalUsd</code></td><td>string</td><td>Total lifetime budget cap</td></tr>
          </tbody>
        </table>

        <h2>Stop Campaign</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/campaigns/:campaignId/stop
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>

        <h2>Campaign Stats</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns/:campaignId/stats
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaignId": "camp_abc123",
  "totalCostInUsdCents": "423",
  "leadsServed": 150,
  "emailsSent": 247,
  "emailsDelivered": 231,
  "emailsOpened": 54,
  "emailsReplied": 12,
  "repliesInterested": 5,
  "repliesMeetingBooked": 3,
  "costBreakdown": [
    { "costName": "llm-email-generation", "totalCostInUsdCents": "200" },
    { "costName": "apollo-enrichment", "totalCostInUsdCents": "150" }
  ]
}`}</code>
        </pre>

        <h2>Batch Campaign Stats</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns/stats
GET /v1/campaigns/stats?brandId=brand_abc123
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns stats for all campaigns (or filtered by brand) in a single call.</p>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { campaigns } = await client.listCampaigns({ brandId: "brand_abc" });
const { campaign } = await client.createCampaign({
  name: "Q2 Outreach",
  workflowSlug: "sales-email-cold-outreach-apex-v4",
  brandUrls: ["https://acme.com"],
  maxBudgetDailyUsd: "10",
});
const stats = await client.getCampaignStats("camp_abc123");
await client.stopCampaign("camp_abc123");`}</code>
        </pre>
      </div>
    </div>
  );
}
