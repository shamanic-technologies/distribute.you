/**
 * Turning a composed investor update into the HTML that is actually sent.
 *
 * Alias-free on purpose (no `@/…` imports) so vitest can resolve it and these
 * helpers get REAL unit tests rather than source-substring guards.
 *
 * Two things drive every decision here:
 *
 * 1. **Gmail strips `<style>` and `<head>`.** A stylesheet renders in the
 *    preview pane of a browser and vanishes in the client the investor is
 *    actually reading in, so every rule is inlined on the element. This is why
 *    the markdown output is post-processed rather than wrapped in a class.
 *
 * 2. **The preview must be the email.** The composer renders the SAME string it
 *    sends — a preview built from a different code path is a surface that can
 *    disagree with what lands in the inbox, which is the incoherence this repo
 *    treats as a bug. So this is the one renderer, used by both.
 */

import { markdownToHtml } from "./markdown-to-html";

/**
 * Inline style per tag. Values are conservative on purpose: no flexbox, no
 * grid, no custom properties, nothing an older client silently drops.
 */
const INLINE_STYLES: Record<string, string> = {
  h1: "margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:#111827",
  h2: "margin:28px 0 12px;font-size:19px;line-height:1.35;font-weight:700;color:#111827",
  h3: "margin:24px 0 10px;font-size:16px;line-height:1.4;font-weight:600;color:#111827",
  h4: "margin:20px 0 8px;font-size:15px;line-height:1.4;font-weight:600;color:#111827",
  h5: "margin:20px 0 8px;font-size:14px;line-height:1.4;font-weight:600;color:#111827",
  h6: "margin:20px 0 8px;font-size:13px;line-height:1.4;font-weight:600;color:#111827",
  p: "margin:0 0 16px;font-size:15px;line-height:1.65;color:#374151",
  ul: "margin:0 0 16px;padding-left:22px;font-size:15px;line-height:1.65;color:#374151",
  ol: "margin:0 0 16px;padding-left:22px;font-size:15px;line-height:1.65;color:#374151",
  li: "margin:0 0 6px",
  a: "color:#2563eb;text-decoration:underline",
  blockquote:
    "margin:0 0 16px;padding:12px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:15px;line-height:1.6;color:#4b5563",
  img: "max-width:100%;height:auto;border-radius:6px;margin:8px 0 20px;display:block",
  hr: "border:none;border-top:1px solid #e5e7eb;margin:28px 0",
  table: "width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14px",
  th: "border:1px solid #e5e7eb;padding:8px 12px;text-align:left;background:#f9fafb;font-weight:600;color:#111827",
  td: "border:1px solid #e5e7eb;padding:8px 12px;text-align:left;color:#374151",
  pre: "margin:0 0 16px;padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;overflow:auto;font-size:13px",
  code: "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px",
  strong: "font-weight:700;color:#111827",
  em: "font-style:italic",
};

/**
 * Push the style onto each opening tag. Only tags this renderer itself emits
 * are touched, and an element that already carries a `style` is left alone so
 * a hand-written one wins.
 */
function inlineStyles(html: string): string {
  let out = html;
  for (const [tag, style] of Object.entries(INLINE_STYLES)) {
    const re = new RegExp(`<${tag}(\\s[^>]*)?>`, "gi");
    out = out.replace(re, (match, attrs: string | undefined) => {
      const existing = attrs ?? "";
      if (/\sstyle\s*=/.test(existing)) return match;
      const selfClosing = /\/>$/.test(match);
      const tail = selfClosing ? " />" : ">";
      return `<${tag}${existing.replace(/\s*\/?>?$/, "")} style="${style}"${tail}`;
    });
  }
  return out;
}

/**
 * `{{{ pm:unsubscribe }}}` is Postmark's own token. On a broadcast stream it is
 * replaced with a per-recipient opt-out URL, which is what makes the link in the
 * footer real rather than decorative — and it is per-recipient, which is only
 * possible because the update is sent one message per person rather than as one
 * BCC blast.
 *
 * The composer does NOT let the author write this footer; it is appended here so
 * every update carries one and no update can ship without it.
 */
export const UNSUBSCRIBE_TOKEN = "{{{ pm:unsubscribe }}}";

/** Quiet, small, grey. It has to be findable, not prominent. */
function footerHtml(): string {
  return [
    '<div style="margin:36px 0 0;padding:16px 0 0;border-top:1px solid #e5e7eb">',
    '<p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af">',
    "You are receiving this because you are an investor in distribute.",
    ` <a href="${UNSUBSCRIBE_TOKEN}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>.`,
    "</p>",
    "</div>",
  ].join("");
}

/**
 * A markdown image line for the composer's "add an image" affordance. Kept here
 * so the composer never hand-assembles markdown syntax.
 */
export function imageMarkdown(url: string, alt: string): string {
  return `![${alt.trim()}](${url.trim()})`;
}

/**
 * Why an image URL cannot go in an email, or null when it can.
 *
 * An email client is not a browser and the difference is not cosmetic — a URL
 * that renders perfectly in the composer's preview can arrive as a broken-image
 * placeholder in the inbox, and by then the update has been sent to everyone.
 * So the rules are the recipients' constraints, not ours:
 *
 * - **SVG is refused by Gmail, Outlook and Yahoo.** It renders in the preview
 *   (a browser) and shows the alt text in the inbox. This is the one that
 *   actually bit us: a verification send used an SVG logo and landed broken.
 * - **A relative URL has nothing to resolve against** once the HTML is inside a
 *   mail client, so it can only ever break.
 * - **`http://` is downgraded or blocked** by most clients on a page they are
 *   already treating as untrusted.
 * - **A data URI is stripped** by Gmail outright.
 */
export function imageUrlProblem(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (url.length === 0) return "Paste an image URL.";

  if (url.startsWith("data:")) {
    return "Gmail strips embedded images. Host it somewhere and paste the link.";
  }
  if (!/^https?:\/\//i.test(url)) {
    return "Use a full https:// link — a relative path cannot resolve inside an email.";
  }
  if (/^http:\/\//i.test(url)) {
    return "Use https:// — mail clients block plain http images.";
  }

  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return "That is not a valid URL.";
  }

  if (path.endsWith(".svg")) {
    return "Gmail, Outlook and Yahoo do not render SVG in email. Use a PNG or JPG.";
  }
  return null;
}

/**
 * The full document. A single centred column at 640px — the width every email
 * client renders without horizontal scroll on a phone.
 */
export function renderInvestorUpdateHtml(markdown: string): string {
  const body = inlineStyles(markdownToHtml(markdown));
  return [
    '<div style="margin:0;padding:24px 12px;background:#f3f4f6">',
    '<div style="max-width:640px;margin:0 auto;padding:32px;background:#ffffff;border-radius:10px;',
    'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif">',
    body,
    footerHtml(),
    "</div>",
    "</div>",
  ].join("");
}

/**
 * Plain-text alternative. Every broadcast should carry one: a text part lifts
 * deliverability and is what a screen reader or a text-only client shows.
 */
export function renderInvestorUpdateText(markdown: string): string {
  const text = markdown
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) => (alt.trim() ? `${alt} (${url})` : url))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return `${text}\n\n—\nYou are receiving this because you are an investor in distribute.\nUnsubscribe: ${UNSUBSCRIBE_TOKEN}\n`;
}

/**
 * What stops a half-written update going out. Returns the reason, or null when
 * the update is sendable.
 */
export function investorUpdateBlocker(subject: string, markdown: string): string | null {
  if (subject.trim().length === 0) return "Add a subject.";
  if (markdown.trim().length === 0) return "Write the update.";
  return null;
}
