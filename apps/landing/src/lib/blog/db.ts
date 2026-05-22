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

// Postgres `relation does not exist` code. Surfaced when the migration in
// apps/landing/migrations/0001_init_blog.sql has not been applied yet to the
// Neon database pointed to by DATABASE_URL. In that pre-migration window we
// treat the table as empty so that /blog, /blog/[slug] and /sitemap.xml all
// render rather than throwing and bringing the Vercel build down. Any other
// DB error still propagates per the project's fail-loud policy.
const POSTGRES_UNDEFINED_TABLE = "42P01";

function isMissingBlogTable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === POSTGRES_UNDEFINED_TABLE
  );
}

export async function listArticles(limit = 50): Promise<BlogArticle[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT * FROM blog_articles
      ORDER BY published_at DESC
      LIMIT ${limit}
    `) as RawBlogArticle[];
    return rows.map(mapRow);
  } catch (err) {
    if (isMissingBlogTable(err)) {
      console.warn(
        "[landing/blog] blog_articles table missing; run migrations/0001_init_blog.sql against DATABASE_URL",
      );
      return [];
    }
    throw err;
  }
}

export async function getArticleBySlug(slug: string): Promise<BlogArticle | null> {
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT * FROM blog_articles
      WHERE slug = ${slug}
      LIMIT 1
    `) as RawBlogArticle[];
    if (rows.length === 0) return null;
    return mapRow(rows[0]);
  } catch (err) {
    if (isMissingBlogTable(err)) {
      console.warn(
        "[landing/blog] blog_articles table missing; run migrations/0001_init_blog.sql against DATABASE_URL",
      );
      return null;
    }
    throw err;
  }
}
