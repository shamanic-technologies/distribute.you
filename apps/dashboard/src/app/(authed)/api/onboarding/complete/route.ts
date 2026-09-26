import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { recordAcquisition } from "@/lib/client-service";
import { firstTouchForHandover } from "@/lib/first-touch";
import { onboardingBrandCookieName } from "@/lib/onboarding-brand-cookie";

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
export async function POST(req: NextRequest) {
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

  // Backstop for the first-touch hand-over the signup already made: whichever
  // lands first wins at client-service, so this is a no-op when that one did.
  // Never fatal — it logs its own failure.
  await recordAcquisition(
    { externalOrgId: orgId, externalUserId: userId },
    firstTouchForHandover(req.headers.get("cookie")),
  );

  // This is the terminal signal, so it is where the resume is retired: the org
  // now passes the edge gate, and a stale in-progress-brand cookie would send a
  // finished user back into the flow. One clear point, server-side, on the path
  // the launch already calls.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(onboardingBrandCookieName(orgId), "", {
    path: "/",
    maxAge: 0,
  });
  return res;
}
