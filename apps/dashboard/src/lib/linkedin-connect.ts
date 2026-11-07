/**
 * Connecting a LinkedIn account: the LinkedIn login round trip (LINKEDIN-ACCOUNTS-1106), the X model
 * (`x-connect.ts`) with one more input: the profile or company page whose posts are imported, which
 * LinkedIn's login never names, so the member types it.
 *
 * social-service owns the OAuth (state, token exchange, long-lived token, health).
 * The dashboard starts it with a redirect URI and relays LinkedIn's `code` + `state`
 * back. The redirect URI must be registered byte for byte on our LinkedIn app, so it
 * is ONE fixed page with no org or brand in it: `/connections/linkedin/callback`.
 *
 * LinkedIn's redirect carries no org and no brand, so the trip remembers them in
 * localStorage, keyed by the `state` social-service minted, before leaving: which
 * org the call is made for, and the Account page to come back to. The Account
 * page's LinkedIn card then finishes the link under its own org (the URL org).
 *
 * Any number of accounts per brand, any number per type: no cap here.
 *
 * Alias-free on purpose, so this carries REAL unit tests.
 */

import { type AccountType } from "./account-types";
import { isOrgDesyncError, orgDesyncMessage } from "./org-desync";

export const LINKEDIN_CALLBACK_PATH = "/connections/linkedin/callback";

/** The production redirect URI registered on our LinkedIn app. */
export const LINKEDIN_PROD_REDIRECT_URI = "https://dashboard.distribute.you/connections/linkedin/callback";

export function linkedinCallbackUrl(origin: string): string {
  return `${origin}${LINKEDIN_CALLBACK_PATH}`;
}

export { ACCOUNT_TYPES as LINKEDIN_ACCOUNT_TYPES } from "./account-types";
export type LinkedinAccountType = AccountType;

export const DEFAULT_LINKEDIN_ACCOUNT_TYPE: LinkedinAccountType = "pro_ai";

const TRIP_PREFIX = "distribute-linkedin-connect:";

export function linkedinTripKey(state: string): string {
  return `${TRIP_PREFIX}${state}`;
}

export interface LinkedinConnectTrip {
  orgId: string;
  returnTo: string;
}

/** What the callback page needs, or null when the trip was not started in this browser. */
export function parseLinkedinTrip(raw: string | null): LinkedinConnectTrip | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LinkedinConnectTrip>;
    if (typeof v.orgId !== "string" || !v.orgId) return null;
    // Only a path on this site: the value comes back out of storage, never a full URL.
    if (typeof v.returnTo !== "string" || !v.returnTo.startsWith("/") || v.returnTo.startsWith("//")) return null;
    return { orgId: v.orgId, returnTo: v.returnTo };
  } catch {
    return null;
  }
}

/** Query params the LinkedIn card reads on the Account page. */
export const LINKEDIN_RETURN_PARAMS = {
  code: "linkedinCode",
  state: "linkedinState",
  error: "linkedinError",
} as const;

/** The Account page URL carrying what the card needs to finish (or the reason it cannot). */
export function linkedinReturnUrl(
  returnTo: string,
  outcome: { code: string; state: string } | { error: string },
): string {
  const [path, hash] = returnTo.split("#");
  const [base, query = ""] = path.split("?");
  const q = new URLSearchParams(query);
  for (const key of Object.values(LINKEDIN_RETURN_PARAMS)) q.delete(key);
  if ("error" in outcome) {
    q.set(LINKEDIN_RETURN_PARAMS.error, outcome.error);
  } else {
    q.set(LINKEDIN_RETURN_PARAMS.code, outcome.code);
    q.set(LINKEDIN_RETURN_PARAMS.state, outcome.state);
  }
  const s = q.toString();
  return `${base}${s ? `?${s}` : ""}${hash ? `#${hash}` : ""}`;
}

/** True when social-service says our LinkedIn app is not set up yet (its named 502 `linkedin_not_configured`). */
export function isLinkedinNotConfigured(err: unknown): boolean {
  const e = err as { status?: unknown; body?: { type?: unknown; details?: { provider?: unknown } | null } | null } | null;
  return e?.status === 502 && (e.body?.type === "linkedin_not_configured" || typeof e.body?.details?.provider === "string");
}

/**
 * What the card says when starting the login failed. Our LinkedIn app not set up = social-service's named 502
 * (`linkedin_not_configured`), said plainly, never the producer's own message. A page link LinkedIn cannot be = 400.
 */
export function linkedinStartErrorMessage(err: unknown): string {
  // The page's org is not the session's: say which org is open (apiCall's message names it).
  if (isOrgDesyncError(err)) return err instanceof Error && err.message ? err.message : orgDesyncMessage(null);
  if (isLinkedinNotConfigured(err)) return "LinkedIn is not set up on our side yet. Try again soon.";
  const e = err as { status?: unknown } | null;
  if (e?.status === 400) return "Paste a LinkedIn profile or company page link, like linkedin.com/in/your-name.";
  return "We could not open LinkedIn just now. Try again.";
}

/** What the card says when finishing the login failed (expired, reused, refused by LinkedIn). */
export function linkedinFinishErrorMessage(err: unknown): string {
  // The page's org is not the session's: say which org is open (apiCall's message names it).
  if (isOrgDesyncError(err)) return err instanceof Error && err.message ? err.message : orgDesyncMessage(null);
  if (isLinkedinNotConfigured(err)) return "LinkedIn is not set up on our side yet. Try again soon.";
  const e = err as { status?: unknown } | null;
  if (e?.status === 400) return "This LinkedIn login expired. Connect the account again.";
  return "We could not connect this LinkedIn account. Try again.";
}

/** A link the member pasted that reads as a LinkedIn profile or company page (the producer checks it for real). */
export function looksLikeLinkedinPage(url: string): boolean {
  return /linkedin\.com\/(in|company)\/[^/?#\s]+/i.test(url.trim());
}
