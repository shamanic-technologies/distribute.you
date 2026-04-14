import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Costs API",
  description: "Cost breakdown and email delivery statistics via the distribute API.",
};

export default function CostsApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Costs</h1>
      <p className="text-xl text-gray-500 mb-10">
        Cost breakdown and delivery statistics.
      </p>

      <div className="prose prose-lg">
        <h2>Cost Breakdown</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/runs/stats/costs?groupBy=costName
GET /v1/runs/stats/costs?groupBy=costName&brandId=brand_abc123
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>
          Returns costs grouped by the specified dimension. Common groupBy values:
          <code>costName</code>, <code>brandId</code>, <code>featureDynastySlug</code>.
        </p>

        <h2>Delivery Stats</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/email-gateway/stats?brandId=brand_abc123
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "emailsContacted": 500,
  "emailsSent": 480,
  "emailsDelivered": 460,
  "emailsOpened": 120,
  "emailsClicked": 25,
  "emailsReplied": 22,
  "emailsBounced": 20,
  "repliesInterested": 8,
  "repliesMeetingBooked": 3,
  "repliesClosed": 1,
  "repliesNeutral": 5,
  "repliesNotInterested": 3,
  "repliesOutOfOffice": 2,
  "repliesUnsubscribe": 0
}`}</code>
        </pre>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { groups } = await client.getCostBreakdown({
  groupBy: "costName",
  brandId: "brand_abc123",
});
const deliveryStats = await client.getBrandDeliveryStats("brand_abc123");`}</code>
        </pre>
      </div>
    </div>
  );
}
