/**
 * Connecting a Threads account: the Threads login round trip (THREADS-ACCOUNT-CARD-1028).
 *
 * meta-service owns the OAuth (state, token exchange, long-lived token, health).
 * The dashboard starts it with a redirect URI and relays Threads' `code` + `state`
 * back. The redirect URI must be registered byte for byte on our Meta app, so it
 * is ONE fixed page with no org or brand in it: `/connections/threads/callback`.
 *
 * Threads' redirect carries no org and no brand, so the trip remembers them in
 * localStorage, keyed by the `state` meta-service minted, before leaving: which
 * org the call is made for, and the Account page to come back to. The Account
 * page's Threads card then finishes the link under its own org (the URL org).
 *
 * Any number of accounts per brand, any number per type: no cap here.
 *
 * Alias-free on purpose, so this carries REAL unit tests.
 */

export const THREADS_CALLBACK_PATH = "/connections/threads/callback";

/** The production redirect URI registered on our Meta app. */
export const THREADS_PROD_REDIRECT_URI = "https://dashboard.distribute.you/connections/threads/callback";

export function threadsCallbackUrl(origin: string): string {
  return `${origin}${THREADS_CALLBACK_PATH}`;
}

/** meta-service's account types, in the order the picker offers them. Default is Pro (AI). */
export const THREADS_ACCOUNT_TYPES = [
  { value: "pro_ai", label: "Pro (AI)" },
  { value: "pro_human", label: "Pro (human)" },
  { value: "personal_human", label: "Personal (human)" },
] as const;

export type ThreadsAccountType = (typeof THREADS_ACCOUNT_TYPES)[number]["value"];

export const DEFAULT_THREADS_ACCOUNT_TYPE: ThreadsAccountType = "pro_ai";

const TRIP_PREFIX = "distribute-threads-connect:";

export function threadsTripKey(state: string): string {
  return `${TRIP_PREFIX}${state}`;
}

export interface ThreadsConnectTrip {
  orgId: string;
  returnTo: string;
}

/** What the callback page needs, or null when the trip was not started in this browser. */
export function parseThreadsTrip(raw: string | null): ThreadsConnectTrip | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ThreadsConnectTrip>;
    if (typeof v.orgId !== "string" || !v.orgId) return null;
    // Only a path on this site: the value comes back out of storage, never a full URL.
    if (typeof v.returnTo !== "string" || !v.returnTo.startsWith("/") || v.returnTo.startsWith("//")) return null;
    return { orgId: v.orgId, returnTo: v.returnTo };
  } catch {
    return null;
  }
}

/** Query params the Threads card reads on the Account page. */
export const THREADS_RETURN_PARAMS = {
  code: "threadsCode",
  state: "threadsState",
  error: "threadsError",
} as const;

/** The Account page URL carrying what the card needs to finish (or the reason it cannot). */
export function threadsReturnUrl(
  returnTo: string,
  outcome: { code: string; state: string } | { error: string },
): string {
  const [path, hash] = returnTo.split("#");
  const [base, query = ""] = path.split("?");
  const q = new URLSearchParams(query);
  for (const key of Object.values(THREADS_RETURN_PARAMS)) q.delete(key);
  if ("error" in outcome) {
    q.set(THREADS_RETURN_PARAMS.error, outcome.error);
  } else {
    q.set(THREADS_RETURN_PARAMS.code, outcome.code);
    q.set(THREADS_RETURN_PARAMS.state, outcome.state);
  }
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
}

/**
 * What the card says when starting the login failed. Our Meta app's Threads keys
 * missing = meta-service's named 502 (`details.provider` = the missing key): the
 * connection is still being set up on our side. Never the producer's own message.
 */
export function threadsStartErrorMessage(err: unknown): string {
  const e = err as { status?: unknown; body?: { details?: { provider?: unknown } | null } | null } | null;
  if (e?.status === 502 && typeof e.body?.details?.provider === "string") {
    return "Threads connection is being set up, try again soon.";
  }
  return "We could not open Threads just now. Try again.";
}

/** What the card says when finishing the login failed (expired, reused, refused by Threads). */
export function threadsFinishErrorMessage(err: unknown): string {
  const e = err as { status?: unknown; body?: { details?: { provider?: unknown } | null } | null } | null;
  if (e?.status === 502 && typeof e.body?.details?.provider === "string") {
    return "Threads connection is being set up, try again soon.";
  }
  if (e?.status === 400) return "This Threads login expired. Connect the account again.";
  return "We could not connect this Threads account. Try again.";
}
