import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Brands API",
  description: "Create brands from URLs, get brand details, and extract structured data with AI via the distribute API.",
};

const LLM_INSTRUCTIONS = `# Brands API

## List Brands
GET /v1/brands
X-API-Key: dist_YOUR_KEY

## Get Brand
GET /v1/brands/:brandId
X-API-Key: dist_YOUR_KEY

## Create Brand
POST /v1/brands
{ "url": "https://acme.com" }

## Extract Fields
POST /v1/brands/extract-fields
{ "brandIds": ["brand_abc"], "fields": [{ "key": "industry", "description": "Primary industry" }] }
Results cached 30 days.

## List Extracted Fields
GET /v1/brands/:brandId/extracted-fields

## TypeScript Client
const { brands } = await client.listBrands();
const result = await client.createBrand("https://acme.com");
const fields = await client.extractBrandFields(["brand_abc"], [{ key: "industry", description: "Primary industry" }]);`;

export default function BrandsApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Brands</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Create brands from URLs and extract structured data with AI.
      </p>

      <div className="prose">
        <h2>List Brands</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/brands
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns all brands in your organization.</p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "brands": [
    {
      "id": "brand_abc123",
      "domain": "acme.com",
      "name": "Acme Inc",
      "brandUrl": "https://acme.com",
      "logoUrl": "https://...",
      "elevatorPitch": "Enterprise analytics for startups",
      "createdAt": "2026-04-01T00:00:00Z"
    }
  ]
}`}</code>
        </pre>

        <h2>Get Brand</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/brands/:brandId
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns detailed brand info including bio, mission, location, and categories.</p>

        <h2>Create Brand</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/brands
Content-Type: application/json
X-API-Key: dist_YOUR_KEY

{
  "url": "https://acme.com"
}`}</code>
        </pre>
        <p>
          Creates a new brand by scraping and analyzing the provided URL.
          If a brand already exists for this domain, returns the existing brand.
        </p>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`{
  "brandId": "brand_abc123",
  "domain": "acme.com",
  "name": "Acme Inc",
  "created": true
}`}</code>
        </pre>

        <h2>Extract Fields</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`POST /v1/brands/extract-fields
Content-Type: application/json
X-API-Key: dist_YOUR_KEY

{
  "brandIds": ["brand_abc123"],
  "fields": [
    { "key": "industry", "description": "The brand's primary industry" },
    { "key": "target_audience", "description": "Who their product is for" }
  ]
}`}</code>
        </pre>
        <p>
          Extracts structured data from brands using AI. Results are cached for 30 days —
          repeated calls with the same fields are near-instant.
        </p>

        <h2>List Extracted Fields</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/brands/:brandId/extracted-fields
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>Returns all previously extracted fields for a brand with their cached values.</p>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { brands } = await client.listBrands();
const { brand } = await client.getBrand("brand_abc123");
const result = await client.createBrand("https://acme.com");
const fields = await client.extractBrandFields(
  ["brand_abc123"],
  [{ key: "industry", description: "Primary industry" }]
);`}</code>
        </pre>
      </div>
    </div>
  );
}
