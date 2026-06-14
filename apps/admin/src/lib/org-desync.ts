/**
 * Shared org-desync contract between the client (`api.ts`) and the server proxy
 * routes (`proxy-org.ts`). Kept dependency-free (no `next/*`) so both the client
 * bundle and the edge/server routes can import it.
 */
export const ORG_DESYNC_STATUS = 409;
export const ORG_DESYNC_ERROR = "org_desync";
