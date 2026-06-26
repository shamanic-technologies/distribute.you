import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";

/**
 * A Clerk `createOrganizationMembership` rejection whose code is
 * `already_a_member_in_organization` — the idempotent success case (the user is
 * already in the org, which is exactly what this route guarantees).
 */
function isAlreadyMemberError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "errors" in err &&
    Array.isArray((err as { errors?: unknown }).errors) &&
    (err as { errors: Array<{ code?: string }> }).errors.some(
      (e) => e?.code === "already_a_member_in_organization",
    )
  );
}

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
    await client.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId,
      role: "org:admin",
    });
  } catch (err) {
    // Idempotent: "already a member" IS success — this route's job is to GUARANTEE
    // the staff member belongs to the org, not to create the membership exactly
    // once. The previous guard read only the FIRST PAGE of
    // getOrganizationMembershipList, so for staff who god-mode-joined many orgs an
    // existing membership beyond page 1 looked absent → re-create → Clerk 400
    // `already_a_member_in_organization` → 502 → OrgActivator threw before
    // setActive → the active org never switched → every /api/v1 read 409'd → blank
    // org page. Trust Clerk's response (server-side source of truth) over a paged
    // pre-check. Any other error is a real failure → 502.
    if (isAlreadyMemberError(err)) {
      return NextResponse.json({ ok: true, alreadyMember: true });
    }
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
