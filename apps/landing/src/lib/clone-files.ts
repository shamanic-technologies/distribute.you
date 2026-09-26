/**
 * Turning a request path into a file inside `apps/landing/clones/<slug>/`.
 *
 * This is the read half of `scripts/clone-site.mjs`'s write half, and the two MUST agree
 * on every path — `tests/unit/clone-serving.test.ts` imports both and compares them over
 * a table, because a disagreement here is a 404 on an asset that is sitting on disk.
 */

import { createHash } from "node:crypto";
import path from "node:path";

/** Mirrors `QUERY_MARKER` in scripts/clone-site.mjs. */
export const QUERY_MARKER = "__q";

export function queryHash(search: string): string {
  return createHash("sha1").update(search).digest("hex").slice(0, 10);
}

function extensionOf(pathname: string): string {
  const base = pathname.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot).toLowerCase();
}

/**
 * The path the ORIGIN was asked for, given what the route handler sees.
 *
 * `request.url` inside a route handler is the request as it ARRIVED, not the rewritten
 * one the proxy produced — so on `lab-explee.distribute.you/version.json` it reads
 * `/version.json`, which is already the answer. Slicing an internal prefix off it is
 * what a rewrite invites and it is silently wrong: a path SHORTER than the prefix
 * collapses to `/` (every such request served the home page), and a longer one loses
 * its first characters (every asset 404'd while sitting on disk). The prefix strip
 * survives only for the case where a clone host is asked for the internal path itself.
 */
export function originPathFor(requestPathname: string, routePrefix: string, slug: string): string {
  const prefix = `${routePrefix}/${slug}`;
  if (requestPathname === prefix) return "/";
  if (requestPathname.startsWith(`${prefix}/`)) return requestPathname.slice(prefix.length);
  return requestPathname;
}

/**
 * The file a request path maps to, relative to the clone's root — or null when the path
 * cannot be trusted.
 *
 * The traversal guard is the reason this returns null rather than throwing: a crafted
 * `/../../../etc/passwd`, or a percent-encoded one, is an ordinary 404 to the caller and
 * carries no information about what does or does not exist above the clone root.
 */
export function clonePathFor(urlPathname: string, search = ""): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  const clean = decoded.split("?")[0].split("#")[0];
  if (!clean.startsWith("/")) return null;

  const segments = clean.split("/").filter((segment) => segment !== "" && segment !== ".");
  if (segments.some((segment) => segment === "..")) return null;

  const trimmed = segments.join("/");

  if (search && search !== "?") {
    const ext = extensionOf(clean);
    const stem = ext && trimmed.endsWith(ext) ? trimmed.slice(0, -ext.length) : trimmed;
    return `${stem}.${QUERY_MARKER}${queryHash(search)}${ext}`;
  }

  if (trimmed === "") return "index.html";
  if (clean.endsWith("/")) return `${trimmed}/index.html`;
  if (extensionOf(clean) === "") return `${trimmed}/index.html`;
  return trimmed;
}

/**
 * Which of several stored variants of one query-bearing URL to serve.
 *
 * An origin can answer ONE url with different bytes per `Accept` — `/_next/image?w=256`
 * is AVIF to a browser that asked for it and PNG to one that did not — so a capture that
 * visits the page four times stores `image.__q<hash>.avif` AND `image.__q<hash>.png`. The
 * reader cannot know which from the path alone (the url carries no extension at all), so
 * it lists what is there and honours the caller's `Accept` the way the origin did.
 *
 * `candidates` are file NAMES in the stored file's directory; `stem` is the name the
 * path maps to. Returns null when nothing matches, which is an ordinary 404.
 */
export function pickStoredVariant(
  candidates: readonly string[],
  stem: string,
  accept: string | null | undefined,
): string | null {
  const matches = candidates
    .filter((name) => name === stem || name.startsWith(`${stem}.`))
    .sort();
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const accepted = (accept ?? "").toLowerCase();
  const preferred = matches.find((name) => {
    const type = contentTypeFor(name).split(";")[0];
    return type !== "application/octet-stream" && accepted.includes(type);
  });
  return preferred ?? matches[0];
}

/**
 * True when a query is nothing but Next's router cache-buster (`?_rsc=<hash>`).
 *
 * A Next 16 app navigates client-side by fetching per-segment payloads such as
 * `/crew/__next._tree.txt?_rsc=3h9d7`. The `_rsc` value is a hash of the requesting
 * router's state, so the value a clone's visitor sends never equals one the capture
 * recorded, while the payload behind it is the same bytes for every value (measured on
 * keel: eleven captured variants of one segment, one md5). An exact miss therefore falls
 * back to ANY stored variant of that path — without it every click 404s its prefetch and
 * the app degrades to a full page load per navigation.
 */
export function isRscCacheBusterOnly(search: string): boolean {
  if (!search || search === "?") return false;
  const keys = [...new URLSearchParams(search).keys()];
  return keys.length === 1 && keys[0] === "_rsc";
}

/**
 * Which stored `?_rsc=` variant to serve for a cache-buster miss. `plainName` is the file
 * name the path maps to with no query (`__next._tree.txt`); the stored siblings are
 * `__next._tree.__q<hash>.txt`. Sorted so the pick is deterministic; null is a 404.
 */
export function pickRscVariant(candidates: readonly string[], plainName: string): string | null {
  const dot = plainName.lastIndexOf(".");
  const stem = dot === -1 ? plainName : plainName.slice(0, dot);
  const ext = dot === -1 ? "" : plainName.slice(dot);
  const prefix = `${stem}.${QUERY_MARKER}`;
  const matches = candidates.filter((name) => name.startsWith(prefix) && name.endsWith(ext)).sort();
  return matches[0] ?? null;
}

/** True when `candidate` resolves inside `root`. The second gate, after the segment check. */
export function withinRoot(root: string, candidate: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`);
}

const CONTENT_TYPES = new Map<string, string>([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"],
  [".bmp", "image/bmp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
  [".eot", "application/vnd.ms-fontobject"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".ogg", "audio/ogg"],
  [".txt", "text/plain; charset=utf-8"],
]);

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES.get(extensionOf(filePath)) ?? "application/octet-stream";
}
