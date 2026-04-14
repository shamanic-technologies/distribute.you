import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Journalists API",
  description: "List journalists discovered for PR outreach via the distribute API.",
};

export default function JournalistsApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Journalists</h1>
      <p className="text-xl text-gray-500 mb-10">
        Journalists discovered for your PR outreach campaigns.
      </p>

      <div className="prose prose-lg">
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
