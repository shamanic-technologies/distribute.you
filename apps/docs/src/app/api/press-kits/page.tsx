import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Press Kits API",
  description: "Generate, list, and manage AI-powered press kits via the distribute API.",
};

const LLM_INSTRUCTIONS = `# Press Kits API

## List Press Kits
GET /v1/press-kits/media-kits
GET /v1/press-kits/media-kits?brand_id=brand_abc123

## Get Press Kit
GET /v1/press-kits/media-kits/:id

## Generate Press Kit
POST /v1/press-kits/media-kits
Headers: x-brand-id: brand_abc123
{ "instruction": "Create a press kit highlighting our Series A funding" }

## View Stats
GET /v1/press-kits/media-kits/stats/views?brandId=brand_abc123
GET /v1/press-kits/media-kits/stats/views?mediaKitId=mk_abc&groupBy=country

## TypeScript Client
const { mediaKits } = await client.listPressKits({ brandId: "brand_abc" });
const { mediaKitId } = await client.generatePressKit("Create a press kit", { brandId: "brand_abc" });
const stats = await client.getPressKitViewStats({ brandId: "brand_abc" });`;

export default function PressKitsApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Press Kits</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Generate and manage AI-powered press kits.
      </p>

      <div className="prose">
        <h2>List Press Kits</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/press-kits/media-kits
GET /v1/press-kits/media-kits?brand_id=brand_abc123
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>

        <h2>Get Press Kit</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/press-kits/media-kits/:id
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns the full press kit including MDX page content, status, and metadata.</p>

        <h2>Generate Press Kit</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/press-kits/media-kits
Content-Type: application/json
X-API-Key: dist_YOUR_KEY
x-brand-id: brand_abc123

{
  "instruction": "Create a press kit highlighting our Series A funding and new product launch"
}`}</code>
        </pre>
        <p>
          Generates a new press kit using AI. The <code>x-brand-id</code> and optionally
          <code>x-campaign-id</code> headers associate it with a brand and campaign.
        </p>

        <h2>View Stats</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/press-kits/media-kits/stats/views?brandId=brand_abc123
GET /v1/press-kits/media-kits/stats/views?mediaKitId=mk_abc&groupBy=country
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns total views, unique visitors, and optional grouping by country, media kit, or day.</p>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { mediaKits } = await client.listPressKits({ brandId: "brand_abc" });
const kit = await client.getPressKit("mk_abc");
const { mediaKitId } = await client.generatePressKit(
  "Create a press kit for our Series A",
  { brandId: "brand_abc" }
);
const stats = await client.getPressKitViewStats({ brandId: "brand_abc" });`}</code>
        </pre>
      </div>
    </div>
  );
}
