/**
 * The Google Ads click id, read off the `_gcl_aw` cookie the Google tag's
 * conversion linker writes on `.distribute.you` when a visitor arrives from an ad.
 *
 * Format is `GCL.<unix-seconds>.<gclid>`. The gclid is what an offline conversion
 * upload is keyed on: Google matches it back to the click, the campaign and the
 * keyword, which is how a signup that happened on the dashboard (a different
 * subdomain, often minutes and a Clerk redirect later) gets attributed to the ad
 * that produced it. The cookie is the only carrier that survives that trip —
 * the `gclid` query param is gone by the time the dashboard renders.
 *
 * Alias-free on purpose so it carries real unit tests.
 */
const GCL_AW_RE = /(?:^|;\s*)_gcl_aw=GCL\.(\d+)\.([A-Za-z0-9_-]+)/;

export interface GclidCookie {
  gclid: string;
  /** When the click happened, per the cookie's own timestamp (unix seconds). */
  clickedAt: Date;
}

/** Parse `document.cookie`; null when no Google Ads click is recorded. */
export function gclidFromCookie(cookie: string): GclidCookie | null {
  const m = GCL_AW_RE.exec(cookie);
  if (!m) return null;
  const seconds = Number(m[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return { gclid: m[2], clickedAt: new Date(seconds * 1000) };
}

/** A gclid is an opaque base64url-ish token; anything else is not one. */
export function isPlausibleGclid(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,200}$/.test(value);
}
