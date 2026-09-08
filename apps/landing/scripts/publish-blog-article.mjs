#!/usr/bin/env node

/**
 * Publishes a hand-written blog article from apps/landing/content/blog/<slug>/
 * into the `blog_articles` table the /blog pages read.
 *
 * A hand-written article is a directory, never a webhook payload:
 *   content/blog/<slug>/meta.json      title, excerpt, tags, publishedAt, coverImagePath
 *   content/blog/<slug>/article.html   the body, an HTML fragment (tables, JSON-LD allowed)
 *   content/blog/<slug>/hero.svg       the cover, rendered to public/blog/<slug>/hero.png
 *                                      by scripts/render-blog-hero.mjs
 *
 * Two modes, because the landing's DATABASE_URL lives on the box and not on a
 * laptop:
 *   --sql       print an idempotent INSERT ... ON CONFLICT (slug) statement to
 *               stdout, to be piped into psql on the box (dollar-quoted, so the
 *               body needs no escaping)
 *   (default)   upsert through postgres.js against DATABASE_URL, the same
 *               statement the Outrank webhook runs (src/lib/blog/db.ts)
 *
 * `source` is "manual" so a hand-written article is distinguishable from an
 * Outrank one in the table. The cover URL is stored ABSOLUTE: the article page
 * passes it to next/image unoptimized and to og:image, and og:image must be
 * a full URL.
 *
 * Invocation:
 *   node scripts/publish-blog-article.mjs <slug> [--sql]
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, "..", "content", "blog");
const SITE_URL = "https://distribute.you";

export function loadArticle(slug) {
  const dir = join(CONTENT_DIR, slug);
  const metaPath = join(dir, "meta.json");
  const bodyPath = join(dir, "article.html");
  if (!existsSync(metaPath)) throw new Error(`[landing/blog] missing ${metaPath}`);
  if (!existsSync(bodyPath)) throw new Error(`[landing/blog] missing ${bodyPath}`);
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  if (meta.slug !== slug) {
    throw new Error(`[landing/blog] meta.json slug "${meta.slug}" does not match directory "${slug}"`);
  }
  for (const key of ["title", "excerpt", "publishedAt", "coverImagePath"]) {
    if (typeof meta[key] !== "string" || meta[key].length === 0) {
      throw new Error(`[landing/blog] meta.json is missing "${key}"`);
    }
  }
  if (!Array.isArray(meta.tags)) throw new Error("[landing/blog] meta.json tags must be an array");
  const contentHtml = readFileSync(bodyPath, "utf8");
  if (contentHtml.includes("—")) {
    throw new Error("[landing/blog] article.html carries an em-dash; user-facing copy must not");
  }
  return {
    slug,
    title: meta.title,
    excerpt: meta.excerpt,
    contentHtml,
    contentMarkdown: null,
    coverImageUrl: `${SITE_URL}${meta.coverImagePath}`,
    tags: meta.tags,
    source: meta.source ?? "manual",
    sourceId: null,
    publishedAt: meta.publishedAt,
  };
}

function dollarQuote(text) {
  // Pick a tag the body cannot contain, so the quoting cannot be broken by content.
  let tag = "art";
  while (text.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${text}$${tag}$`;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function toSql(article) {
  const tags = `ARRAY[${article.tags.map(sqlLiteral).join(", ")}]::text[]`;
  return `INSERT INTO blog_articles (
  slug, title, excerpt, content_html, content_markdown,
  cover_image_url, tags, source, source_id, published_at, updated_at
)
VALUES (
  ${sqlLiteral(article.slug)},
  ${sqlLiteral(article.title)},
  ${sqlLiteral(article.excerpt)},
  ${dollarQuote(article.contentHtml)},
  NULL,
  ${sqlLiteral(article.coverImageUrl)},
  ${tags},
  ${sqlLiteral(article.source)},
  NULL,
  ${sqlLiteral(article.publishedAt)},
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  title            = EXCLUDED.title,
  excerpt          = EXCLUDED.excerpt,
  content_html     = EXCLUDED.content_html,
  content_markdown = EXCLUDED.content_markdown,
  cover_image_url  = EXCLUDED.cover_image_url,
  tags             = EXCLUDED.tags,
  source           = EXCLUDED.source,
  source_id        = EXCLUDED.source_id,
  published_at     = EXCLUDED.published_at,
  updated_at       = now()
RETURNING slug, source, published_at, length(content_html) AS body_bytes;
`;
}

async function upsertViaDatabaseUrl(article) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("[landing/blog] DATABASE_URL is not set; use --sql to print the statement instead");
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql.unsafe(toSql(article));
    console.log(`[landing/blog] upserted`, rows[0]);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const [slug, ...flags] = process.argv.slice(2);
  if (!slug) {
    console.error("usage: node scripts/publish-blog-article.mjs <slug> [--sql]");
    process.exit(2);
  }
  const article = loadArticle(slug);
  if (flags.includes("--sql")) {
    process.stdout.write(toSql(article));
    return;
  }
  await upsertViaDatabaseUrl(article);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[landing/blog] Failed:", err);
    process.exit(1);
  });
}
