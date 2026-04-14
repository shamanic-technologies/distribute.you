import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Emails API",
  description: "View generated emails and sequences for campaigns via the distribute API.",
};

export default function EmailsApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Emails</h1>
      <p className="text-xl text-gray-500 mb-10">
        View generated emails and multi-step sequences.
      </p>

      <div className="prose prose-lg">
        <h2>List Campaign Emails</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns/:campaignId/emails
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns all generated emails for a campaign with subject, body, and recipient details.</p>

        <h2>List Brand Emails</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/emails?brandId=brand_abc123
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns all emails across campaigns for a brand.</p>

        <h2>Response</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "emails": [
    {
      "id": "email_abc",
      "subject": "Quick question about your analytics stack",
      "bodyHtml": "<p>Hi Jane, ...</p>",
      "bodyText": "Hi Jane, ...",
      "sequence": [
        { "step": 1, "bodyHtml": "...", "bodyText": "...", "daysSinceLastStep": 0 },
        { "step": 2, "bodyHtml": "...", "bodyText": "...", "daysSinceLastStep": 3 }
      ],
      "leadFirstName": "Jane",
      "leadLastName": "Doe",
      "leadTitle": "CTO",
      "leadCompany": "Company Inc",
      "leadIndustry": "Software",
      "clientCompanyName": "Acme Inc",
      "createdAt": "2026-04-01T00:00:00Z"
    }
  ]
}`}</code>
        </pre>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { emails } = await client.listCampaignEmails("camp_abc123");
const { emails: brandEmails } = await client.listBrandEmails("brand_abc");`}</code>
        </pre>
      </div>
    </div>
  );
}
