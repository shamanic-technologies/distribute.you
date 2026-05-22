import { MetadataRoute } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { listArticles } from "@/lib/blog/db";

// Sitemap is generated at build time. When DATABASE_URL is not configured
// (e.g. CI build runners without a Neon binding) we skip article rows
// instead of crashing the entire build — crawlers will rediscover them
// after the next deploy that has DATABASE_URL set.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = PROD_URLS.landing;

  let articles: { slug: string; updatedAt: string }[] = [];
  if (process.env.DATABASE_URL) {
    // listArticles already catches the "table missing" case (Postgres 42P01)
    // and returns []; any other DB error propagates per fail-loud policy.
    const rows = await listArticles(500);
    articles = rows.map((a) => ({ slug: a.slug, updatedAt: a.updatedAt }));
  }

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/performance`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/performance/brands`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/performance/models`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/performance/prompts`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/investors`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${baseUrl}/blog/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...articleEntries];
}
