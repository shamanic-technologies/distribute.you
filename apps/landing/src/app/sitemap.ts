import { MetadataRoute } from "next";
import { PROD_URLS } from "@/lib/env-urls";
import { listArticles } from "@/lib/blog/db";
import { comparePaths } from "@/lib/competitors";

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
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Statically-served pages (src/app/<page>/route.ts → staticResponse) that were
  // missing from the sitemap — all live + indexable. Keep in lockstep with the
  // public/landing/**.html set when adding/removing a static page.
  // Every other indexable page. Keep in lockstep with the routes under src/app: a page
  // added there and not here is live and absent from the sitemap.
  const STATIC_SEO_PATHS: { path: string; priority: number }[] = [
    { path: "/developers", priority: 0.7 },
    { path: "/brand", priority: 0.5 },
    { path: "/about", priority: 0.6 },
    { path: "/contact", priority: 0.5 },
    { path: "/privacy", priority: 0.3 },
  ];

  // The comparison cluster is rendered from the competitor catalogue, so its paths are
  // read from it rather than listed here: a competitor added there is in the sitemap
  // without a second edit. The hub and /alternatives rank above the per-competitor pages.
  for (const path of comparePaths()) {
    STATIC_SEO_PATHS.push({ path, priority: path.split("/").length > 2 ? 0.7 : 0.8 });
  }

  staticEntries.push(
    ...STATIC_SEO_PATHS.map((e) => ({
      url: `${baseUrl}${e.path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: e.priority,
    })),
  );

  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${baseUrl}/blog/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...articleEntries];
}
