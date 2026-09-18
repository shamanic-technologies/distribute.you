/**
 * Where the anonymous session's token lives on the browser.
 *
 * `httpOnly`, which is the OPPOSITE of the landing-url cookie beside it, and the
 * difference is the point: that one carries a value the browser itself learned
 * (the website somebody typed), this one carries a CREDENTIAL the server minted.
 * Client JavaScript has no business reading it, and a `document.cookie` read is
 * the shape an XSS uses to lift a session.
 *
 * `SameSite=Lax` rather than `Strict`: the visitor leaves for Clerk's hosted
 * signup and comes back, and `Strict` drops the cookie on that return — which
 * would silently orphan the org they just spent ten minutes filling in.
 *
 * Alias-free so it carries real unit tests; keep it that way.
 */

import { ANON_SESSION_MAX_AGE_SECONDS } from "./anon-session-token";

export const ANON_SESSION_COOKIE = "distribute_anon_session";

/**
 * The companion FLAG the browser is allowed to read.
 *
 * The session cookie is httpOnly, which is what keeps it out of reach of
 * script — and also out of reach of our own api client, which has to know
 * whether to call the authed gateway or the anonymous one. So a second cookie
 * carries the one bit that decision needs and NOTHING else: it holds no token,
 * no org id, and forging it buys nothing (the anonymous proxy still verifies
 * the signed cookie and answers 401 without it).
 *
 * Set and cleared in lockstep with the session. A browser holding the flag and
 * no session gets one 401, which clears both.
 */
export const ANON_FLAG_COOKIE = "distribute_anon";

export interface AnonCookieOptions {
  /** False on localhost, where `Secure` would make the cookie unsettable. */
  secure: boolean;
}

/** The `Set-Cookie` value that stores a token. */
export function anonSessionCookie(token: string, { secure }: AnonCookieOptions): string {
  const parts = [
    `${ANON_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "path=/",
    `max-age=${ANON_SESSION_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * The `Set-Cookie` value that CLEARS it.
 *
 * Fired the moment the session is claimed: past that point the org belongs to a
 * signed-in person and the anonymous token is a second way into it, which is a
 * credential nobody needs any more. Also fired on a refused token, so a browser
 * holding a stale one stops sending it on every request.
 */
export function clearAnonSessionCookie({ secure }: AnonCookieOptions): string {
  const parts = [
    `${ANON_SESSION_COOKIE}=`,
    "path=/",
    "max-age=0",
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** The readable flag, set beside the session so the api client can route. */
export function anonFlagCookie({ secure }: AnonCookieOptions): string {
  const parts = [
    `${ANON_FLAG_COOKIE}=1`,
    "path=/",
    `max-age=${ANON_SESSION_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Clears the flag. Always sent with `clearAnonSessionCookie`. */
export function clearAnonFlagCookie({ secure }: AnonCookieOptions): string {
  const parts = [`${ANON_FLAG_COOKIE}=`, "path=/", "max-age=0", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Does THIS browser believe it holds an anonymous session?
 *
 * Read off `document.cookie`, so it answers in the first frame with no request
 * — which is what the api client needs to pick a base path. It is a routing
 * hint and never an authorisation: the anonymous proxy verifies the signed
 * cookie on every call regardless of what this says.
 */
export function browserHasAnonSession(cookieString: string | null | undefined): boolean {
  if (typeof cookieString !== "string") return false;
  return cookieString
    .split(";")
    .some((part) => part.trim().startsWith(`${ANON_FLAG_COOKIE}=1`));
}

/** Read the raw token out of a `Cookie` header. Returns null when absent. */
export function anonTokenFromCookieHeader(header: string | null | undefined): string | null {
  if (typeof header !== "string" || header.length === 0) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== ANON_SESSION_COOKIE) continue;
    const raw = part.slice(eq + 1).trim();
    if (raw.length === 0) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}
