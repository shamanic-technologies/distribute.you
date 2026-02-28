import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campaigns API",
  description: "Create, list, pause, and resume campaigns via the distribute REST API. Full endpoint reference with examples.",
  openGraph: {
    title: "Campaigns API | distribute Docs",
    description: "Campaign management endpoints for distribute.",
  },
};

export default function CampaignsApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="text-4xl font-bold mb-4">Campaigns API</h1>
      <p className="text-xl text-gray-600 mb-8">
        Create, manage, and monitor campaigns via the REST API.
      </p>

      <div className="prose prose-lg">
        <h2>Create Campaign</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/campaigns
Content-Type: application/json
X-API-Key: YOUR_API_KEY

{
  "name": "Q1 Outreach",
  "type": "cold-email-outreach",
  "brandUrl": "https://acme.com",
  "targetAudience": "CTOs at SaaS companies, 50-200 employees",
  "targetOutcome": "Book sales demos",
  "valueForTarget": "Access to enterprise analytics at startup pricing",
  "urgency": "Early-adopter pricing ends March 31st",
  "scarcity": "Onboarding limited to 20 companies this quarter",
  "riskReversal": "14-day free trial, cancel anytime, no commitment",
  "socialProof": "Used by 500+ SaaS companies including Vercel and Linear",
  "maxBudgetDailyUsd": 10,
  "maxBudgetWeeklyUsd": 50
}`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaign": {
    "id": "camp_abc123",
    "name": "Q1 Outreach",
    "type": "cold-email-outreach",
    "brandId": "brand_xyz",
    "status": "ongoing",
    "targetAudience": "CTOs at SaaS companies, 50-200 employees",
    "targetOutcome": "Book sales demos",
    "valueForTarget": "Access to enterprise analytics at startup pricing",
    "urgency": "Early-adopter pricing ends March 31st",
    "scarcity": "Onboarding limited to 20 companies this quarter",
    "riskReversal": "14-day free trial, cancel anytime, no commitment",
    "socialProof": "Used by 500+ SaaS companies including Vercel and Linear"
  }
}`}</code>
        </pre>

        <h2>List Campaigns</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns
GET /v1/campaigns?status=ongoing
GET /v1/campaigns?status=stopped`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaigns": [
    {
      "id": "camp_abc123",
      "name": "Q1 Outreach",
      "status": "ongoing",
      "targetAudience": "CTOs at SaaS companies",
      "targetOutcome": "Book sales demos",
      "valueForTarget": "Access to enterprise analytics at startup pricing",
      "urgency": "Early-adopter pricing ends March 31st",
      "scarcity": "Onboarding limited to 20 companies this quarter",
      "riskReversal": "14-day free trial, cancel anytime",
      "socialProof": "Used by 500+ SaaS companies",
      "maxBudgetDailyUsd": "10"
    }
  ]
}`}</code>
        </pre>

        <h2>Get Campaign</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns/:id`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaign": {
    "id": "camp_abc123",
    "name": "Q1 Outreach",
    "status": "ongoing",
    "targetAudience": "CTOs at SaaS companies",
    "targetOutcome": "Book sales demos",
    "valueForTarget": "Access to enterprise analytics at startup pricing",
    "urgency": "Early-adopter pricing ends March 31st",
    "scarcity": "Onboarding limited to 20 companies this quarter",
    "riskReversal": "14-day free trial, cancel anytime",
    "socialProof": "Used by 500+ SaaS companies",
    "maxBudgetDailyUsd": "10",
    "createdAt": "2026-01-30T10:00:00Z"
  }
}`}</code>
        </pre>

        <h2>Stop Campaign</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/campaigns/:id/stop`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaign": {
    "id": "camp_abc123",
    "status": "stopped"
  }
}`}</code>
        </pre>

        <h2>Resume Campaign</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/campaigns/:id/resume`}</code>
        </pre>

        <h3>Response</h3>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "campaign": {
    "id": "camp_abc123",
    "status": "ongoing"
  }
}`}</code>
        </pre>

        <h2>Campaign Statuses</h2>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>ongoing</code></td>
              <td>Campaign is active and running</td>
            </tr>
            <tr>
              <td><code>stopped</code></td>
              <td>Campaign has been stopped</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
