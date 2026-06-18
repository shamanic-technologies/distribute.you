import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";

/**
 * POST /api/admin/orgs/:orgId/join
 *
 * Makes the calling admin a real Clerk member (role `org:admin`) of the target
 * org, so the membership-scoped data path (DIS-143: Clerk active org → JWT →
 * gateway `x-external-org-id`) works unchanged when they switch into a customer's
 * org. Without an actual membership, Clerk `setActive({ organization })` rejects
 * and the breadcrumb switch fails. Idempotent: a no-op if already a member.
 * Staff-only (re-checked off the session `email` claim; edge already gates).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdminEmail(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const client = await clerkClient();

  try {
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
    });
    const alreadyMember = memberships.data.some(
      (m) => m.organization.id === orgId,
    );
    if (!alreadyMember) {
      await client.organizations.createOrganizationMembership({
        organizationId: orgId,
        userId,
        role: "org:admin",
      });
    }
  } catch (err) {
    console.error(`[admin-join] failed to join org ${orgId}:`, err);
    return NextResponse.json(
      {
        error: "Join failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
