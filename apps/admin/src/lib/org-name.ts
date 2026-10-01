import { clerkClient } from "@clerk/nextjs/server";

/**
 * The active org's display name, as Clerk stores it, for the `x-org-name` header.
 *
 * api-service forwards `x-org-name` to client-service `/internal/resolve`, which
 * stores it on the org row, so an org whose name was never recorded heals on its
 * next request (GET /v1/me names the org a key acts in from that row).
 *
 * The session token does not carry the org name (its `o` claim is id, role and
 * slug only), so it is read from Clerk's Backend API and cached per org for a few
 * minutes: one Clerk call per org per TTL, not one per proxied request.
 *
 * Forwarded verbatim: never slugified, trimmed or defaulted. No name means no
 * header. A Clerk failure is logged and the header omitted for that request: the
 * header is optional enrichment, and failing every proxied request because a
 * label lookup failed would take the dashboard down. Failures are not cached.
 */
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { name: string | null; at: number }>();

export async function getOrgName(orgId: string): Promise<string | null> {
  const hit = cache.get(orgId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.name;
  try {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: orgId });
    const name = org.name ? org.name : null;
    cache.set(orgId, { name, at: Date.now() });
    return name;
  } catch (err) {
    console.error("[org-name] Clerk getOrganization failed, x-org-name omitted", { orgId, err });
    return null;
  }
}

/** Test-only: module state outlives a single test. */
export function resetOrgNameCache(): void {
  cache.clear();
}
