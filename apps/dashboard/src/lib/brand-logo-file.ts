/**
 * What a brand logo may be, and what a person is told when their file is not it.
 *
 * A LOGO IS UPLOADED, NEVER LINKED. A URL somebody pastes points at a file we do
 * not hold: it can move, expire, or start refusing hotlinks months later, and the
 * brand then wears a broken image on every surface with nothing in our own logs to
 * say what changed. So this module governs a FILE the customer picks, which we put
 * on our own storage before anything references it.
 *
 * Every refusal happens BEFORE the upload, because the honest moment to say "this
 * will not work" is while the person still has the file in front of them — not
 * after a round trip, and never on the dashboard of whoever looks at the brand next.
 *
 * Alias-free on purpose so vitest can run it directly (the `@` alias is not
 * resolved in this repo — see CLAUDE.md). Keep it that way.
 */

/**
 * The formats a browser draws predictably at favicon size AND inside a 224px
 * sidebar rail.
 *
 * SVG is deliberately absent, and not for the email reason its sibling
 * `investor-update-html` gives: an SVG is a document that can carry script and
 * external references, and this one is uploaded by a customer and then rendered
 * on OUR origin. A raster file cannot do that. WebP is absent because the tab
 * favicon is set by handing the browser a URL, and Safari's favicon path has
 * historically been the least forgiving surface in the product for a format
 * choice — the gain over PNG is bytes we are not short of.
 */
export const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/gif"] as const;

/** What the file picker offers, derived from the one catalogue above. */
export const LOGO_FILE_ACCEPT = ACCEPTED_LOGO_TYPES.join(",");

/**
 * 2MB. A logo is drawn at 16px in a tab and 24px in the rail, so anything past
 * this is a photograph somebody picked by mistake — and the base64 body rides
 * through a gateway that stops at 10MB, which base64 reaches at ~7.5MB of file.
 * Refusing early names the real problem instead of surfacing a 413.
 */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** The cap, as a person reads it: "2MB", not 2097152. */
function capMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
}

/**
 * The file's size, rounded UP.
 *
 * Rounding to nearest makes a file one byte over the cap read as exactly the cap,
 * so the refusal says "that file is 2MB, it has to be under 2MB" — a sentence that
 * reads as a bug in us rather than a fact about their file. Ceiling guarantees the
 * two numbers differ whenever the file is genuinely over, which is the only case
 * this is ever printed in.
 */
function overMb(bytes: number): string {
  return `${Math.ceil((bytes / (1024 * 1024)) * 10) / 10}MB`;
}

/**
 * Why this file cannot be a logo, or null when it can be.
 *
 * Returns the SENTENCE, not a code: there is exactly one surface, and a code
 * would be a lookup table with one reader. Every branch names the file's own
 * problem so the person knows what to pick instead.
 */
export function logoFileProblem(file: { type: string; size: number; name: string }): string | null {
  if (!(ACCEPTED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    // Name what they gave us: "that file" leaves them guessing which of the two
    // rules they broke when the file is both an SVG and large.
    const gave = file.type || "that file type";
    return `${gave} can't be used as a logo. Upload a PNG, JPEG or GIF.`;
  }
  if (file.size > MAX_LOGO_BYTES) {
    return `That file is ${overMb(file.size)}. A logo has to be under ${capMb(MAX_LOGO_BYTES)}.`;
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}

/**
 * Why this URL cannot be stored as a logo, or null when it can be.
 *
 * Checked on the URL that came BACK from storage, not on one anybody typed: the
 * public host is resolved at upload time, so a misconfiguration surfaces here as
 * an unusable link rather than as a broken picture on a customer's dashboard a
 * week later. https because the value is rendered as an `<img>` on an https page,
 * where a browser refuses to draw an http source — the producer refuses it too,
 * and catching it here means we never send a request we know will fail.
 */
export function logoUrlProblem(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Storage did not return a usable link for that file.";
  }
  if (parsed.protocol !== "https:") {
    return "Storage returned a link that browsers will not load.";
  }
  return null;
}

/**
 * The folder every brand logo lands in.
 *
 * One prefix so the bucket stays greppable — a file whose key says what it is can
 * be found again by somebody who was not here when it was uploaded.
 */
export const BRAND_LOGO_FOLDER = "brand-logos";

/**
 * A storage key that is safe in a URL and still says which brand it belongs to.
 *
 * The customer's own filename is DROPPED rather than sanitized: it becomes part of
 * a public URL, macOS names every screenshot with spaces and colons, and the name
 * carries nothing a reader needs — the brand id does. The extension is kept from
 * the MIME type, not from the filename, because that is the byte-level truth.
 */
export function brandLogoFilename(brandId: string, contentType: string): string {
  const ext =
    contentType === "image/png" ? "png" : contentType === "image/gif" ? "gif" : "jpg";
  // A cache-buster in the NAME, not the query: the URL is stored and later handed
  // to a browser as a favicon, and a favicon URL that differs only by query string
  // is one browsers have historically been happy to serve from cache forever.
  return `${brandId}-${Date.now()}.${ext}`;
}
