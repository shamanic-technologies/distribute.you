import { Metadata } from "next";
import { CopyForLLM } from "@/components/copy-for-llm";

export const metadata: Metadata = {
  title: "Articles API",
  description: "List articles mentioning your brand discovered via distribute campaigns.",
};

const LLM_INSTRUCTIONS = `# Articles API

## List Articles
GET /v1/discoveries?brandId=brand_abc123
GET /v1/discoveries?campaignId=camp_abc123
GET /v1/discoveries?featureSlug=journalists-email-cold-outreach
Returns: URLs, titles, descriptions, authors, publication dates, discovery metadata

## TypeScript Client
const { discoveries } = await client.listArticles({ brandId: "brand_abc123" });`;

export default function ArticlesApiPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-semibold text-gray-900">Articles</h1>
        <CopyForLLM content={LLM_INSTRUCTIONS} />
      </div>
      <p className="text-base text-gray-500 mb-8">
        Articles discovered that mention your brand.
      </p>

      <div className="prose">
        <h2>List Articles</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/discoveries?brandId=brand_abc123
GET /v1/discoveries?campaignId=camp_abc123
GET /v1/discoveries?featureSlug=journalists-email-cold-outreach
X-API-Key: dist_YOUR_KEY`}</code>
        </pre>
        <p>
          Returns articles with URLs, titles, descriptions, authors, publication dates,
          and discovery metadata (which campaign/outlet/journalist led to it).
        </p>

        <h2>TypeScript Client</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`const { discoveries } = await client.listArticles({ brandId: "brand_abc123" });`}</code>
        </pre>
      </div>
    </div>
  );
}
