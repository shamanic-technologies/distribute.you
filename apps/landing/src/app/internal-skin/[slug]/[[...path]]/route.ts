import { applyDistrySkin, isSkinnedStylesheet, skinStylesheet } from "@/lib/distry-skin";
import { isLabHiddenPage } from "@/lib/lab-offer";
import { prototypeFor } from "@/lib/prototype-catalogue";

/**
 * One live page, in the Distry skin (`src/lib/distry-skin.ts`).
 *
 * Reached only through the host rewrite in `src/proxy.ts`, which has checked the lab
 * password; the proxy 404s this prefix on every other host. The page is rendered by
 * this same server and skinned, so it can never drift from what production serves. The
 * fetch goes to the local port (`request.url` here is the bind address).
 */

export const dynamic = "force-dynamic";

const HEADERS = { "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" } as const;

/** What the page renderer needs to answer as it would a browser (React pages read these for client navigation). */
const FORWARDED = ["accept", "rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url"];

export async function GET(request: Request, context: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug, path } = await context.params;
  if (prototypeFor(slug) === null) return new Response("Not found.", { status: 404, headers: HEADERS });

  const pathname = `/${(path ?? []).map(encodeURIComponent).join("/")}`;
  // An article about the old offer is not served on the lab (`LAB_HIDDEN_PAGES`).
  if (isLabHiddenPage(pathname)) return new Response(null, { status: 307, headers: { ...HEADERS, location: "/blog" } });
  const search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("accept")) headers.set("accept", "text/html");

  const origin = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
  const page = await fetch(`${origin}${pathname}${search}`, { headers, cache: "no-store", redirect: "manual" });

  const location = page.headers.get("location");
  if (page.status >= 300 && page.status < 400 && location) {
    // A redirect of the live site, replayed on this host (the origin's own address is the bind address).
    const target = location.replace(/^https?:\/\/(127\.0\.0\.1|0\.0\.0\.0|localhost)(:\d+)?/, "").replace(/^https:\/\/distribute\.you/, "");
    return new Response(null, { status: page.status, headers: { ...HEADERS, location: target || "/" } });
  }

  const type = page.headers.get("content-type") ?? "application/octet-stream";
  if (type.includes("text/html")) {
    return new Response(applyDistrySkin(await page.text(), pathname, page.status), { status: page.status, headers: { ...HEADERS, "content-type": type } });
  }
  if (isSkinnedStylesheet(pathname) && page.ok) {
    return new Response(skinStylesheet(await page.text()), { headers: { ...HEADERS, "content-type": type } });
  }
  return new Response(page.body, { status: page.status, headers: { ...HEADERS, "content-type": type, vary: page.headers.get("vary") ?? "Accept" } });
}
