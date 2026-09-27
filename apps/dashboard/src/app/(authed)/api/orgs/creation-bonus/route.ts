import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { grantOrgCreationBonus } from "@/lib/billing-service";
import { resolveIdentity } from "@/lib/client-service";

/**
 * Credit the org the request is scoped to with its creation bonus.
 *
 * Called by the v2 "New organization" modal right after it creates the org, with a
 * token Clerk minted FOR that org, so `auth().orgId` is the new org and never a value
 * the client picked. Billing grants it once per org, so a retry is safe.
 *
 * Only an org created in the last hour qualifies: the bonus pays for a new org's
 * setup, and without the bound anyone could post this for every org they already
 * belong to.
 */
const CREATION_WINDOW_MS = 60 * 60 * 1000;

export async function POST() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  if (Date.now() - org.createdAt > CREATION_WINDOW_MS) {
    return NextResponse.json({ error: "Only a newly created organization gets the creation bonus" }, { status: 409 });
  }

  const identity = await resolveIdentity(orgId, userId);
  await grantOrgCreationBonus(identity.orgId);
  console.log(`[creation-bonus] granted org=${orgId} internal=${identity.orgId} by user=${userId}`);
  return NextResponse.json({ ok: true });
}
