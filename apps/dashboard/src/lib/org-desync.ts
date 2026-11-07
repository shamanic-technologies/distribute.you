/**
 * Shared org-desync contract between the client (`api.ts`) and the server proxy
 * routes (`proxy-org.ts`). Kept dependency-free (no `next/*`) so both the client
 * bundle and the edge/server routes can import it.
 */
export const ORG_DESYNC_STATUS = 409;
export const ORG_DESYNC_ERROR = "org_desync";

/** Window event `apiCall` fires when an org desync outlived its retries (the client cannot
 *  resolve it by itself): the v2 shell's notice says which org is open. */
export const ORG_DESYNC_EVENT = "org:desync";

export interface OrgDesyncInfo {
  /** The org the session is signed in to (Clerk id), from the proxy's refusal. */
  sessionOrgId: string | null;
  /** Its display name, when the browser's Clerk client knows it. */
  sessionOrgName: string | null;
}

/** What a surface says when the page's org and the session's org disagree: which org is open. */
export function orgDesyncMessage(sessionOrgName: string | null): string {
  return sessionOrgName
    ? `This page belongs to another organization. You are signed in to ${sessionOrgName}.`
    : "This page belongs to another organization than the one you are signed in to.";
}

/** True for the proxy's 409 `org_desync` refusal, as `apiCall` throws it. */
export function isOrgDesyncError(err: unknown): boolean {
  const e = err as { status?: unknown; body?: { error?: unknown } | null } | null;
  return e?.status === ORG_DESYNC_STATUS && e.body?.error === ORG_DESYNC_ERROR;
}
