import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PREVIEW_ARTICLE_SLUGS, isPreviewArticle, previewArticleSlugFor } from "../../src/lib/blog/preview";

const root = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("a preview article is behind the lab password and listed nowhere", () => {
  it("the set equals the preview: true flags on disk", () => {
    const flagged = readdirSync(join(root, "content/blog")).filter((slug) => {
      const meta = JSON.parse(read(`content/blog/${slug}/meta.json`)) as { preview?: boolean };
      return meta.preview === true;
    });
    expect(new Set(flagged)).toEqual(new Set(PREVIEW_ARTICLE_SLUGS));
  });

  it("matches only a preview article's own path; a published article is never gated", () => {
    // cost-per-click-cold-email was released 2026-09-10 (owner: "enleve le pwd"), so the set is
    // empty today and every published slug resolves to null.
    for (const slug of readdirSync(join(root, "content/blog"))) {
      if (isPreviewArticle(slug)) continue;
      expect(previewArticleSlugFor(`/blog/${slug}`)).toBeNull();
      expect(previewArticleSlugFor(`/blog/${slug}/`)).toBeNull();
    }
    expect(previewArticleSlugFor("/blog")).toBeNull();
    expect(previewArticleSlugFor("/blog/cost-per-click-cold-email/hero.png")).toBeNull();
    expect(isPreviewArticle("nope")).toBe(false);
  });

  it("the proxy gates it after the host check, never caches it and never indexes it", () => {
    const proxy = read("src/proxy.ts");
    const offHost = proxy.slice(proxy.indexOf("function offCloneHost("));
    expect(offHost).toContain("previewArticleSlugFor(pathname)");
    expect(offHost).toContain("basicAuthOk(request.headers.get(\"authorization\"), process.env.CLONE_BASIC_AUTH)");
    expect(offHost).toContain("status: 401");
    expect(offHost).toContain('"cache-control": "private, no-store"');
    expect(offHost).toContain('"x-robots-tag": "noindex, nofollow"');
    // Nothing above the host check: the first statement of proxy() is still the clone exit.
    const body = proxy.slice(proxy.indexOf("export default function proxy("));
    expect(body.indexOf("cloneSlugForHost(")).toBeLessThan(body.indexOf("previewArticleSlugFor("));
  });

  it("the list every index reads drops it, the by-slug read does not", () => {
    const db = read("src/lib/blog/db.ts");
    const list = db.slice(db.indexOf("export const listArticles"), db.indexOf("export async function getArticleBySlug"));
    expect(list).toContain("!isPreviewArticle(a.slug)");
    const bySlug = db.slice(db.indexOf("export async function getArticleBySlug"));
    expect(bySlug).not.toContain("isPreviewArticle");
  });

  it("the preview module stays edge-safe", () => {
    const src = read("src/lib/blog/preview.ts");
    expect(src).not.toMatch(/from "(node:|@\/|fs|path)/);
  });
});
