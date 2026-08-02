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
 * A readable description taken from the file's own name, used when the author
 * did not write one.
 *
 * Alt text is not decoration here: Gmail and Outlook block remote images by
 * default on a first message from an unknown sender, so this is frequently the
 * only thing an investor sees where the picture should be. `null` would leave
 * that space blank, and the filename is at least what the author called it.
 */
export function imageAltFromFilename(filename: string): string {
  const stem = filename.replace(/\.[^./\\]+$/, "");
  const words = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return words.length > 0 ? words : "Image";
}

/**
 * The formats a mail client will actually draw. An email client is not a
 * browser and the difference is not cosmetic — a picture that renders perfectly
 * in the composer's preview can arrive as a broken-image placeholder in the
 * inbox, and by then the update has been sent to everyone.
 *
 * WebP is deliberately absent: Gmail draws it, Outlook on Windows renders the
 * message through Word and does not.
 */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"] as const;

/**
 * The file input's `accept`, from the one list above so the picker and the gate
 * can never disagree about what is allowed.
 */
export const ACCEPTED_IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

/**
 * Bigger than this and the image is the update. Mail clients clip a heavy
 * message (Gmail cuts at 102KB of HTML and hides the rest behind "View entire
 * message"), and the picture is fetched from R2 rather than inlined, so the
 * cap is about the recipient's patience and our storage, not the HTML size.
 */
export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Why a picked file cannot go in an email, or null when it can. Runs BEFORE the
 * upload, so a file that could never work never reaches R2.
 *
 * - **SVG is refused by Gmail, Outlook and Yahoo.** It renders in the preview
 *   (a browser) and shows the alt text in the inbox. This is the one that
 *   actually bit us: a verification send used an SVG logo and landed broken.
 *   Checked by name as well as type, because a file dragged in from some
 *   sources arrives with an empty `type`.
 * - **An empty file** uploads fine and draws nothing.
 */
export function imageFileProblem(
  file: { name: string; type: string; size: number } | null
): string | null {
  if (!file) return "Choose an image.";

  const name = file.name.toLowerCase();
  if (file.type === "image/svg+xml" || name.endsWith(".svg")) {
    return "Gmail, Outlook and Yahoo do not render SVG in email. Use a PNG or JPG.";
  }
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Use a PNG, JPG or GIF — those are what mail clients draw.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `That image is ${mb} MB. Keep it under 5 MB.`;
  }
  return null;
}

/**
 * Why an image URL cannot go in an email, or null when it can.
 *
 * Nobody types a URL here any more — the composer uploads the file and this
 * judges the URL that came BACK. That is not redundant with the file gate: the
 * public domain the storage service builds the URL from is resolved at upload
 * time from key-service, so a misconfiguration surfaces here as an `http://` or
 * otherwise unusable link rather than as a broken picture in 40 inboxes.
 *
 * - **A relative URL has nothing to resolve against** once the HTML is inside a
 *   mail client, so it can only ever break.
 * - **`http://` is downgraded or blocked** by most clients on a page they are
 *   already treating as untrusted.
 * - **A data URI is stripped** by Gmail outright.
 */
export function imageUrlProblem(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (url.length === 0) return "That upload came back without a URL.";

  if (url.startsWith("data:")) {
    return "Gmail strips embedded images. That upload did not produce a hosted link.";
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
 *
 * `pendingImageName` is a file the author picked that is NOT in the body: it is
 * still uploading, or its upload failed. Sending then mails an update the
 * author believes carries a picture, and nothing on screen says otherwise —
 * a form holding an image and an email going out without it are the same
 * surface contradicting itself. This is the exact way the first real send lost
 * its image, so the send waits rather than the author finding out afterwards.
 */
export function investorUpdateBlocker(
  subject: string,
  markdown: string,
  pendingImageName: string | null = null
): string | null {
  if (subject.trim().length === 0) return "Add a subject.";
  if (markdown.trim().length === 0) return "Write the update.";
  if (pendingImageName !== null && pendingImageName.trim().length > 0) {
    return `${pendingImageName.trim()} is not in the update yet. Wait for it, or clear the file.`;
  }
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
