/**
 * Which cost basis a STAFF reader has picked on the v2 cost surfaces (Research, Workflows, a
 * Workflow page). `user` (the default, and the only basis a non-staff reader ever gets) is what
 * clients are billed; `actual` is what the vendors charged us before our markup.
 *
 * Stored in a cookie rather than in page state so the choice follows the reader across every
 * page and every tab that shows costs: flipping it on the Workflows list keeps it on the
 * Workflow page and on Research. It is a PREFERENCE, never an authorisation: every actual-cost
 * read is refused server-side to a non-staff caller whatever this cookie says.
 *
 * Alias-free so it carries real unit tests.
 */
export type CostBasis = "user" | "actual";

export const COST_BASIS_COOKIE = "distribute-cost-basis";
/** A year: a staff preference, not a session fact. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Reads the basis out of a `document.cookie` string. Anything but `actual` reads as `user`. */
export function costBasisFromCookie(cookie: string | null | undefined): CostBasis {
  if (!cookie) return "user";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COST_BASIS_COOKIE) return v.join("=") === "actual" ? "actual" : "user";
  }
  return "user";
}

/** The `document.cookie` assignment that stores a basis. */
export function costBasisCookieAssignment(basis: CostBasis): string {
  return `${COST_BASIS_COOKIE}=${basis}; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
