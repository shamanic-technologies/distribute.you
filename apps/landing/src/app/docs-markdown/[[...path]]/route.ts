import { htmlToMarkdown } from "@/lib/html-to-markdown";
import { MARKDOWN_CONTENT_TYPE, VARY_HEADER } from "@/lib/content-negotiation";
import { docsPagePath } from "@/lib/docs/docs-markdown";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * The markdown variant of a /docs page. Reached only through the rewrite in
 * `proxy.ts` (a direct request 404s there), when the client asks for
 * `text/markdown`.
 *
 * The page is rendered by this same server and converted, so the markdown can
 * never drift from what a browser reads. The fetch goes to the local port:
 * `request.url` here is the bind address, and the public hostname would leave
 * the box and come back through Cloudflare.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pagePath = docsPagePath(path);
  const origin = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const page = await fetch(`${origin}${pagePath}`, {
    headers: { accept: "text/html" },
    cache: "no-store",
  });
  if (!page.ok) {
    console.error(`[docs-markdown] ${pagePath} answered ${page.status}`);
    return new Response(`Not found: ${pagePath}\n`, {
      status: page.status === 404 ? 404 : 502,
      headers: { "content-type": MARKDOWN_CONTENT_TYPE, vary: VARY_HEADER, "cache-control": "no-store" },
    });
  }
  const markdown = htmlToMarkdown(await page.text(), {
    baseUrl: SITE_URL,
    canonicalUrl: `${SITE_URL}${pagePath}`,
  });
  return new Response(markdown, {
    headers: {
      "content-type": MARKDOWN_CONTENT_TYPE,
      vary: VARY_HEADER,
      // Same reason as `staticResponse()`: Cloudflare keys only on Accept-Encoding.
      "cache-control": "no-store",
    },
  });
}
