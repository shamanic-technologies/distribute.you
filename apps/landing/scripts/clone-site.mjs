#!/usr/bin/env node
/**
 * Mirror a competitor landing page into `apps/landing/clones/<slug>/`.
 *
 *   node scripts/clone-site.mjs https://explee.com/ explee
 *
 * The point of this script is FIDELITY, so it deliberately rewrites nothing: every
 * file lands at the path the origin served it from, and the clone is then served at
 * the ROOT of its own subdomain (see src/proxy.ts) so its root-absolute references —
 * `/_next/static/...`, `/css/site.css`, `url(/img/hero.png)` — resolve exactly as
 * they do on the origin. A link-rewriting mirror (wget --convert-links and friends)
 * changes bytes we have not read, which is the one thing a t=0 clone must not do.
 *
 * Cross-origin assets (a vendor CDN, fonts, framerusercontent) are LEFT pointing at
 * their origin. They load, they are identical, and rapatriating them is a decision
 * for whenever the clone starts being brand-ised — not for the copy.
 *
 * Discovery walks three surfaces, because a modern marketing page hides its assets in
 * all three: the HTML (src/href/srcset/inline url()), the CSS it pulls (url() and
 * @import, recursively), and the JS bundles (every "/_next/static/..." string literal
 * a chunk mentions, which is how a Next app names the chunks it imports dynamically —
 * those appear nowhere in the HTML).
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MAX_FILES = 3000;
const CONCURRENCY = 8;

/** Assets we are willing to walk INTO for further references. */
const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".mjs", ".json", ".txt", ""]);

/**
 * What counts as an asset the entry page NEEDS, as opposed to another page it links to.
 *
 * This is the whole difference between mirroring a landing page and crawling a site:
 * `explee.com` links to a country page per ISO code, so following document links pulls
 * eight hundred files and 171MB for a page that needs about seventy. Only references
 * that name an asset extension, or live under a framework's own asset root, are queued.
 */
const ASSET_EXTENSIONS = new Set([
  ".js", ".mjs", ".css", ".map",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico", ".bmp",
  ".mp4", ".webm", ".mov", ".ogg", ".mp3", ".wav",
  ".json",
]);

const ASSET_ROOTS = ["/_next/", "/_astro/", "/_nuxt/", "/assets/", "/static/", "/cdn-cgi/"];

export function isAssetPath(pathname) {
  const clean = pathname.split("?")[0];
  if (ASSET_EXTENSIONS.has(extensionOf(clean))) return true;
  return ASSET_ROOTS.some((root) => clean.startsWith(root));
}

export function splitQuery(pathname) {
  const at = pathname.indexOf("?");
  return at === -1 ? [pathname, ""] : [pathname.slice(0, at), pathname.slice(at)];
}

function extensionOf(pathname) {
  const base = pathname.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot).toLowerCase();
}

/**
 * A query string is part of a URL's IDENTITY when the server generates the response from
 * it — `/_next/image?url=…&w=96` and `?w=48` are two different pictures behind one path.
 * Dropping the query would collapse every variant onto one file, so a query-bearing URL
 * is stored BESIDE its plain form as `<stem>.__q<hash><ext>` and looked up by the same
 * hash at serve time (see the clone route). A sibling rather than a child directory,
 * because an origin routinely serves both `/logo.svg` and `/logo.svg?v=2` and a child
 * would need that name to be a file and a directory at once. Ten hex characters is 40
 * bits, far more than the handful of variants one page requests.
 */
export const QUERY_MARKER = "__q";

export function queryHash(search) {
  return createHash("sha1").update(search).digest("hex").slice(0, 10);
}

/**
 * Where a URL lands on disk. A path ending in `/` (or carrying no extension at all,
 * which is every framework route) is a document, so it becomes `<path>/index.html` —
 * that is what the serving route looks for, and it keeps a directory and a file from
 * fighting over the same name.
 */
export function diskPathFor(urlPathname, search = "", fallbackExtension = "") {
  // DECODED, because the reader decodes (`clonePathFor`): a Next app names its dynamic
  // chunks `[slug]`, which arrives as `%5Bslug%5D`, and a file stored under the encoded
  // name was a 404 sitting on disk — every such chunk, on every Next clone.
  let decoded = urlPathname;
  try {
    decoded = decodeURIComponent(urlPathname);
  } catch {
    // a malformed escape stays as it came; the reader refuses it anyway
  }
  const clean = decoded.split("?")[0].split("#")[0];
  const trimmed = clean.replace(/^\/+/, "").replace(/\/+$/, "");

  if (search && search !== "?") {
    const ext = extensionOf(clean) || fallbackExtension;
    const stem = ext && trimmed.endsWith(ext) ? trimmed.slice(0, -ext.length) : trimmed;
    return `${stem}.${QUERY_MARKER}${queryHash(search)}${ext}`;
  }

  if (trimmed === "") return "index.html";
  if (clean.endsWith("/")) return `${trimmed}/index.html`;
  if (extensionOf(clean) === "") return `${trimmed}/index.html`;
  return trimmed;
}

