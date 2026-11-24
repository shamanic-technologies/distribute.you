/**
 * Connecting an Instagram account: the Instagram login round trip (REELS-1124), the X model
 * (`x-connect.ts`) for Instagram professional accounts (Business or Creator).
 *
 * social-service owns the OAuth (state, token exchange, long-lived token, health).
 * The dashboard starts it with a redirect URI and relays Instagram's `code` + `state`
 * back. The redirect URI must be registered byte for byte on our Instagram app, so it
 * is ONE fixed page with no org or brand in it: `/connections/instagram/callback`.
 *
 * Instagram's redirect carries no org and no brand, so the trip remembers them in
 * localStorage, keyed by the `state` social-service minted, before leaving: which
 * org the call is made for, and the Account page to come back to. The Account
 * page's Instagram card then finishes the link under its own org (the URL org).
 *
 * Any number of accounts per brand, any number per type: no cap here.
 *
 * Alias-free on purpose, so this carries REAL unit tests.
 */

import { type AccountType } from "./account-types";
import { isOrgDesyncError, orgDesyncMessage } from "./org-desync";

export const INSTAGRAM_CALLBACK_PATH = "/connections/instagram/callback";

/** The production redirect URI registered on our Instagram app (LOCKED: the owner pastes it in Meta's console). */
export const INSTAGRAM_PROD_REDIRECT_URI = "https://dashboard.distribute.you/connections/instagram/callback";

export function instagramCallbackUrl(origin: string): string {
  return `${origin}${INSTAGRAM_CALLBACK_PATH}`;
}

export { ACCOUNT_TYPES as INSTAGRAM_ACCOUNT_TYPES } from "./account-types";
export type InstagramAccountType = AccountType;

export const DEFAULT_INSTAGRAM_ACCOUNT_TYPE: InstagramAccountType = "pro_ai";

const TRIP_PREFIX = "distribute-instagram-connect:";

export function instagramTripKey(state: string): string {
  return `${TRIP_PREFIX}${state}`;
}

export interface InstagramConnectTrip {
  orgId: string;
  returnTo: string;
}

/** What the callback page needs, or null when the trip was not started in this browser. */
export function parseInstagramTrip(raw: string | null): InstagramConnectTrip | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<InstagramConnectTrip>;
    if (typeof v.orgId !== "string" || !v.orgId) return null;
    // Only a path on this site: the value comes back out of storage, never a full URL.
    if (typeof v.returnTo !== "string" || !v.returnTo.startsWith("/") || v.returnTo.startsWith("//")) return null;
    return { orgId: v.orgId, returnTo: v.returnTo };
  } catch {
    return null;
  }
}

/** Query params the Instagram card reads on the Account page. */
export const INSTAGRAM_RETURN_PARAMS = {
  code: "instagramCode",
  state: "instagramState",
  error: "instagramError",
} as const;

/**
 * Instagram appends `#_` to its redirect. It lands in the URL's hash, but a code copied
 * by hand (or a browser folding the fragment) can carry it: drop it before relaying.
 */
export function cleanInstagramCode(code: string): string {
  return code.replace(/#_?$/, "");
}

/** The Account page URL carrying what the card needs to finish (or the reason it cannot). */
export function instagramReturnUrl(
  returnTo: string,
  outcome: { code: string; state: string } | { error: string },
): string {
  const [path, hash] = returnTo.split("#");
  const [base, query = ""] = path.split("?");
  const q = new URLSearchParams(query);
  for (const key of Object.values(INSTAGRAM_RETURN_PARAMS)) q.delete(key);
  if ("error" in outcome) {
    q.set(INSTAGRAM_RETURN_PARAMS.error, outcome.error);
  } else {
    q.set(INSTAGRAM_RETURN_PARAMS.code, cleanInstagramCode(outcome.code));
    q.set(INSTAGRAM_RETURN_PARAMS.state, outcome.state);
  }
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
}

/** What the callback says when Instagram sent the browser back WITHOUT a code. */
export function instagramDeniedMessage(error: string | null): string {
  if (error === "access_denied") return "You cancelled the Instagram login.";
  return "Instagram did not finish the login. Try again.";
}

/** True when social-service says our Instagram app is not set up yet (its named 502 `instagram_not_configured`). */
export function isInstagramNotConfigured(err: unknown): boolean {
  const e = err as { status?: unknown; body?: { type?: unknown; details?: { provider?: unknown } | null } | null } | null;
  return e?.status === 502 && (e.body?.type === "instagram_not_configured" || typeof e.body?.details?.provider === "string");
}

/** What the card says when starting the login failed. Never the producer's own message. */
export function instagramStartErrorMessage(err: unknown): string {
  // The page's org is not the session's: say which org is open (apiCall's message names it).
  if (isOrgDesyncError(err)) return err instanceof Error && err.message ? err.message : orgDesyncMessage(null);
  if (isInstagramNotConfigured(err)) return "Instagram is not set up on our side yet. Try again soon.";
  return "We could not open Instagram just now. Try again.";
}

/** What the card says when finishing the login failed (expired, reused, refused by Instagram). */
export function instagramFinishErrorMessage(err: unknown): string {
  if (isOrgDesyncError(err)) return err instanceof Error && err.message ? err.message : orgDesyncMessage(null);
  if (isInstagramNotConfigured(err)) return "Instagram is not set up on our side yet. Try again soon.";
  const e = err as { status?: unknown } | null;
  if (e?.status === 400) return "This Instagram login expired. Connect the account again.";
  return "We could not connect this Instagram account. Try again.";
}
