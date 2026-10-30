/**
 * Connecting an X account: the X login round trip (X-ACCOUNTS-1030).
 *
 * social-service owns the OAuth (state, token exchange, long-lived token, health).
 * The dashboard starts it with a redirect URI and relays X' `code` + `state`
 * back. The redirect URI must be registered byte for byte on our X app, so it
 * is ONE fixed page with no org or brand in it: `/connections/x/callback`.
 *
 * X' redirect carries no org and no brand, so the trip remembers them in
 * localStorage, keyed by the `state` social-service minted, before leaving: which
 * org the call is made for, and the Account page to come back to. The Account
 * page's X card then finishes the link under its own org (the URL org).
 *
 * Any number of accounts per brand, any number per type: no cap here.
 *
 * Alias-free on purpose, so this carries REAL unit tests.
 */

import { type AccountType } from "./account-types";

export const X_CALLBACK_PATH = "/connections/x/callback";

/** The production redirect URI registered on our X app. */
export const X_PROD_REDIRECT_URI = "https://dashboard.distribute.you/connections/x/callback";

export function xCallbackUrl(origin: string): string {
  return `${origin}${X_CALLBACK_PATH}`;
}

export { ACCOUNT_TYPES as X_ACCOUNT_TYPES } from "./account-types";
export type XAccountType = AccountType;

export const DEFAULT_X_ACCOUNT_TYPE: XAccountType = "pro_ai";

const TRIP_PREFIX = "distribute-x-connect:";

export function xTripKey(state: string): string {
  return `${TRIP_PREFIX}${state}`;
}

export interface XConnectTrip {
  orgId: string;
  returnTo: string;
}

/** What the callback page needs, or null when the trip was not started in this browser. */
export function parseXTrip(raw: string | null): XConnectTrip | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<XConnectTrip>;
    if (typeof v.orgId !== "string" || !v.orgId) return null;
    // Only a path on this site: the value comes back out of storage, never a full URL.
    if (typeof v.returnTo !== "string" || !v.returnTo.startsWith("/") || v.returnTo.startsWith("//")) return null;
    return { orgId: v.orgId, returnTo: v.returnTo };
  } catch {
    return null;
  }
}

/** Query params the X card reads on the Account page. */
export const X_RETURN_PARAMS = {
  code: "xCode",
  state: "xState",
  error: "xError",
} as const;

/** The Account page URL carrying what the card needs to finish (or the reason it cannot). */
export function xReturnUrl(
  returnTo: string,
  outcome: { code: string; state: string } | { error: string },
): string {
  const [path, hash] = returnTo.split("#");
  const [base, query = ""] = path.split("?");
  const q = new URLSearchParams(query);
  for (const key of Object.values(X_RETURN_PARAMS)) q.delete(key);
  if ("error" in outcome) {
    q.set(X_RETURN_PARAMS.error, outcome.error);
  } else {
    q.set(X_RETURN_PARAMS.code, outcome.code);
    q.set(X_RETURN_PARAMS.state, outcome.state);
  }
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
}

/**
 * What the card says when starting the login failed. Our X app's X keys
 * missing = social-service's named 502 (`details.provider` = the missing key): the
 * connection is still being set up on our side. Never the producer's own message.
 */
export function xStartErrorMessage(err: unknown): string {
  const e = err as { status?: unknown; body?: { details?: { provider?: unknown } | null } | null } | null;
  if (e?.status === 502 && typeof e.body?.details?.provider === "string") {
    return "X connection is being set up, try again soon.";
  }
  return "We could not open X just now. Try again.";
}

/** What the card says when finishing the login failed (expired, reused, refused by X). */
export function xFinishErrorMessage(err: unknown): string {
  const e = err as { status?: unknown; body?: { details?: { provider?: unknown } | null } | null } | null;
  if (e?.status === 502 && typeof e.body?.details?.provider === "string") {
    return "X connection is being set up, try again soon.";
  }
  if (e?.status === 400) return "This X login expired. Connect the account again.";
  // Connecting reads the account on X once, billed to the org like any other call.
  if (e?.status === 402) return "Add credit to your balance, then connect the account again.";
  return "We could not connect this X account. Try again.";
}