/** Content types we can name a file extension for, when the URL itself carries none. */
const EXTENSION_BY_CONTENT_TYPE = new Map([
  ["image/avif", ".avif"],
  ["image/webp", ".webp"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/svg+xml", ".svg"],
  ["text/css", ".css"],
  ["text/html", ".html"],
  ["application/javascript", ".js"],
  ["text/javascript", ".js"],
  ["application/json", ".json"],
  ["font/woff2", ".woff2"],
  ["font/woff", ".woff"],
]);

export function extensionForContentType(contentType) {
  const base = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return EXTENSION_BY_CONTENT_TYPE.get(base) ?? "";
}

/**
 * Same-origin references found in a document or asset, as absolute pathnames.
 *
 * Deliberately regex-based rather than a DOM parse: the input includes CSS and JS as
 * well as HTML, the three share the same `"/path"` shape, and a parser would only
 * cover one of them. Over-matching is harmless — a path that does not exist 404s at
 * fetch time and is dropped.
 */
export function referencesIn(text, baseUrl, kind) {
  const found = new Set();
  const origin = new URL(baseUrl).origin;

  const add = (raw) => {
    if (!raw) return;
    // Markup escapes the ampersands of a query string, so a srcset candidate arrives as
    // `/_next/image?url=x&amp;w=96`. Fetched verbatim that is a different URL, and the
    // origin answers 400 — which is how the testimonial avatars went missing on the
    // first run of this script.
    const value = raw
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&#0*38;/g, "&")
      .replace(/&quot;/g, '"');
    if (!value || value.startsWith("data:") || value.startsWith("#")) return;
    let resolved;
    try {
      resolved = new URL(value, baseUrl);
    } catch {
      return;
    }
    if (resolved.origin !== origin) return;
    if (!isAssetPath(resolved.pathname)) return;
    found.add(resolved.pathname + resolved.search);
  };

  if (kind === "html") {
    // Markup. `href` is included because a stylesheet, a favicon and a preload all use
    // it — the asset test above is what stops an ordinary anchor from being queued.
    for (const m of text.matchAll(/(?:src|href|poster|data-src)\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
    for (const m of text.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi)) {
      for (const candidate of m[1].split(",")) add(candidate.trim().split(/\s+/)[0]);
    }
  }

  if (kind === "html" || kind === "css") {
    for (const m of text.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) add(m[2]);
    for (const m of text.matchAll(/@import\s+(?:url\()?\s*['"]([^'"]+)['"]/gi)) add(m[1]);
  }

  // Every kind, including JS: a bundle names the chunks it imports dynamically as bare
  // string literals, so they appear in no markup and an HTML-only walk misses them —
  // which is exactly the set a hydrating page needs. Matching only absolute paths that
  // already carry an asset extension keeps ordinary code out (a `url(` in minified JS
  // and a relative `e` in `new URL(e, base)` both resolve to plausible-looking 404s).
  for (const m of text.matchAll(/["'`](\/[a-zA-Z0-9._@\-/]+\.[a-z0-9]{2,5})["'`]/g)) add(m[1]);

  return [...found];
}

async function run(startUrl, slug, outRoot) {
  const origin = new URL(startUrl).origin;
  const queue = [new URL(startUrl).pathname + new URL(startUrl).search];
  const seen = new Set(queue);
  const written = [];
  const failed = [];

  while (queue.length > 0 && written.length < MAX_FILES) {
    const batch = queue.splice(0, CONCURRENCY);

    await Promise.all(
      batch.map(async (pathname) => {
        const url = origin + pathname;
        let res;
        try {
          res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" } });
        } catch (err) {
          failed.push(`${pathname} — ${err.message}`);
          return;
        }
        if (!res.ok) {
          failed.push(`${pathname} — HTTP ${res.status}`);
          return;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        const [purePath, search] = splitQuery(pathname);
        const relative = diskPathFor(
          purePath,
          search,
          extensionForContentType(res.headers.get("content-type")),
        );
        const target = path.join(outRoot, relative);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, buffer);
        written.push(relative);

        const ext = extensionOf(purePath);
        const contentType = res.headers.get("content-type") ?? "";
        const walkable =
          TEXT_EXTENSIONS.has(ext) ||
          contentType.includes("text/") ||
          contentType.includes("javascript") ||
          contentType.includes("json");
        if (!walkable) return;

        const kind = ext === ".css" || contentType.includes("text/css")
          ? "css"
          : ext === ".html" || contentType.includes("text/html")
            ? "html"
            : "other";

        for (const ref of referencesIn(buffer.toString("utf8"), url, kind)) {
          if (seen.has(ref)) continue;
          seen.add(ref);
          queue.push(ref);
        }
      }),
    );

    process.stdout.write(`\r[clone:${slug}] written ${written.length}, queued ${queue.length}   `);
  }

  process.stdout.write("\n");
  console.log(`[clone:${slug}] ${written.length} files under ${outRoot}`);
  if (failed.length > 0) {
    console.log(`[clone:${slug}] ${failed.length} references did not fetch:`);
    for (const line of failed.slice(0, 25)) console.log(`  ${line}`);
    if (failed.length > 25) console.log(`  … ${failed.length - 25} more`);
  }
}

const [, , startUrl, slug] = process.argv;
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!startUrl || !slug) {
    console.error("usage: node scripts/clone-site.mjs <url> <slug>");
    process.exit(1);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error(`[clone] slug must be lowercase letters, digits and dashes: ${slug}`);
    process.exit(1);
  }
  const outRoot = path.join(process.cwd(), "clones", slug);
  await run(startUrl, slug, outRoot);
}
