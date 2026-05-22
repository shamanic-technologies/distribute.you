-- Initial schema for the Outrank-fed blog.
-- Idempotent. Apply via `psql $DATABASE_URL -f migrations/0001_init_blog.sql`
-- or via the Neon MCP tooling. Re-running is safe.

CREATE TABLE IF NOT EXISTS blog_articles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  title             text NOT NULL,
  excerpt           text,
  content_html      text,
  content_markdown  text,
  cover_image_url   text,
  tags              text[] NOT NULL DEFAULT ARRAY[]::text[],
  source            text NOT NULL DEFAULT 'outrank',
  source_id         text,
  published_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_articles_published_at
  ON blog_articles (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_articles_source_source_id
  ON blog_articles (source, source_id);
