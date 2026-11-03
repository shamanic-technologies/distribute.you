/**
 * The /docs pages are React pages, so they never pass through `staticResponse()`
 * and used to answer HTML to `Accept: text/markdown` while llms.txt promised
 * markdown on every page. `proxy.ts` sends those requests to the internal
 * `/docs-markdown/*` route, which renders the same page and converts it.
 *
 * Pure and alias-free so it carries real unit tests.
 */

/** Internal route the proxy rewrites a markdown ask for a docs page to. */
export const DOCS_MARKDOWN_PREFIX = "/docs-markdown";

/**
 * Whether a path is a docs PAGE (`/docs`, `/docs/mcp/tools`), not a file the
 * docs serve themselves (`/docs/skill.md`, `/docs/llms.txt`, `/docs/og-image.png`).
 */
export function isDocsPagePath(pathname: string): boolean {
  if (pathname !== "/docs" && !pathname.startsWith("/docs/")) return false;
  const last = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  return !last.includes(".");
}

/** The internal path for a docs page: `/docs/mcp` -> `/docs-markdown/mcp`. */
export function docsMarkdownPath(pathname: string): string {
  const rest = pathname.replace(/\/+$/, "").slice("/docs".length);
  return `${DOCS_MARKDOWN_PREFIX}${rest}`;
}

/** The public docs page an internal path stands for: `["mcp"]` -> `/docs/mcp`. */
export function docsPagePath(segments: string[] | undefined): string {
  return segments && segments.length > 0 ? `/docs/${segments.join("/")}` : "/docs";
}
