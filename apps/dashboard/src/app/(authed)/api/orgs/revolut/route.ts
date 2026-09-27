import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { declareRevolutAcquirer } from "@/lib/billing-service";
import { resolveIdentity } from "@/lib/client-service";

/**
 * Declare that the org the request is scoped to pays through Revolut (owner-decided
 * 2026-09-27 for orgs set up in the v2 modal). Called by the modal right before its
 * payment step asks for a card or a top-up, with a token minted for the org, so
 * `auth().orgId` is that org and never a value the client picked.
 *
 * An org that already holds a card elsewhere keeps paying there: billing answers 409,
 * which this reports as `card_elsewhere` rather than an error.
 */
export async function POST() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress ?? undefined;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;

  const identity = await resolveIdentity(orgId, userId);
  const result = await declareRevolutAcquirer(identity.orgId, identity.userId, { email, fullName });
  console.log(`[revolut-acquirer] org=${orgId} internal=${identity.orgId} result=${result}`);
  return NextResponse.json({ ok: true, result });
}
