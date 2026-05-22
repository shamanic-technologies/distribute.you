import { z } from "zod";

// Outrank.so webhook payload schemas.
// Reference: https://www.outrank.so/docs/webhook
//
// Two event types, both POSTed to the same endpoint:
//
// 1. event_type = "publish_articles" with data.articles (array)
// 2. event_type = "update_article"   with data.article  (single object)
//
// Both article shapes are identical otherwise.

const OutrankArticleSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  slug: z.string().min(1),
  content_markdown: z.string(),
  content_html: z.string(),
  meta_description: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  created_at: z.string(),
});

const PublishArticlesPayload = z.object({
  event_type: z.literal("publish_articles"),
  timestamp: z.string(),
  data: z.object({
    articles: z.array(OutrankArticleSchema).min(1),
  }),
});

const UpdateArticlePayload = z.object({
  event_type: z.literal("update_article"),
  timestamp: z.string(),
  data: z.object({
    article: OutrankArticleSchema,
  }),
});

export const OutrankWebhookSchema = z.discriminatedUnion("event_type", [
  PublishArticlesPayload,
  UpdateArticlePayload,
]);

export type OutrankWebhookPayload = z.infer<typeof OutrankWebhookSchema>;
export type OutrankArticle = z.infer<typeof OutrankArticleSchema>;

export interface UpsertArticleInputShape {
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml: string;
  contentMarkdown: string;
  coverImageUrl: string | null;
  tags: string[];
  source: "outrank";
  sourceId: string;
  publishedAt: string;
}

function toUpsertInput(article: OutrankArticle): UpsertArticleInputShape {
  return {
    slug: article.slug,
    title: article.title,
    excerpt: article.meta_description ?? null,
    contentHtml: article.content_html,
    contentMarkdown: article.content_markdown,
    coverImageUrl: article.image_url ?? null,
    tags: article.tags ?? [],
    source: "outrank",
    sourceId: article.id,
    publishedAt: article.created_at,
  };
}

export function extractArticles(payload: OutrankWebhookPayload): UpsertArticleInputShape[] {
  if (payload.event_type === "publish_articles") {
    return payload.data.articles.map(toUpsertInput);
  }
  return [toUpsertInput(payload.data.article)];
}
