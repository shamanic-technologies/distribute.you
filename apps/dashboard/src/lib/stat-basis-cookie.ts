/**
 * Which half of a served maturity pair a STAFF reader has picked (lib/maturity.ts).
 * `mature` (the default, and the only basis a customer ever gets) is the figure every
 * customer reads; `flash` is today's raw figure, for debugging a Learning tag or a price
 * that moved.
 *
 * Stored in a cookie rather than in page state so the choice follows the reader across
 * every page and tab that states a ratio, exactly as the cost-basis switch does. It is a
 * PREFERENCE, never an authorisation: a non-staff reader is forced to `mature` by the
 * hook whatever this cookie says, and both halves are served to everyone anyway.
 *
 * Alias-free so it carries real unit tests.
 */
import type { StatBasis } from "./maturity";

export const STAT_BASIS_COOKIE = "distribute-stat-basis";
/** A year: a staff preference, not a session fact. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Reads the basis out of a `document.cookie` string. Anything but `flash` reads as `mature`. */
export function statBasisFromCookie(cookie: string | null | undefined): StatBasis {
  if (!cookie) return "mature";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === STAT_BASIS_COOKIE) return v.join("=") === "flash" ? "flash" : "mature";
  }
  return "mature";
}

/** The `document.cookie` assignment that stores a basis. */
export function statBasisCookieAssignment(basis: StatBasis): string {
  return `${STAT_BASIS_COOKIE}=${basis}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
