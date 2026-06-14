import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Marks the active org's onboarding as complete by setting
 * `organization.publicMetadata.onboardingComplete = true`.
 *
 * This is the durable first-run signal (DIS-111): it is surfaced as a Clerk
 * session-token claim and read at the edge in `proxy.ts`, so the onboarding
 * gate is decided server-side pre-paint with zero data fetch — no dashboard
 * flash, no coupling to the (slow) brands API.
 *
 * Called on brand creation (the moment an org becomes a usable workspace).
 * The org id is derived server-side from the session — never trusted from the
 * client. `updateOrganizationMetadata` deep-merges, so this is idempotent.
 */
export async function POST() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 }
    );
  }

  const client = await clerkClient();
  await client.organizations.updateOrganizationMetadata(orgId, {
    publicMetadata: { onboardingComplete: true },
  });

  return NextResponse.json({ ok: true });
}
