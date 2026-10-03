import { NextResponse } from "next/server";
import { getArticleBySlug } from "@/lib/blog/db";
import { isPreviewArticle } from "@/lib/blog/preview";
import { articleText } from "@/lib/blog/plain-text";

/**
 * GET /api/public/blog/articles/<slug>: one PUBLISHED article's full text (markdown when the
 * row has it, else its HTML as plain text). Public content, same as /blog/<slug>; a preview
 * article is a 404 here like everywhere public.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!process.env.DATABASE_URL) {
    console.error("[landing/blog-api] DATABASE_URL is not configured");
    return NextResponse.json({ error: "blog database not configured" }, { status: 500 });
  }
  try {
    const a = isPreviewArticle(slug) ? null : await getArticleBySlug(slug);
    if (!a) return NextResponse.json({ error: `no published article ${slug}` }, { status: 404 });
    const text = articleText(a);
    if (text === "") {
      console.error(`[landing/blog-api] article ${slug} has no content`);
      return NextResponse.json({ error: `article ${slug} has no content` }, { status: 500 });
    }
    return NextResponse.json({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      publishedAt: new Date(a.publishedAt).toISOString(),
      url: `https://distribute.you/blog/${a.slug}`,
      text,
    });
  } catch (err) {
    console.error(`[landing/blog-api] read ${slug} failed:`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
