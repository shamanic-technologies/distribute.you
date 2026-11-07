/**
 * A dashboard URL that names its org by the INTERNAL client-service uuid
 * (`/v2/orgs/f0420eb5-…/brands/…`) instead of the Clerk org id (`/v2/orgs/org_…/…`).
 *
 * Agents, emails, Monitoring and staff tools hold the internal uuid, so such links
 * reach the dashboard. The page renders, but the session cannot switch to a uuid (Clerk
 * only knows `org_…`), `apiCall` sends the uuid as `x-active-org-id`, and the proxy
 * refuses every call with 409 `org_desync` (2026-11-07, LinkedIn connect). The edge
 * (`proxy.ts`) therefore resolves the uuid to its Clerk id and redirects to the SAME
 * path under it; the Clerk-id URL then switches the session like any org URL, and a
 * non-member is refused exactly as on a Clerk-id URL.
 *
 * Alias-free (no `@/` import) so it unit-tests in node.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ORG_PATH_RE = new RegExp(`^(/v2)?/orgs/(${UUID})(?=/|$)`, "i");

/** The internal org uuid an org URL names, or null when it names a Clerk id (or no org). */
export function internalOrgUuidInPath(pathname: string): string | null {
  const m = pathname.match(ORG_PATH_RE);
  return m ? m[2].toLowerCase() : null;
}

/** The same path with its internal org uuid replaced by the Clerk org id. */
export function pathWithClerkOrgId(pathname: string, clerkOrgId: string): string {
  return pathname.replace(ORG_PATH_RE, (_all, v2: string | undefined) => `${v2 ?? ""}/orgs/${encodeURIComponent(clerkOrgId)}`);
}

/** client-service's `GET /internal/orgs/:orgId` body (the fields read here). */
export interface InternalOrgRecord {
  externalId: string | null;
}

export type FetchInternalOrg = (orgId: string) => Promise<InternalOrgRecord | null>;

/** An org's Clerk id never changes, so a resolved pair is kept for the process lifetime. */
const resolved = new Map<string, string>();

/**
 * The Clerk org id of an internal org uuid, read from client-service (the org's owner).
 * Null when no org has this uuid, or its external id is not a Clerk org (an anonymous
 * `anon_…` org is not reachable in the dashboard). Failures are logged and not cached.
 */
export async function resolveClerkOrgId(uuid: string, fetchOrg: FetchInternalOrg): Promise<string | null> {
  const key = uuid.toLowerCase();
  const hit = resolved.get(key);
  if (hit) return hit;
  let org: InternalOrgRecord | null;
  try {
    org = await fetchOrg(key);
  } catch (err) {
    console.error("[internal-org-url] client-service org lookup failed", { orgId: key, err });
    return null;
  }
  const externalId = org?.externalId ?? null;
  if (!externalId || !externalId.startsWith("org_")) {
    console.error("[internal-org-url] no Clerk org behind internal org id", { orgId: key, externalId });
    return null;
  }
  resolved.set(key, externalId);
  return externalId;
}

/**
 * The URL to redirect to (path + query) when `pathname` names its org by internal uuid,
 * else null (nothing to do, or the uuid resolves to no Clerk org: the page then renders
 * and the org-desync notice says which org is open).
 */
export async function clerkOrgRedirectPath(
  pathname: string,
  search: string,
  fetchOrg: FetchInternalOrg,
): Promise<string | null> {
  const uuid = internalOrgUuidInPath(pathname);
  if (!uuid) return null;
  const clerkOrgId = await resolveClerkOrgId(uuid, fetchOrg);
  if (!clerkOrgId) return null;
  return `${pathWithClerkOrgId(pathname, clerkOrgId)}${search}`;
}

/** Test-only: module state outlives a single test. */
export function resetInternalOrgUrlCache(): void {
  resolved.clear();
}
