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
      url: `${baseUrl}/benchmarks`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/investors`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    // Per-outcome price detail pages (src/app/outcomes/[outcome]/page.tsx).
    ...["website-visits", "positive-replies", "signups"].map(
      (slug) => ({
        url: `${baseUrl}/outcomes/${slug}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      }),
    ),
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
  const STATIC_SEO_PATHS: { path: string; priority: number }[] = [
    { path: "/pro", priority: 0.8 },
    { path: "/brand", priority: 0.5 },
    { path: "/how-it-works", priority: 0.8 },
    { path: "/use-cases", priority: 0.8 },
    { path: "/privacy", priority: 0.3 },
    // NOTE: /performance/brands + /performance/models are 308-redirected to
    // /performance (next.config.ts). Redirecting URLs must NOT be in the sitemap
    // (Ahrefs "3XX redirect in sitemap") — only the canonical /performance (above).
    // Cold-email SEO cluster (3 pillars + 12 supporting pages)
    { path: "/cold-email-cost-guide", priority: 0.7 },
    { path: "/cold-email-cost-guide/cold-email-cost-per-contact", priority: 0.6 },
    { path: "/cold-email-cost-guide/cold-email-roi", priority: 0.6 },
    { path: "/cold-email-cost-guide/cold-email-setup-cost", priority: 0.6 },
    { path: "/cold-email-cost-guide/linkedin-inmail-cost-vs-cold-email", priority: 0.6 },
    { path: "/cold-email-vs-linkedin", priority: 0.7 },
    { path: "/cold-email-vs-linkedin/b2b-outbound-channel-comparison", priority: 0.6 },
    { path: "/cold-email-vs-linkedin/cold-email-vs-linkedin-ads", priority: 0.6 },
    { path: "/cold-email-vs-linkedin/linkedin-connection-request-vs-cold-email", priority: 0.6 },
    { path: "/cold-email-vs-linkedin/multichannel-outreach-strategy", priority: 0.6 },
    { path: "/cold-email-for-saas-founders", priority: 0.7 },
    { path: "/cold-email-for-saas-founders/ai-cold-email-saas-founders", priority: 0.6 },
    { path: "/cold-email-for-saas-founders/b2b-cold-email-reply-rate", priority: 0.6 },
    { path: "/cold-email-for-saas-founders/cold-email-personalization-at-scale", priority: 0.6 },
    { path: "/cold-email-for-saas-founders/cold-email-subject-lines-saas", priority: 0.6 },
  ];

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
