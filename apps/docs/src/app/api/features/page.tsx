import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features API",
  description: "List automation features, get performance stats, and prefill inputs via the distribute API.",
};

export default function FeaturesApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Features</h1>
      <p className="text-xl text-gray-500 mb-10">
        Browse automation types, get performance stats, and prefill campaign inputs.
      </p>

      <div className="prose prose-lg">
        <h2>List Features</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/features
GET /v1/features?implemented=true
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>
          Returns all available automation features. Filter with <code>implemented=true</code> to
          see only features with active workflows.
        </p>

        <h2>Get Feature</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/features/:slug
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns full feature details including inputs, outputs, charts, and entities.</p>

        <h2>Prefill Inputs</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/features/:dynastySlug/prefill?format=text
Content-Type: application/json
X-API-Key: dist_YOUR_KEY

{
  "brandIds": ["brand_abc123"]
}`}</code>
        </pre>
        <p>
          Pre-fills a feature&apos;s input fields using brand data. Returns suggested values
          for each input based on the brand&apos;s website analysis.
        </p>

        <h2>Feature Stats</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/features/:dynastySlug/stats
GET /v1/features/:dynastySlug/stats?groupBy=brand
GET /v1/features/:dynastySlug/stats?groupBy=campaign&brandId=brand_abc123
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>
          Returns performance statistics for a feature — total cost, completed runs, active
          campaigns, and custom stats. Use <code>groupBy</code> to break down by brand, campaign,
          or workflow.
        </p>

        <h2>Global Stats</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/features/stats
GET /v1/features/stats?groupBy=feature
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Aggregate performance statistics across all features.</p>

        <h2>Stats Registry</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/features/stats/registry
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>
          Returns the stats key registry — maps stat keys to their type (<code>count</code>,{" "}
          <code>rate</code>, <code>currency</code>) and human-readable label.
        </p>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { features } = await client.listFeatures({ implemented: true });
const { feature } = await client.getFeature("sales-email-cold-outreach");
const prefilled = await client.prefillFeatureInputs("sales-email-cold-outreach", ["brand_abc"]);
const stats = await client.getFeatureStats("sales-email-cold-outreach", { groupBy: "brand" });`}</code>
        </pre>
      </div>
    </div>
  );
}
