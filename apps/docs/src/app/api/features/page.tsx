import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Features API",
  description: "List automation features, get performance stats, and prefill inputs via the distribute API.",
};

const LLM_INSTRUCTIONS = `# Features API

## List Features
GET /v1/features
GET /v1/features?implemented=true

## Get Feature
GET /v1/features/:slug

## Prefill Inputs
POST /v1/features/:featureSlug/prefill?format=text
{ "brandIds": ["brand_abc123"] }

## Feature Stats
GET /v1/features/:featureSlug/stats
GET /v1/features/:featureSlug/stats?groupBy=brand

## Global Stats
GET /v1/features/stats
GET /v1/features/stats?groupBy=feature

## Stats Registry
GET /v1/features/stats/registry

## TypeScript Client
const { features } = await client.listFeatures({ implemented: true });
const prefilled = await client.prefillFeatureInputs("sales-email-cold-outreach", ["brand_abc"]);
const stats = await client.getFeatureStats("sales-email-cold-outreach", { groupBy: "brand" });`;

export default function FeaturesApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Features</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Browse automation types, get performance stats, and prefill campaign inputs.
      </p>

      <div className="prose">
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
          <code>{`POST /v1/features/:featureSlug/prefill?format=text
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
          <code>{`GET /v1/features/:featureSlug/stats
GET /v1/features/:featureSlug/stats?groupBy=brand
GET /v1/features/:featureSlug/stats?groupBy=campaign&brandId=brand_abc123
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
