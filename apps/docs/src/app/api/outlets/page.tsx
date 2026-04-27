import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Outlets API",
  description: "List media outlets discovered for your brand via the distribute API.",
};

const LLM_INSTRUCTIONS = `# Outlets API

## List Brand Outlets
GET /v1/outlets?brandId=brand_abc123
GET /v1/outlets?brandId=brand_abc123&featureSlug=journalists-email-cold-outreach

## List Campaign Outlets
GET /v1/campaigns/:campaignId/outlets

## TypeScript Client
const { outlets, total } = await client.listBrandOutlets("brand_abc123");
const { outlets: campOutlets } = await client.listCampaignOutlets("camp_abc");`;

export default function OutletsApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Outlets</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Media outlets discovered for your brand.
      </p>

      <div className="prose">
        <h2>List Brand Outlets</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/outlets?brandId=brand_abc123
GET /v1/outlets?brandId=brand_abc123&featureSlug=journalists-email-cold-outreach
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns deduplicated outlets across campaigns with relevance scores and outreach status.</p>

        <h2>List Campaign Outlets</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/campaigns/:campaignId/outlets
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns outlets discovered for a specific campaign.</p>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { outlets, total } = await client.listBrandOutlets("brand_abc123");
const { outlets: campOutlets } = await client.listCampaignOutlets("camp_abc");`}</code>
        </pre>
      </div>
    </div>
  );
}
