/**
 * Which view a STAFF reader has picked on Research and Monitoring (MATURITY-VIEW-1023, owner
 * 2026-10-23 « tous ces graphes, tables, stats en deux versions… un toggle mature / flash »):
 *
 *   mature (the default, and the only view a non-staff reader ever gets): only people we started
 *          writing to long enough ago for their replies to arrive (features-service's maturity rule)
 *   flash:  everything to date, recent replies still on their way
 *
 * One cookie, so the choice follows the reader across every Research and Monitoring page and tab:
 * two pages never show two numbers for the same thing. It only SELECTS which build features-service
 * serves (`view=`); the browser computes nothing. Alias-free so it carries real unit tests.
 */
export type MaturityView = "mature" | "flash";

export const MATURITY_VIEW_COOKIE = "distribute-maturity-view";
/** A year: a staff preference, not a session fact. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Reads the view out of a `document.cookie` string. Anything but `flash` reads as `mature`. */
export function maturityViewFromCookie(cookie: string | null | undefined): MaturityView {
  if (!cookie) return "mature";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === MATURITY_VIEW_COOKIE) return v.join("=") === "flash" ? "flash" : "mature";
  }
  return "mature";
}

/** The `document.cookie` assignment that stores a view. */
export function maturityViewCookieAssignment(view: MaturityView): string {
  return `${MATURITY_VIEW_COOKIE}=${view}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}

/**
 * The `view` query param a Research read carries: `mature` when absent (features-service's own
 * default), null for anything else (the route answers 400 `view_unrecognised`, never a guess).
 */
export function parseMaturityView(raw: string | null): MaturityView | null {
  if (raw === null) return "mature";
  return raw === "mature" || raw === "flash" ? raw : null;
}
