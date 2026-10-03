import { NextResponse } from "next/server";
import { listArticles } from "@/lib/blog/db";

/**
 * GET /api/public/blog/articles: every PUBLISHED blog article as a menu line (slug, title,
 * excerpt, published date). The same public content /blog lists; preview articles are
 * excluded by `listArticles`. Read by social-service, which offers Kevin's comment writer
 * our articles to read before it comments (owner 2026-10-03).
 *
 * Runtime read: a missing DATABASE_URL is a 500 here, never an empty menu that reads as
 * "we have published nothing".
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    console.error("[landing/blog-api] DATABASE_URL is not configured");
    return NextResponse.json({ error: "blog database not configured" }, { status: 500 });
  }
  try {
    const articles = await listArticles(500);
    return NextResponse.json({
      articles: articles.map((a) => ({
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        publishedAt: new Date(a.publishedAt).toISOString(),
        url: `https://distribute.you/blog/${a.slug}`,
      })),
    });
  } catch (err) {
    console.error("[landing/blog-api] list failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
