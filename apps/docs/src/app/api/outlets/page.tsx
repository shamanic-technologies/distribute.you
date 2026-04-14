import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outlets API",
  description: "List media outlets discovered for your brand via the distribute API.",
};

export default function OutletsApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Outlets</h1>
      <p className="text-xl text-gray-500 mb-10">
        Media outlets discovered for your brand.
      </p>

      <div className="prose prose-lg">
        <h2>List Brand Outlets</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/outlets?brandId=brand_abc123
GET /v1/outlets?brandId=brand_abc123&featureDynastySlug=journalists-email-cold-outreach
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
