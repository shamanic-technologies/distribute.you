/**
 * Is this person NEW? Read from the account itself (Clerk's `createdAt`), never from
 * which page they signed up on.
 *
 * The signup emails (`welcome` + `signup_notification`) used to fire only when the
 * `/sign-up` page had left a `distribute_auth_intent` flag in sessionStorage. The
 * `/get-started` wall, the one signup flow since 2026-10-04, never sets it, so every
 * signup there got no welcome (GET-STARTED-NO-WELCOME-EMAIL-1020: none sent from
 * 2026-10-07 while 10 people signed up). The fact "this account was just created" is
 * the same on every page.
 *
 * Alias-free on purpose: real unit tests import it.
 */

/** An account is new for its first hour: the signup flows reach the dashboard in seconds. */
export const NEW_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

export function isNewAccount(
  createdAt: Date | number | null | undefined,
  now: number = Date.now(),
): boolean {
  if (createdAt == null) return false;
  const at = createdAt instanceof Date ? createdAt.getTime() : createdAt;
  if (!Number.isFinite(at)) return false;
  const age = now - at;
  return age >= 0 && age <= NEW_ACCOUNT_WINDOW_MS;
}

/** This browser already sent this person's signup emails (transactional-email dedups too). */
export function signupEmailsSentKey(userId: string): string {
  return `distribute_signup_emails_sent:${userId}`;
}

/**
 * The `/get-started` wall: until its claim runs, the session's org is not yet the org the
 * visitor built, so nothing org-scoped may be written from the shell there. The wall sends
 * the signup emails itself, right after its claim.
 */
export function isGetStartedPath(pathname: string): boolean {
  return pathname === "/get-started" || pathname.startsWith("/get-started/");
}

/**
 * The noun of the launch email ("You're live. Your first {{outcomeNoun}} are on the way."):
 * what the served landing sells, "B2B Sales Meetings" (owner 2026-10-19).
 */
export const LAUNCH_OUTCOME_NOUN = "sales meetings";
