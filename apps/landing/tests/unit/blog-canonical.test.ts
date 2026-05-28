import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/blog/db", () => ({
  listArticles: vi.fn(async () => []),
  getArticleBySlug: vi.fn(async (slug: string) =>
    slug === "known-slug"
      ? {
          id: "1",
          slug: "known-slug",
          title: "A Known Article",
          excerpt: "Some excerpt.",
          coverImageUrl: null,
          contentHtml: "<p>hi</p>",
          contentMarkdown: null,
          publishedAt: "2026-05-01T00:00:00Z",
          updatedAt: "2026-05-01T00:00:00Z",
          tags: [],
        }
      : null,
  ),
}));

describe("blog metadata canonical", () => {
  it("/blog index sets canonical to https://distribute.you/blog (not root)", async () => {
    const mod = await import("@/app/blog/page");
    const canonical =
      typeof mod.metadata.alternates?.canonical === "string"
        ? mod.metadata.alternates.canonical
        : (mod.metadata.alternates?.canonical as { url?: string } | undefined)?.url;
    expect(canonical).toBe("https://distribute.you/blog");
  });

  it("/blog/[slug] generateMetadata sets canonical to the article URL", async () => {
    const mod = await import("@/app/blog/[slug]/page");
    const meta = await mod.generateMetadata({
      params: Promise.resolve({ slug: "known-slug" }),
    });
    const canonical =
      typeof meta.alternates?.canonical === "string"
        ? meta.alternates.canonical
        : (meta.alternates?.canonical as { url?: string } | undefined)?.url;
    expect(canonical).toBe("https://distribute.you/blog/known-slug");
  });
});
