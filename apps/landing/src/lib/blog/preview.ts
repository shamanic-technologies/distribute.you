/**
 * Articles that exist in the repo and in the DB but are NOT public yet: readable only
 * behind the lab password (`CLONE_BASIC_AUTH`, the same one in front of the competitor
 * clones), absent from /blog, the sitemap and any index.
 *
 * The set is a literal rather than a read of `content/blog/<slug>/meta.json` because it
 * runs in `src/proxy.ts` on the edge runtime, where there is no filesystem; a unit test
 * pins it equal to the `preview: true` flags on disk so the two cannot drift.
 *
 * Alias-free and `node:`-free on purpose: it is imported by the proxy.
 */
export const PREVIEW_ARTICLE_SLUGS: ReadonlySet<string> = new Set([]);

export function isPreviewArticle(slug: string): boolean {
  return PREVIEW_ARTICLE_SLUGS.has(slug);
}

/** The preview slug a request path is for, or null for every other path. */
export function previewArticleSlugFor(pathname: string): string | null {
  const m = /^\/blog\/([^/]+)\/?$/.exec(pathname);
  if (!m) return null;
  return isPreviewArticle(m[1]) ? m[1] : null;
}
