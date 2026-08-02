/**
 * Authoring an investor update: what can go in it, and what stops it going out.
 *
 * Alias-free on purpose (no `@/…` imports) so vitest can resolve it and these
 * helpers get REAL unit tests rather than source-substring guards.
 *
 * **Nothing here renders anything.** transactional-email-service takes the
 * markdown and renders it, email-gateway appends the unsubscribe footer, and
 * the preview asks the producer for the very same HTML a send produces
 * (`previewMailingListUpdate`).
 *
 * There WAS a renderer here, and it is the reason this note exists: it started
 * byte-equal to the producer's, the producer then grew a full inline-styled
 * email renderer, and this copy never followed. For months the console showed
 * bare markup while investors received a laid-out email, and nobody noticed
 * until someone looked at the screen. Any second rendering drifts the same way.
 * Do not add one back.
 */

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
 * What stops a half-written update going out. Returns the reason, or null when
 * the update is sendable.
 */
export function investorUpdateBlocker(subject: string, markdown: string): string | null {
  if (subject.trim().length === 0) return "Add a subject.";
  if (markdown.trim().length === 0) return "Write the update.";
  return null;
}

/**
 * Shown beside the preview rather than rendered into it. email-gateway appends
 * the real footer at send time, so drawing one here would be inventing markup
 * the author cannot influence — but omitting any mention of it would let the
 * preview imply the update goes out without an opt-out.
 */
export const UNSUBSCRIBE_PREVIEW_NOTE =
  "A discreet unsubscribe is appended when this goes out, resolved per recipient by the provider.";
