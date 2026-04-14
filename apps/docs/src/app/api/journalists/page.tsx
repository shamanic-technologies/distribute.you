import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Journalists API",
  description: "List journalists discovered for PR outreach via the distribute API.",
};

const LLM_INSTRUCTIONS = `# Journalists API

## List Brand Journalists
GET /v1/journalists/list?brandId=brand_abc123
GET /v1/journalists/list?brandId=brand_abc123&campaignId=camp_abc

## List Campaign Journalists
GET /v1/campaigns/:campaignId/journalists

## TypeScript Client
const { journalists, total } = await client.listJournalists("brand_abc123");
const { journalists: campJ } = await client.listCampaignJournalists("camp_abc");`;

export default function JournalistsApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Journalists</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Journalists discovered for your PR outreach campaigns.
      </p>

      <div className="prose">
        <h2>List Brand Journalists</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/journalists/list?brandId=brand_abc123
GET /v1/journalists/list?brandId=brand_abc123&campaignId=camp_abc
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>
          Returns enriched journalist data — contact info, outlet, outreach status,
          email delivery status, and campaign associations.
        </p>

        <h2>List Campaign Journalists</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns/:campaignId/journalists
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { journalists, total } = await client.listJournalists("brand_abc123");
const { journalists: campJ } = await client.listCampaignJournalists("camp_abc");`}</code>
        </pre>
      </div>
    </div>
  );
}
