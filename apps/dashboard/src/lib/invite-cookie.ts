/**
 * Client-side reader/writer for the landing-shared invite cookie.
 *
 * Cookie is set by the landing-app middleware on `?invite=<slug>`. After Clerk
 * signup the dashboard reads it at the end of onboarding to claim the invite.
 */

export const INVITE_COOKIE_NAME = "dyu_invite";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

export function isValidInviteSlug(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  return SLUG_PATTERN.test(value);
}

export function readInviteCookie(): string | null {
  if (typeof document === "undefined") return null;
  const target = `${INVITE_COOKIE_NAME}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      const value = decodeURIComponent(trimmed.slice(target.length)).toLowerCase();
      return isValidInviteSlug(value) ? value : null;
    }
  }
  return null;
}

function resolveCookieDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith(".distribute.you") || host === "distribute.you") {
    return ".distribute.you";
  }
  return undefined;
}

export function clearInviteCookie(): void {
  if (typeof document === "undefined") return;
  const domain = resolveCookieDomain();
  const domainPart = domain ? `; domain=${domain}` : "";
  document.cookie = `${INVITE_COOKIE_NAME}=; path=/; max-age=0${domainPart}`;
}
