import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";

/**
 * GET /api/admin/orgs/names?ids=org_a,org_b,...
 *
 * Batch-resolves Clerk organization DISPLAY NAMES for a set of Clerk org ids.
 * Org names live only in Clerk (client-service `orgs.name` is null for everyone),
 * so a cross-org surface that has internal org ids + their Clerk external ids —
 * e.g. the Audit → Accounts table — resolves the human-readable org name here.
 * `getOrganizationList` is search/cap-based (no by-id-set filter), so we fetch
 * each id directly via `getOrganization`. The active-brands fleet is small, so N
 * is small; a failed lookup drops that id from the map (the caller falls back to
 * the brand domain / owner email as the label). Staff-only: re-checked off the
 * session `email` claim (the edge gate in proxy.ts already blocks non-staff).
 */
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdminEmail(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ names: {} });
  }

  const client = await clerkClient();
  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, string] | null> => {
      try {
        const org = await client.organizations.getOrganization({ organizationId: id });
        return org.name ? [id, org.name] : null;
      } catch {
        // Unknown / deleted org id → drop from the map; caller labels it by
        // brand domain / owner email instead. Not a hard failure of the batch.
        return null;
      }
    }),
  );

  const names: Record<string, string> = {};
  for (const entry of entries) {
    if (entry) names[entry[0]] = entry[1];
  }

  return NextResponse.json({ names });
}
