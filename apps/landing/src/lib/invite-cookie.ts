/**
 * Invite cookie utilities shared between middleware and components.
 *
 * Cookie is non-HttpOnly so the dashboard JS can read it after Clerk auth.
 * Domain is .distribute.you so it survives subdomain redirects (Clerk hosted UI).
 */

export const INVITE_COOKIE_NAME = "dyu_invite";
export const INVITE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

/**
 * Slug shape: lowercase alphanumeric + hyphens, 2–64 chars.
 * Matches the Clerk org-slug format produced by createOrganization({ name: domain }).
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

export function isValidInviteSlug(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  return SLUG_PATTERN.test(value);
}

/**
 * Cookie domain — `.distribute.you` in prod, undefined on localhost
 * so the browser uses the exact host.
 */
export function resolveCookieDomain(host: string | null): string | undefined {
  if (!host) return undefined;
  const hostLower = host.toLowerCase();
  if (hostLower.endsWith(".distribute.you") || hostLower === "distribute.you") {
    return ".distribute.you";
  }
  return undefined;
}
