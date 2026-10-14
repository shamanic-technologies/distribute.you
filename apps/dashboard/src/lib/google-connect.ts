/**
 * Connecting a Gmail mailbox: the Google sign-in round trip.
 *
 * google-service owns the OAuth (PKCE, state, token exchange, the mirror). The
 * dashboard only starts it with a callback URL and relays Google's `code` + `state`
 * back. The callback URL must be one Google has REGISTERED on the OAuth client, and
 * the registered dashboard one is `/services/crm/oauth/callback` (a path admin's flow
 * already used; probed against the live client 2026-10-01). A new path would fail
 * at Google with `redirect_uri_mismatch` until someone adds it in Cloud console.
 *
 * Google's redirect carries no org and no brand, so the round trip remembers them
 * in sessionStorage (same tab) before leaving: which org the mailbox is connected
 * for, and where to bring the person back to.
 *
 * Gmail is connected per ORGANIZATION (every brand of the org reads the same mailbox).
 *
 * Alias-free on purpose, so this carries REAL unit tests.
 */

export const GOOGLE_CALLBACK_PATH = "/services/crm/oauth/callback";

export const GOOGLE_RETURN_KEY = "distribute-google-connect";

export interface GoogleConnectReturn {
  orgId: string;
  returnTo: string;
}

export function googleCallbackUrl(origin: string): string {
  return `${origin}${GOOGLE_CALLBACK_PATH}`;
}

/** What the callback page needs to finish, or null when the trip was not started here. */
export function parseGoogleReturn(raw: string | null): GoogleConnectReturn | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<GoogleConnectReturn>;
    if (typeof v.orgId !== "string" || !v.orgId) return null;
    // Only a path on this site: the value comes back out of storage, never a full URL.
    if (typeof v.returnTo !== "string" || !v.returnTo.startsWith("/") || v.returnTo.startsWith("//")) return null;
    return { orgId: v.orgId, returnTo: v.returnTo };
  } catch {
    return null;
  }
}

/** The return path with the outcome the Integrations row reads back. */
export function returnWithOutcome(returnTo: string, outcome: { connected: true } | { error: string }): string {
  const [path, hash] = returnTo.split("#");
  const [base, query = ""] = path.split("?");
  const q = new URLSearchParams(query);
  q.delete("gmail");
  q.delete("gmailError");
  if ("connected" in outcome) q.set("gmail", "connected");
  else q.set("gmailError", outcome.error);
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
}

/**
 * Send access on a connected mailbox (GMAIL-NEEDS-SEND-ACCESS-1014). A follow-up can
 * reply inside a person's own Gmail thread, from the mailbox they wrote to; that needs
 * `gmail.send` on the grant. google-service asks for it on every sign-in since
 * 2026-10-14 and serves each mailbox's granted `scopes`; a mailbox connected before
 * lacks it and its replies are refused (`google_send_permission_missing`) until the
 * owner signs in again. Signing in again with the same Google account updates the
 * same mailbox and keeps its history: that is "Reconnect", never Disconnect.
 */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export function canSendFrom(account: { scopes: readonly string[] }): boolean {
  return account.scopes.includes(GMAIL_SEND_SCOPE);
}

/**
 * The Google sign-in URL preselecting one address (`login_hint`), so Reconnect
 * signs in the mailbox it was clicked on rather than whichever account the browser
 * picks first. Every other parameter google-service built is kept as is.
 */
export function withLoginHint(authorizeUrl: string, email: string): string {
  const url = new URL(authorizeUrl);
  url.searchParams.set("login_hint", email);
  return url.toString();
}
