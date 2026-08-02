/**
 * Email HTML, made safe to render without changing how it looks.
 *
 * Two surfaces render mail we did not author the markup of: the CRM inbox panel
 * (a customer's Gmail message) and the investor-update preview (our own send,
 * rendered by transactional-email-service). Both need the same guarantee, so
 * they share one allowlist rather than each keeping its own — two sanitizers
 * for one job is how one surface silently starts stripping what the other keeps.
 */

import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

/**
 * `align`, `bgcolor`, `border`, `cellpadding`, `cellspacing` and `valign` are
 * presentational attributes nobody writes on a web page any more, and they are
 * exactly how email lays itself out — Outlook's engine honours them where it
 * ignores CSS. Stripping them does not make the markup safer, it makes the
 * rendering wrong: our own investor update centres its card with a single
 * `align="center"`, so without it the preview shows a left-hugging column that
 * no recipient will ever see. `role` goes with them so a presentation table is
 * not announced as data to a screen reader.
 */
const ALLOWED_ATTR = [
  "href",
  "src",
  "alt",
  "title",
  "style",
  "colspan",
  "rowspan",
  "width",
  "height",
  "align",
  "bgcolor",
  "border",
  "cellpadding",
  "cellspacing",
  "role",
  "valign",
];

const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|cid|data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml)):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

export function sanitizeEmailHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "link", "style", "meta"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "onchange", "onsubmit"],
  });
}
