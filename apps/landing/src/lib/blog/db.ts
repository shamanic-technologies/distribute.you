import { neon } from "@neondatabase/serverless";

export interface BlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  coverImageUrl: string | null;
  tags: string[];
  source: string;
  sourceId: string | null;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface RawBlogArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html: string | null;
  content_markdown: string | null;
  cover_image_url: string | null;
  tags: string[];
  source: string;
  source_id: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("[landing/blog] DATABASE_URL is not configured");
  }
  return neon(url);
}

function mapRow(row: RawBlogArticle): BlogArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentHtml: row.content_html,
    contentMarkdown: row.content_markdown,
    coverImageUrl: row.cover_image_url,
    tags: row.tags,
    source: row.source,
    sourceId: row.source_id,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpsertArticleInput {
  slug: string;
  title: string;
  excerpt?: string | null;
  contentHtml?: string | null;
  contentMarkdown?: string | null;
  coverImageUrl?: string | null;
  tags?: string[];
  source?: string;
  sourceId?: string | null;
  publishedAt?: string | null;
}

export async function upsertArticle(input: UpsertArticleInput): Promise<BlogArticle> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO blog_articles (
      slug, title, excerpt, content_html, content_markdown,
      cover_image_url, tags, source, source_id, published_at, updated_at
    )
    VALUES (
      ${input.slug},
      ${input.title},
      ${input.excerpt ?? null},
      ${input.contentHtml ?? null},
      ${input.contentMarkdown ?? null},
      ${input.coverImageUrl ?? null},
      ${input.tags ?? []},
      ${input.source ?? "outrank"},
      ${input.sourceId ?? null},
      ${input.publishedAt ?? new Date().toISOString()},
      now()
    )
    ON CONFLICT (slug) DO UPDATE SET
      title             = EXCLUDED.title,
      excerpt           = EXCLUDED.excerpt,
      content_html      = EXCLUDED.content_html,
      content_markdown  = EXCLUDED.content_markdown,
      cover_image_url   = EXCLUDED.cover_image_url,
      tags              = EXCLUDED.tags,
      source            = EXCLUDED.source,
      source_id         = EXCLUDED.source_id,
      published_at      = EXCLUDED.published_at,
      updated_at        = now()
    RETURNING *
  `) as RawBlogArticle[];
  if (rows.length === 0) {
    throw new Error("[landing/blog] upsertArticle returned no rows");
  }
  return mapRow(rows[0]);
}

export async function listArticles(limit = 50): Promise<BlogArticle[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM blog_articles
    ORDER BY published_at DESC
    LIMIT ${limit}
  `) as RawBlogArticle[];
  return rows.map(mapRow);
}

export async function getArticleBySlug(slug: string): Promise<BlogArticle | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM blog_articles
    WHERE slug = ${slug}
    LIMIT 1
  `) as RawBlogArticle[];
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}
