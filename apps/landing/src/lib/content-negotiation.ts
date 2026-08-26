/**
 * Accept-header content negotiation for the statically-served landing pages.
 *
 * Agents ask for `text/markdown`; browsers ask for `text/html`. Both hit the
 * same URL, so the variant is chosen from the request's `Accept` header per
 * RFC 9110 section 12.5.1 and https://acceptmarkdown.com. This module is pure
 * and alias-free so it carries real unit tests.
 *
 * Every negotiated response MUST carry `Vary: Accept` — see VARY_HEADER below.
 */

export type NegotiatedType = "html" | "markdown" | "unsupported";

/**
 * A response whose body depends on `Accept` is uncacheable by a shared cache
 * unless the cache is told so. `Accept-Encoding` was always implied by the
 * compression layer; naming both keeps one header honest about the whole key.
 */
export const VARY_HEADER = "Accept, Accept-Encoding";

export const HTML_CONTENT_TYPE = "text/html; charset=utf-8";
export const MARKDOWN_CONTENT_TYPE = "text/markdown; charset=utf-8";

/** Media types that resolve to the markdown variant. */
const MARKDOWN_TYPES = ["text/markdown", "text/x-markdown"];
/**
 * Media types that resolve to the unchanged HTML document.
 *
 * Only `text/html`, deliberately. The response is labelled `text/html`, so a
 * client that writes `text/html;q=0` has refused this variant even when it also
 * sends a wildcard; crediting the wildcard through an alias like
 * `application/xhtml+xml` would serve the exact bytes it said no to.
 */
const HTML_TYPES = ["text/html"];

interface MediaRange {
  type: string;
  subtype: string;
  q: number;
}

function parseQ(params: string[]): number {
  for (const raw of params) {
    const [name, value] = raw.split("=");
    if (name?.trim().toLowerCase() !== "q") continue;
    const parsed = Number.parseFloat((value ?? "").trim());
    if (!Number.isFinite(parsed)) return 1;
    // RFC 9110: q is bounded to [0, 1].
    return Math.min(Math.max(parsed, 0), 1);
  }
  return 1;
}

export function parseAcceptHeader(header: string | null | undefined): MediaRange[] {
  if (!header) return [];
  const ranges: MediaRange[] = [];
  for (const entry of header.split(",")) {
    const [rawType, ...params] = entry.split(";");
    const token = (rawType ?? "").trim().toLowerCase();
    if (!token) continue;
    const [type, subtype] = token.split("/");
    if (!type || !subtype) continue;
    ranges.push({ type, subtype, q: parseQ(params) });
  }
  return ranges;
}

// Specificity, so a precise range beats a wildcard at the same q — which is
// what makes `Accept: text/html;q=0, */*` mean "anything but HTML" rather than
// "HTML is fine". 2 = exact type, 1 = `type/*`, 0 = `*/*`, -1 = no match.
function specificity(range: MediaRange, mediaType: string): number {
  const [type, subtype] = mediaType.split("/");
  if (range.type === type && range.subtype === subtype) return 2;
  if (range.type === type && range.subtype === "*") return 1;
  if (range.type === "*" && range.subtype === "*") return 0;
  return -1;
}

/** The q the client assigned to `mediaType`, taking the most specific range. */
function qualityFor(ranges: MediaRange[], mediaType: string): number {
  let bestSpecificity = -1;
  let q = 0;
  for (const range of ranges) {
    const score = specificity(range, mediaType);
    if (score <= bestSpecificity) continue;
    bestSpecificity = score;
    q = range.q;
  }
  return q;
}

function bestQuality(ranges: MediaRange[], mediaTypes: string[]): number {
  return mediaTypes.reduce((best, type) => Math.max(best, qualityFor(ranges, type)), 0);
}

/**
 * Absent or empty `Accept` means "no preference", which is HTML — a browser
 * that sends nothing must be byte-unchanged from before negotiation existed.
 */
export function negotiateContentType(accept: string | null | undefined): NegotiatedType {
  const ranges = parseAcceptHeader(accept);
  if (ranges.length === 0) return "html";

  const markdownQ = bestQuality(ranges, MARKDOWN_TYPES);
  const htmlQ = bestQuality(ranges, HTML_TYPES);

  if (markdownQ === 0 && htmlQ === 0) return "unsupported";
  // Tie goes to HTML: a browser sends `text/html,...,*/*;q=0.8`, and a human
  // must never be handed markdown by accident.
  return markdownQ > htmlQ ? "markdown" : "html";
}

/** Body for the 406, listing what this URL can actually produce. */
export function notAcceptableBody(): string {
  return [
    "406 Not Acceptable",
    "",
    "This URL can be served as:",
    `  ${HTML_CONTENT_TYPE}`,
    `  ${MARKDOWN_CONTENT_TYPE}`,
    "",
    "Send an Accept header naming one of them.",
  ].join("\n");
}
