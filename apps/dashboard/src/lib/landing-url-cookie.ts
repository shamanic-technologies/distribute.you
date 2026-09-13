/**
 * The website a visitor typed on the landing, carried to the dashboard as
 * `?url=` and parked in a first-party cookie so it survives the Clerk sign-up /
 * OAuth round-trip.
 *
 * Why a cookie and not just the query param: the param rides
 * `redirectUrlComplete` through Clerk and `/sso-callback`, and the first-run
 * edge gate can bounce a signed-in user to a bare `/onboarding` — either hop
 * drops it, and onboarding then falls back to the email-domain GUESS, which is
 * a bare host by construction (`kevin@acme.com` -> `acme.com`, no path). The
 * `?via=` partner key already needed exactly this treatment for exactly this
 * reason (`partnero-via-capture.tsx`); `?url=` had the same hazard and no
 * protection.
 *
 * Deliberately NOT httpOnly: the browser is what learns the value (it is in the
 * URL the visitor arrived on) and what reads it back one step later. It holds a
 * website the visitor typed about themselves, no token and no id the URL does
 * not already carry.
 *
 * Alias-free on purpose so it carries real unit tests rather than
 * source-substring guards.
 */

import { websiteInputProblem } from "./website-input";

export const LANDING_URL_COOKIE = "distribute_landing_url";

/** 30 days: long enough to survive an abandoned signup resumed the next day,
 *  short enough that a stale website never prefills a brand-new brand months on. */
export const LANDING_URL_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Cookies ride every request to the origin, including each `/api/v1/*` proxy
 *  call, so a pathological URL must not bloat them. */
const MAX_URL_LENGTH = 512;

/**
 * The absolute URL form of a website a person typed, or null when the input
 * cannot be one. Adds a scheme to a bare host and keeps the path — the path is
 * the whole point (`voozaa.app/us/` is a different landing page from
 * `voozaa.app`), and it seeds the outreach click destination downstream.
 *
 * The landing field itself accepts whatever a visitor types, deliberately: a
 * hero input that argues with somebody is a hero input that loses them. What is
 * refused is STORING a non-website as one. An input this returns null for
 * leaves no cookie at all, so onboarding behaves exactly as it does for a
 * person who signed up through the plain button — which is the honest fallback,
 * because we learned nothing about their website.
 *
 * `websiteInputProblem` is the one rule (see that module for what an accepted
 * email address cost). It used to be a bare "the hostname contains a dot" check
 * here, which is how `kevin@gmail.com` became `https://kevin@gmail.com/` and
 * then a brand on Google's domain.
 */
export function normalizeLandingUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  if (websiteInputProblem(trimmed)) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    const href = parsed.href;
    return href.length > MAX_URL_LENGTH ? null : href;
  } catch {
    return null;
  }
}

/** The `document.cookie` string that stores it, or null when the value is unusable. */
export function landingUrlCookieString(raw: string | null | undefined): string | null {
  const normalized = normalizeLandingUrl(raw);
  if (!normalized) return null;
  return `${LANDING_URL_COOKIE}=${encodeURIComponent(normalized)}; path=/; max-age=${LANDING_URL_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/**
 * Read it back out of a raw `document.cookie` string. Re-normalizes on read so a
 * hand-edited or truncated cookie cannot put a non-URL into the field.
 */
export function readLandingUrlCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    if (part.slice(0, eq).trim() !== LANDING_URL_COOKIE) continue;
    try {
      return normalizeLandingUrl(decodeURIComponent(part.slice(eq + 1).trim()));
    } catch {
      return null;
    }
  }
  return null;
}

/** Expire it. Called once the value has been read into onboarding, so a later
 *  brand-add flow starts from what that person types rather than this one. */
export function clearLandingUrlCookieString(): string {
  return `${LANDING_URL_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
