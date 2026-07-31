/**
 * The referral link, and the code's journey from a landing click to a claim.
 *
 * The offer: an org shares its link, and when someone signs up through it and
 * converts, BOTH sides earn $500 in free credits. The credits are not a gift on
 * signup. They unlock exactly the way the welcome credits do, once cumulative
 * payments reach the bar billing-service froze for that org, and the inviter's
 * $500 only opens once the invitee has actually earned theirs.
 *
 * The code itself is the inviter org's slug, owned by client-service. Nothing
 * here mints, validates or interprets it.
 *
 * ## Why a cookie, and why it outlives the signup
 *
 * The link points at the marketing site (`distribute.you`) but the signup happens
 * on `dashboard.distribute.you`, a DIFFERENT subdomain, and the Clerk OAuth round
 * trip throws the query string away in between. So the code rides the same path
 * the Partnero partner key already takes: the landing appends it to every
 * dashboard-bound link, the dashboard drops it in a first-party cookie, and the
 * claim reads the cookie once an org exists.
 *
 * The cookie is cleared ONLY when the claim has actually been recorded, or when
 * the code is definitively rejected. That is deliberate: a claim that never
 * lands leaves two orgs owed $500 they will never see, so the intent has to
 * survive a failed request, a closed tab, and a gateway that is not fixed yet.
 *
 * This module is alias-free on purpose so it carries real unit tests rather than
 * source-substring guards. Do not add an `@/…` import.
 */

/** Query parameter carrying the inviter's code, on the landing and the dashboard. */
export const INVITE_PARAM = "invite";

/** First-party cookie on the dashboard domain, holding the code until it is claimed. */
export const INVITE_COOKIE = "distribute_invite";

/** Free credits each side of a converting referral earns, in whole dollars. */
export const REFERRAL_CREDIT_USD = 500;

/** 90 days. The window covers a slow signup without keeping a dead code forever. */
const INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/** Marketing site the referral link points at. */
const LANDING_ORIGIN = "https://distribute.you";

/**
 * A code is an org slug: url-safe, bounded, no whitespace. Validation here is a
 * sanity filter on a value that arrived from the address bar, not an authority
 * on whether the code is real. Only client-service can answer that.
 */
function isPlausibleCode(value: string): boolean {
  return value.length > 0 && value.length <= 128 && /^[A-Za-z0-9._~-]+$/.test(value);
}

/** The link an org shares. Empty code yields null: a link with no code is not a referral. */
export function inviteLinkForCode(code: string | null | undefined): string | null {
  const trimmed = (code ?? "").trim();
  if (!isPlausibleCode(trimmed)) return null;
  return `${LANDING_ORIGIN}?${INVITE_PARAM}=${encodeURIComponent(trimmed)}`;
}

/** Read the code off a `?invite=` query string (`window.location.search` shape). */
export function inviteCodeFromSearch(search: string): string | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get(INVITE_PARAM);
  } catch {
    return null;
  }
  const trimmed = (raw ?? "").trim();
  return isPlausibleCode(trimmed) ? trimmed : null;
}

/** Read the code out of a `document.cookie` string. */
export function inviteCodeFromCookie(cookie: string): string | null {
  const match = new RegExp(`(?:^|; )${INVITE_COOKIE}=([^;]*)`).exec(cookie);
  if (!match) return null;
  let raw: string;
  try {
    raw = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const trimmed = raw.trim();
  return isPlausibleCode(trimmed) ? trimmed : null;
}

/** `document.cookie` assignment that stores the code. */
export function inviteCookieWrite(code: string): string {
  return `${INVITE_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${INVITE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/** `document.cookie` assignment that clears it, once the claim is settled. */
export function inviteCookieClear(): string {
  return `${INVITE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Whether a failed claim should DROP the stored code or keep it for a later try.
 *
 * Keeping it is the default, because the common failures are transient (a cold
 * service, an offline tab) or temporary (a gateway leg that is not deployed
 * yet), and dropping the code on those silently costs two orgs $500 each.
 *
 * A 4xx that names the code itself is different: it will answer the same way
 * forever, so retrying it on every page load is noise. Only 404 (no such code)
 * and 400 (malformed) qualify.
 *
 * 409 is deliberately NOT terminal. Re-claiming the same pair is idempotent
 * downstream and answers 200, so the only 409 that exists is "this inviter has
 * hit their invite cap" — and that cap is being lifted. Dropping the code on it
 * would permanently cost the two orgs $500 each for signing up during the gap.
 * 401/403 are not terminal either: they mean the session has not settled yet.
 */
export function isTerminalClaimRejection(status: number): boolean {
  return status === 400 || status === 404;
}
