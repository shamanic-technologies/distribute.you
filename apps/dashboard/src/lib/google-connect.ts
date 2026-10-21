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

/**
 * Which Google connection a sign-in is for. Each is its OWN consent, never bundled:
 * `mailbox` (Gmail read + send, Contacts read) is google-service's default; `calendar`
 * (Calendar events read + Google Meet read) shows booked meetings and who joined.
 * Both come back through the same registered callback.
 */
export type GoogleConnection = "mailbox" | "calendar";

export interface GoogleConnectReturn {
  orgId: string;
  returnTo: string;
  connection: GoogleConnection;
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
    // A trip stored before the calendar existed carried no connection: it was a mailbox.
    const connection: GoogleConnection = v.connection === "calendar" ? "calendar" : "mailbox";
    return { orgId: v.orgId, returnTo: v.returnTo, connection };
  } catch {
    return null;
  }
}

/** The query params each row reads its outcome from (the Gmail row's are unchanged). */
export const OUTCOME_PARAMS: Record<GoogleConnection, { connected: string; error: string }> = {
  mailbox: { connected: "gmail", error: "gmailError" },
  calendar: { connected: "calendar", error: "calendarError" },
};

/** The return path with the outcome the Integrations row reads back. */
export function returnWithOutcome(
  returnTo: string,
  outcome: { connected: true } | { error: string },
  connection: GoogleConnection = "mailbox",
): string {
  const [path, hash] = returnTo.split("#");
  const [base, query = ""] = path.split("?");
  const q = new URLSearchParams(query);
  for (const keys of Object.values(OUTCOME_PARAMS)) {
    q.delete(keys.connected);
    q.delete(keys.error);
  }
  const keys = OUTCOME_PARAMS[connection];
  if ("connected" in outcome) q.set(keys.connected, "connected");
  else q.set(keys.error, outcome.error);
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

/**
 * What the callback says when finishing failed. A calendar consent where the person
 * unticked the calendar box is refused by google-service (400
 * `calendar_permission_missing`): nothing to read, so it asks to keep the box ticked.
 * Never the producer's own message (our copy, branched on status + reason).
 */
export function finishErrorMessage(connection: GoogleConnection, err: unknown): string {
  if (connection === "mailbox") return "We could not connect this mailbox. Try again.";
  const e = err as { status?: unknown; body?: { reason?: unknown } | null } | null;
  if (e?.status === 400 && e.body?.reason === "calendar_permission_missing") {
    return "Keep the calendar box ticked and try again.";
  }
  return "We could not connect this calendar. Try again.";
}

/** The fields of a connected calendar the Integrations row reads (google-service `GET /orgs/google/calendar/accounts`). */
export interface GoogleCalendarHealth {
  status: string;
  attendance: string;
}

/**
 * What a connected calendar says on its row, and whether it offers Reconnect.
 * `sync_failing` wins: nothing is read at all. `meet_permission_missing` = meetings
 * are read, attendance is not. Any value the producer adds later reads as a stop,
 * loudly, rather than as healthy.
 */
export function calendarLine(cal: GoogleCalendarHealth): { text: string; tone: "ok" | "warn"; reconnect: boolean } {
  if (cal.status === "sync_failing") {
    return { text: "We stopped reading this calendar. Sign in again to restart.", tone: "warn", reconnect: true };
  }
  if (cal.status !== "active") {
    console.error("[google-calendar] unknown calendar status", cal.status);
    return { text: "We stopped reading this calendar. Sign in again to restart.", tone: "warn", reconnect: true };
  }
  if (cal.attendance === "meet") {
    return { text: "We see your booked meetings and who joined your Google Meet calls.", tone: "ok", reconnect: false };
  }
  if (cal.attendance !== "meet_permission_missing") {
    console.error("[google-calendar] unknown attendance value", cal.attendance);
  }
  return {
    text: "We see your booked meetings. Attendance is off. Sign in again and keep the Google Meet box ticked.",
    tone: "warn",
    reconnect: true,
  };
}
