/**
 * The ONE builder of a gateway URL from a path the BROWSER chose.
 *
 * Every proxy that forwards a browser-supplied path to the API gateway (the
 * `/api/v1/[...path]` catch-alls, the anonymous proxy, any `[id]` route that
 * interpolates a param into an upstream URL) builds it here, and nowhere else.
 *
 * WHY (SECRETS-ROTATE-1127, 2026-11-20): `GET /api/v1/..%2f..%2finternal/admin/...`
 * reached the gateway as `/v1/../../internal/admin/...`. Next decodes `%2f` inside
 * a catch-all segment, the segments were joined with `/`, and `new URL()`
 * normalised the dot segments away, so a self-signed-up customer escaped `/v1`
 * and read staff-only `/internal/admin/*` with the platform key this proxy
 * injects. The proxy, not only Caddy or the gateway, must make that impossible.
 *
 * RULES, per segment as Next hands it (already decoded ONCE):
 *  - refused when empty (a `//` in the path, a protocol-relative or absolute URL);
 *  - refused when it is `.` or `..`;
 *  - refused when it still contains `%` (a second encoding layer: `%252e%252e`
 *    reaches us as `%2e%2e`, which WHATWG URL treats as `..`), `/` (`%2f`
 *    decoded), `\` (`%5c` decoded), a NUL or a control character;
 *  - then percent-encoded for the path (spaces, `?`, `#` cannot cut it short).
 * And the result must sit on the gateway's own origin with a pathname that
 * starts with `/v1/` and equals exactly what was built (no normalisation).
 *
 * Pure and alias-free on purpose: real unit tests import it (vitest has no `@`
 * alias). Byte-equal twins in `apps/{dashboard,admin,landing}/src/lib/upstream-path.ts`.
 */

export type UpstreamUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

// Control characters (C0 + DEL), checked by char code to keep this file free of
// regex escapes a guard could misread.
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Why a browser-supplied path segment (decoded once, as Next hands it) may not
 * be forwarded, or null when it may.
 */
export function pathSegmentRefusal(segment: string): string | null {
  if (typeof segment !== "string" || segment.length === 0) return "empty segment";
  if (segment === "." || segment === "..") return "dot segment";
  if (segment.includes("%")) return "percent sign after decoding";
  if (segment.includes("/")) return "encoded slash";
  if (segment.includes("\\")) return "backslash";
  if (hasControlChar(segment)) return "control character";
  return null;
}

// RFC 3986 pchar keeps these literal; encodeURIComponent would escape some of
// them, and the gateway's routes were written against the literal form.
const KEEP_LITERAL: Record<string, string> = {
  "%3A": ":",
  "%40": "@",
  "%2C": ",",
  "%3B": ";",
  "%3D": "=",
  "%2B": "+",
  "%24": "$",
  "%26": "&",
};

/** One safe segment, percent-encoded for a URL path (a `%` becomes `%25`). */
export function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /%3A|%40|%2C|%3B|%3D|%2B|%24|%26/g,
    (escape) => KEEP_LITERAL[escape] ?? escape,
  );
}

/**
 * `${apiBase}/v1/<segments>` with the browser's query string, or the reason it
 * is refused. The caller answers a refusal with a 400 and forwards nothing.
 */
export function upstreamV1Url(
  apiBase: string,
  segments: readonly string[] | undefined,
  searchParams?: URLSearchParams,
): UpstreamUrlResult {
  if (!Array.isArray(segments) || segments.length === 0) {
    return { ok: false, reason: "empty path" };
  }
  const encoded: string[] = [];
  for (const segment of segments) {
    const refusal = pathSegmentRefusal(segment);
    if (refusal) return { ok: false, reason: refusal };
    encoded.push(encodePathSegment(segment));
  }

  const base = new URL(apiBase);
  const pathname = `/v1/${encoded.join("/")}`;
  const url = new URL(base.origin);
  url.pathname = pathname;
  searchParams?.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  // Belt and braces: the URL we fetch is on the gateway's origin, under /v1/,
  // and exactly the path we built (no dot-segment or slash normalisation).
  if (url.origin !== base.origin) return { ok: false, reason: "foreign origin" };
  if (!url.pathname.startsWith("/v1/")) return { ok: false, reason: "outside /v1" };
  if (url.pathname !== pathname) return { ok: false, reason: "path normalised" };
  return { ok: true, url };
}
