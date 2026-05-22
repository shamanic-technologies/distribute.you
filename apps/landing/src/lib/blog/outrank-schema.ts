import { z } from "zod";

// Outrank.so webhook payload schema.
// The exact shape is documented at: https://outrank.so (TBD — Kevin to confirm).
// Until that arrives, this schema accepts the common fields a CMS-style
// webhook tends to send. Adjust when the spec lands.

const OutrankArticleSchema = z
  .object({
    id: z.string().optional(),
    slug: z.string().min(1),
    title: z.string().min(1),
    excerpt: z.string().optional().nullable(),
    content_html: z.string().optional().nullable(),
    html: z.string().optional().nullable(),
    content_markdown: z.string().optional().nullable(),
    markdown: z.string().optional().nullable(),
    cover_image_url: z.string().url().optional().nullable(),
    image_url: z.string().url().optional().nullable(),
    tags: z.array(z.string()).optional(),
    published_at: z.string().optional().nullable(),
    publishedAt: z.string().optional().nullable(),
  })
  .passthrough();

export const OutrankWebhookSchema = z
  .object({
    event: z.string().optional(),
    article: OutrankArticleSchema.optional(),
    data: OutrankArticleSchema.optional(),
  })
  .passthrough();

export type OutrankWebhookPayload = z.infer<typeof OutrankWebhookSchema>;

export function extractArticle(payload: OutrankWebhookPayload) {
  const a = payload.article ?? payload.data;
  if (!a) {
    throw new Error("[outrank] payload missing article/data field");
  }
  const html = a.content_html ?? a.html ?? null;
  const markdown = a.content_markdown ?? a.markdown ?? null;
  const cover = a.cover_image_url ?? a.image_url ?? null;
  const published = a.published_at ?? a.publishedAt ?? null;
  if (!html && !markdown) {
    throw new Error("[outrank] payload missing both content_html and content_markdown");
  }
  return {
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt ?? null,
    contentHtml: html,
    contentMarkdown: markdown,
    coverImageUrl: cover,
    tags: a.tags ?? [],
    source: "outrank",
    sourceId: a.id ?? null,
    publishedAt: published,
  };
}
