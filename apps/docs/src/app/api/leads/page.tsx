import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Leads API",
  description: "List leads discovered for campaigns and brands via the distribute API.",
};

const LLM_INSTRUCTIONS = `# Leads API

## List Leads
GET /v1/leads?campaignId=camp_abc123
GET /v1/leads?brandId=brand_abc123
Returns: firstName, lastName, email, title, organizationName, organizationDomain, status, contacted, delivered, bounced, replied

## TypeScript Client
const { leads } = await client.listLeads({ campaignId: "camp_abc123" });
const { leads: brandLeads } = await client.listLeads({ brandId: "brand_abc" });`;

export default function LeadsApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        List leads discovered for your campaigns and brands.
      </p>

      <div className="prose">
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
