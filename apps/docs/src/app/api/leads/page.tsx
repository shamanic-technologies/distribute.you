import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leads API",
  description: "List leads discovered for campaigns and brands via the distribute API.",
};

export default function LeadsApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Leads</h1>
      <p className="text-xl text-gray-500 mb-10">
        List leads discovered for your campaigns and brands.
      </p>

      <div className="prose prose-lg">
        <h2>List Leads</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/leads?campaignId=camp_abc123
GET /v1/leads?brandId=brand_abc123
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Filter by campaign or brand. Returns contact details, company info, and outreach status.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "leads": [
    {
      "id": "lead_abc",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@company.com",
      "title": "CTO",
      "organizationName": "Company Inc",
      "organizationDomain": "company.com",
      "organizationIndustry": "Software",
      "organizationSize": "50-200",
      "linkedinUrl": "https://linkedin.com/in/janedoe",
      "status": "contacted",
      "contacted": true,
      "delivered": true,
      "bounced": false,
      "replied": true,
      "createdAt": "2026-04-01T00:00:00Z"
    }
  ]
}`}</code>
        </pre>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { leads } = await client.listLeads({ campaignId: "camp_abc123" });
const { leads: brandLeads } = await client.listLeads({ brandId: "brand_abc" });`}</code>
        </pre>
      </div>
    </div>
  );
}
