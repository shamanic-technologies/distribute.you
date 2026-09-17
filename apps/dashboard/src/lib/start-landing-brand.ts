// THE BRAND A VISITOR NAMED ON THE LANDING, read back on the screens before signup.
//
// The landing's hero form submits to `/start?url=`, and the root layout parks that
// value in the landing-url cookie because a query param does not survive the Clerk
// redirect. The signed-out screens read that cookie and show the site's own logo
// and host at the top of every step: somebody who typed their website ten seconds
// ago should see that we heard it, not a generic form.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

import { readLandingUrlCookie } from "./landing-url-cookie";

export interface LandingBrand {
  /** The absolute URL as stored. */
  url: string;
  /** The bare host, `www.` stripped, which is what the visitor reads and what
   *  logo.dev is keyed on. */
  host: string;
}

/**
 * The brand the landing named, or null when the visitor arrived with no
 * website (a plain CTA click, or a value the landing refused to store).
 *
 * Absent is the ORDINARY case and renders nothing: a guessed logo is worse than
 * none, so nothing here derives a host from anything but the stored URL.
 */
export function landingBrandFromCookie(cookieHeader: string | null | undefined): LandingBrand | null {
  const url = readLandingUrlCookie(cookieHeader);
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host) return null;
    return { url, host };
  } catch {
    // The cookie holds a value `normalizeLandingUrl` produced, so this cannot
    // happen for a cookie we wrote; a hand-edited one is simply "no brand".
    return null;
  }
}
