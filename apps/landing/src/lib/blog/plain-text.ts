/**
 * An article body as plain text, for a backend READER (social-service's writer reads our
 * articles before it comments). Not a renderer: tags out, block ends become line breaks,
 * scripts/styles/JSON-LD dropped, the few entities our articles use decoded.
 *
 * Alias-free and dependency-free so it carries real unit tests.
 */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&hellip;": "…",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|table|section|article|blockquote|figure|figcaption|summary|details|ul|ol)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;|&#39;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The text of an article: its markdown when it has one, else its HTML stripped. */
export function articleText(a: { contentMarkdown: string | null; contentHtml: string | null }): string {
  if (a.contentMarkdown && a.contentMarkdown.trim() !== "") return a.contentMarkdown.trim();
  if (a.contentHtml && a.contentHtml.trim() !== "") return htmlToText(a.contentHtml);
  return "";
}
