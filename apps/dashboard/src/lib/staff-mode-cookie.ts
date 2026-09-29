/**
 * Whether a STAFF reader is looking at the dashboard in staff mode (their admin world:
 * every staff-only surface shown, the workflows, models and templates under a mission,
 * the investigation switches) or in the customer's world (exactly what a client sees).
 *
 * Stored in a cookie so the choice follows the reader across every page and tab. It is a
 * PREFERENCE, never an authorisation: `useStaffMode` reads it only for an email on the
 * staff allowlist, so a customer who sets it by hand sees nothing more.
 *
 * Absent reads as ON: turning it on is how staff worked before the switch existed, so a
 * staff reader loses nothing until they flip it.
 *
 * Alias-free so it carries real unit tests.
 */
export const STAFF_MODE_COOKIE = "distribute-staff-mode";
/** A year: a staff preference, not a session fact. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Reads the mode out of a `document.cookie` string. Only an explicit `off` turns it off. */
export function staffModeFromCookie(cookie: string | null | undefined): boolean {
  if (!cookie) return true;
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === STAFF_MODE_COOKIE) return v.join("=") !== "off";
  }
  return true;
}

/** The `document.cookie` assignment that stores the mode. */
export function staffModeCookieAssignment(on: boolean): string {
  return `${STAFF_MODE_COOKIE}=${on ? "on" : "off"}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
