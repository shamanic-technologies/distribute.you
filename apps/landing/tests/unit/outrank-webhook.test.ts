import { describe, it, expect, vi, beforeEach } from "vitest";
import { OutrankWebhookSchema, extractArticle } from "@/lib/blog/outrank-schema";

describe("OutrankWebhookSchema", () => {
  it("accepts a payload with `article` shaped fields", () => {
    const parsed = OutrankWebhookSchema.safeParse({
      event: "article.published",
      article: {
        id: "out_123",
        slug: "hello-world",
        title: "Hello World",
        excerpt: "Intro line",
        content_html: "<p>Hi</p>",
        tags: ["intro"],
        published_at: "2026-05-22T12:00:00Z",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a payload with `data` instead of `article`", () => {
    const parsed = OutrankWebhookSchema.safeParse({
      data: {
        slug: "alt-shape",
        title: "Alt Shape",
        markdown: "# Hi",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a payload missing both slug and title", () => {
    const parsed = OutrankWebhookSchema.safeParse({
      article: { content_html: "<p>oops</p>" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a payload with an empty slug", () => {
    const parsed = OutrankWebhookSchema.safeParse({
      article: { slug: "", title: "x", content_html: "<p/>" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("extractArticle", () => {
  it("maps Outrank fields to the upsert input shape", () => {
    const result = extractArticle({
      article: {
        id: "out_42",
        slug: "the-slug",
        title: "Title",
        excerpt: "Lede",
        content_html: "<p>Body</p>",
        cover_image_url: "https://img.example/cover.png",
        tags: ["a", "b"],
        published_at: "2026-05-22T10:00:00Z",
      },
    });
    expect(result).toMatchObject({
      slug: "the-slug",
      title: "Title",
      excerpt: "Lede",
      contentHtml: "<p>Body</p>",
      contentMarkdown: null,
      coverImageUrl: "https://img.example/cover.png",
      tags: ["a", "b"],
      source: "outrank",
      sourceId: "out_42",
      publishedAt: "2026-05-22T10:00:00Z",
    });
  });

  it("falls back to `html` field when `content_html` is absent", () => {
    const result = extractArticle({
      article: { slug: "x", title: "y", html: "<p>via html</p>" },
    });
    expect(result.contentHtml).toBe("<p>via html</p>");
  });

  it("falls back to `markdown` field when `content_markdown` is absent", () => {
    const result = extractArticle({
      article: { slug: "x", title: "y", markdown: "# via markdown" },
    });
    expect(result.contentMarkdown).toBe("# via markdown");
  });

  it("throws when both html and markdown are missing", () => {
    expect(() =>
      extractArticle({
        article: { slug: "x", title: "y" },
      }),
    ).toThrow(/missing both content_html and content_markdown/);
  });

  it("throws when neither article nor data is present", () => {
    expect(() => extractArticle({} as never)).toThrow(/missing article\/data field/);
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
    vi.doMock("@/lib/blog/db", () => ({
      upsertArticle: vi.fn(),
    }));
    const { POST } = await import("@/app/api/outrank/webhook/route");
    const res = await POST(makeRequest({ body: {} }));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong bearer token", async () => {
    vi.doMock("@/lib/blog/db", () => ({
      upsertArticle: vi.fn(),
    }));
    const { POST } = await import("@/app/api/outrank/webhook/route");
    const res = await POST(makeRequest({ body: {}, auth: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid payload", async () => {
    vi.doMock("@/lib/blog/db", () => ({
      upsertArticle: vi.fn(),
    }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    const { POST } = await import("@/app/api/outrank/webhook/route");
    const res = await POST(
      makeRequest({ body: { article: { slug: "" } }, auth: "Bearer test-secret" }),
    );
    expect(res.status).toBe(400);
  });

  it("upserts and revalidates on a valid payload", async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ id: "row-1", slug: "x" });
    const revalSpy = vi.fn();
    vi.doMock("@/lib/blog/db", () => ({ upsertArticle: upsertSpy }));
    vi.doMock("next/cache", () => ({ revalidatePath: revalSpy }));
    const { POST } = await import("@/app/api/outrank/webhook/route");
    const res = await POST(
      makeRequest({
        body: {
          article: {
            slug: "x",
            title: "Title",
            content_html: "<p>body</p>",
            published_at: "2026-05-22T10:00:00Z",
          },
        },
        auth: "Bearer test-secret",
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    expect(revalSpy).toHaveBeenCalledWith("/blog");
    expect(revalSpy).toHaveBeenCalledWith("/blog/x");
  });
});
