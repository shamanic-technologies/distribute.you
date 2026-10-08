/**
 * Which half of a served maturity pair a STAFF reader has picked (lib/maturity.ts).
 * `auto` (the default, and the only choice a customer ever gets) reads the half with the
 * higher return; `mature` / `flash` pin one half, for debugging a Learning tag or a price
 * that moved.
 *
 * Stored in a cookie rather than in page state so the choice follows the reader across
 * every page and tab that states a ratio, exactly as the cost-basis switch does. It is a
 * PREFERENCE, never an authorisation: a non-staff reader is forced to `auto` by the
 * hook whatever this cookie says, and both halves are served to everyone anyway.
 *
 * Alias-free so it carries real unit tests.
 */
import type { StatBasisChoice } from "./maturity";

export const STAT_BASIS_COOKIE = "distribute-stat-basis";
/** A year: a staff preference, not a session fact. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Reads the choice out of a `document.cookie` string. Anything but `flash` / `mature` reads as `auto`. */
export function statBasisFromCookie(cookie: string | null | undefined): StatBasisChoice {
  if (!cookie) return "auto";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k !== STAT_BASIS_COOKIE) continue;
    const value = v.join("=");
    return value === "flash" || value === "mature" ? value : "auto";
  }
  return "auto";
}

/** The `document.cookie` assignment that stores a choice. */
export function statBasisCookieAssignment(basis: StatBasisChoice): string {
  return `${STAT_BASIS_COOKIE}=${basis}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
