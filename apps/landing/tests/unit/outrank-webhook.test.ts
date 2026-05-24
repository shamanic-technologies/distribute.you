import { describe, it, expect, vi, beforeEach } from "vitest";
import { OutrankWebhookSchema, extractArticles } from "@/lib/blog/outrank-schema";

const sampleArticle = {
  id: "out_42",
  title: "Title",
  slug: "the-slug",
  content_markdown: "# Hello",
  content_html: "<p>Hello</p>",
  meta_description: "A lede",
  image_url: "https://img.example/cover.png",
  tags: ["a", "b"],
  created_at: "2026-05-22T10:00:00Z",
};

describe("OutrankWebhookSchema", () => {
  it("accepts a publish_articles payload (array)", () => {
    const parsed = OutrankWebhookSchema.safeParse({
      event_type: "publish_articles",
      timestamp: "2026-05-22T10:00:00Z",
      data: { articles: [sampleArticle] },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an update_article payload (single)", () => {
    const parsed = OutrankWebhookSchema.safeParse({
      event_type: "update_article",
      timestamp: "2026-05-22T10:00:00Z",
      data: { article: sampleArticle },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a payload with an unknown event_type", () => {
    const parsed = OutrankWebhookSchema.safeParse({
      event_type: "delete_article",
      timestamp: "2026-05-22T10:00:00Z",
      data: { article: sampleArticle },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects publish_articles with an empty articles array", () => {
    const parsed = OutrankWebhookSchema.safeParse({
      event_type: "publish_articles",
      timestamp: "2026-05-22T10:00:00Z",
      data: { articles: [] },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an article missing content_html", () => {
    const { content_html: _omit, ...rest } = sampleArticle;
    const parsed = OutrankWebhookSchema.safeParse({
      event_type: "update_article",
      timestamp: "2026-05-22T10:00:00Z",
      data: { article: rest },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("extractArticles", () => {
  it("maps a publish_articles payload to upsert inputs", () => {
    const parsed = OutrankWebhookSchema.parse({
      event_type: "publish_articles",
      timestamp: "2026-05-22T10:00:00Z",
      data: { articles: [sampleArticle, { ...sampleArticle, id: "out_43", slug: "second" }] },
    });
    const inputs = extractArticles(parsed);
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toMatchObject({
      slug: "the-slug",
      title: "Title",
      excerpt: "A lede",
      contentHtml: "<p>Hello</p>",
      contentMarkdown: "# Hello",
      coverImageUrl: "https://img.example/cover.png",
      tags: ["a", "b"],
      source: "outrank",
      sourceId: "out_42",
      publishedAt: "2026-05-22T10:00:00Z",
    });
    expect(inputs[1].slug).toBe("second");
    expect(inputs[1].sourceId).toBe("out_43");
  });

  it("maps an update_article payload to a single upsert input", () => {
    const parsed = OutrankWebhookSchema.parse({
      event_type: "update_article",
      timestamp: "2026-05-22T10:00:00Z",
      data: { article: sampleArticle },
    });
    const inputs = extractArticles(parsed);
    expect(inputs).toHaveLength(1);
    expect(inputs[0].slug).toBe("the-slug");
  });
});

describe("Outrank webhook route — auth + parse", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    process.env.OUTRANK_WEBHOOK_SECRET = "test-secret";
  });

  function makeRequest({
    body,
    auth,
  }: {
    body: unknown;
    auth?: string;
  }): import("next/server").NextRequest {
    const headers = new Headers({ "content-type": "application/json" });
    if (auth) headers.set("authorization", auth);
    return {
      headers,
      json: async () => body,
    } as unknown as import("next/server").NextRequest;
  }

  it("returns 401 without Authorization header", async () => {
    vi.doMock("@/lib/blog/db", () => ({ upsertArticle: vi.fn() }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
    const { POST } = await import("@/app/api/outrank/webhook/route");
    const res = await POST(makeRequest({ body: {} }));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong bearer token", async () => {
    vi.doMock("@/lib/blog/db", () => ({ upsertArticle: vi.fn() }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
    const { POST } = await import("@/app/api/outrank/webhook/route");
    const res = await POST(makeRequest({ body: {}, auth: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on a payload that fails the discriminated union", async () => {
    vi.doMock("@/lib/blog/db", () => ({ upsertArticle: vi.fn() }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
    const { POST } = await import("@/app/api/outrank/webhook/route");
    const res = await POST(
      makeRequest({
        body: { event_type: "publish_articles", timestamp: "x", data: { articles: [] } },
        auth: "Bearer test-secret",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts every article in a publish_articles batch", async () => {
    const upsertSpy = vi
      .fn()
      .mockResolvedValueOnce({ id: "r1", slug: "first" })
      .mockResolvedValueOnce({ id: "r2", slug: "second" });
    const revalPathSpy = vi.fn();
    const revalTagSpy = vi.fn();
    vi.doMock("@/lib/blog/db", () => ({ upsertArticle: upsertSpy }));
    vi.doMock("next/cache", () => ({
      revalidatePath: revalPathSpy,
      revalidateTag: revalTagSpy,
    }));
    const { POST } = await import("@/app/api/outrank/webhook/route");
    const res = await POST(
      makeRequest({
        body: {
          event_type: "publish_articles",
          timestamp: "2026-05-22T10:00:00Z",
          data: {
            articles: [
              { ...sampleArticle, id: "out_1", slug: "first" },
              { ...sampleArticle, id: "out_2", slug: "second" },
            ],
          },
        },
        auth: "Bearer test-secret",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Webhook processed successfully");
    expect(upsertSpy).toHaveBeenCalledTimes(2);
    expect(revalPathSpy).toHaveBeenCalledWith("/blog");
    expect(revalPathSpy).toHaveBeenCalledWith("/blog/first");
    expect(revalPathSpy).toHaveBeenCalledWith("/blog/second");
    expect(revalPathSpy).toHaveBeenCalledWith("/sitemap.xml");
    expect(revalTagSpy).toHaveBeenCalledWith("blog-articles", "default");
    expect(revalTagSpy).toHaveBeenCalledWith("blog-article-first", "default");
    expect(revalTagSpy).toHaveBeenCalledWith("blog-article-second", "default");
  });

  it("upserts a single article on update_article", async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ id: "r1", slug: "the-slug" });
    const revalTagSpy = vi.fn();
    vi.doMock("@/lib/blog/db", () => ({ upsertArticle: upsertSpy }));
    vi.doMock("next/cache", () => ({
      revalidatePath: vi.fn(),
      revalidateTag: revalTagSpy,
    }));
    const { POST } = await import("@/app/api/outrank/webhook/route");
    const res = await POST(
      makeRequest({
        body: {
          event_type: "update_article",
          timestamp: "2026-05-22T10:00:00Z",
          data: { article: sampleArticle },
        },
        auth: "Bearer test-secret",
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "the-slug",
        contentHtml: "<p>Hello</p>",
        sourceId: "out_42",
        publishedAt: "2026-05-22T10:00:00Z",
      }),
    );
    expect(revalTagSpy).toHaveBeenCalledWith("blog-articles", "default");
    expect(revalTagSpy).toHaveBeenCalledWith("blog-article-the-slug", "default");
  });
});
