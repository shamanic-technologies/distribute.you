import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Articles API",
  description: "List articles mentioning your brand discovered via distribute campaigns.",
};

export default function ArticlesApiPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-5xl font-bold text-gray-900 mb-4">Articles</h1>
      <p className="text-xl text-gray-500 mb-10">
        Articles discovered that mention your brand.
      </p>

      <div className="prose prose-lg">
        <h2>List Articles</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
          <code>{`GET /v1/discoveries?brandId=brand_abc123
GET /v1/discoveries?campaignId=camp_abc123
GET /v1/discoveries?featureDynastySlug=journalists-email-cold-outreach
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
