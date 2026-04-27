import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Costs API",
  description: "Cost breakdown and email delivery statistics via the distribute API.",
};

const LLM_INSTRUCTIONS = `# Costs API

## Cost Breakdown
GET /v1/runs/stats/costs?groupBy=costName
GET /v1/runs/stats/costs?groupBy=costName&brandId=brand_abc123
groupBy values: costName, brandId, featureSlug

## Delivery Stats
GET /v1/email-gateway/stats?brandId=brand_abc123
Returns: emailsContacted, emailsSent, emailsDelivered, emailsOpened, emailsClicked, emailsReplied, emailsBounced, reply classifications

## TypeScript Client
const { groups } = await client.getCostBreakdown({ groupBy: "costName", brandId: "brand_abc123" });
const deliveryStats = await client.getBrandDeliveryStats("brand_abc123");`;

export default function CostsApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Costs</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Cost breakdown and delivery statistics.
      </p>

      <div className="prose">
        <h2>Cost Breakdown</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/runs/stats/costs?groupBy=costName
GET /v1/runs/stats/costs?groupBy=costName&brandId=brand_abc123
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>
          Returns costs grouped by the specified dimension. Common groupBy values:
          <code>costName</code>, <code>brandId</code>, <code>featureSlug</code>.
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
