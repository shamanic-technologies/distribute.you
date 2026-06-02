import { ORG_DESYNC_ERROR, ORG_DESYNC_STATUS } from "./org-desync";

export interface ProxyOrgError {
  status: number;
  body: { error: string; sessionOrgId: string; requestedOrgId: string };
}

/**
 * Fail-closed org-consistency guard for every dashboard → backend proxy hop.
 *
 * Authority for the caller's org is ALWAYS the Clerk session JWT
 * (`auth().orgId`), NEVER a client-supplied value. The client additionally
 * sends `x-active-org-id` = the org its URL/UI is currently rendering. When the
 * two disagree — Clerk's active-org claim lags a fresh org switch — forwarding
 * would read/write under the org the user is NOT looking at: the exact cross-org
 * 404 / mis-committed-write bug (DIS-143). So we REFUSE to forward and return
 * 409 `org_desync`; the client retries once the session settles.
 *
 * OWASP Multi-Tenant Cheat Sheet: derive tenant from trusted claims, validate
 * on every request, FAIL CLOSED on mismatch. The JWT stays the sole source of
 * org authority — `x-active-org-id` is used only to DETECT the desync, never as
 * the forwarded org.
 *
 * Pure (no `next/server`) so it unit-tests in node and stays importable from any
 * runtime. Routes wrap the returned descriptor in `NextResponse.json`.
 */
export function checkProxyOrg(
  sessionOrgId: string,
  requestedOrgId: string | null,
): ProxyOrgError | null {
  if (requestedOrgId && requestedOrgId !== sessionOrgId) {
    console.warn(
      `[api-proxy] ${ORG_DESYNC_ERROR} — session JWT org=${sessionOrgId} but UI org=${requestedOrgId}; refusing to forward`,
    );
    return {
      status: ORG_DESYNC_STATUS,
      body: { error: ORG_DESYNC_ERROR, sessionOrgId, requestedOrgId },
    };
  }
  return null;
}
