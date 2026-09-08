import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isPlausibleGclid } from "@/lib/gclid-cookie";

/**
 * POST /api/ads/attribution  { gclid }
 *
 * Records the Google Ads click that produced this org's signup, on the org's
 * Clerk `publicMetadata` (`gclid`, `gclidAt`) — the same store `onboardingComplete`
 * lives in, and the one place the dashboard already writes org-level facts.
 *
 * FIRST TOUCH ONLY. A gclid is a claim about which ad brought the customer; a later
 * ad click by an existing customer (a retargeting impression, a brand search) is
 * not a new acquisition, and overwriting would move the credit to it. So an org that
 * already carries a gclid keeps it.
 *
 * Read by the offline-conversion feed (`lib/ads-conversion-feed.ts`), which turns
 * this org's signup and paid top-ups into `offline_signup` / `offline_purchase`
 * rows keyed on the gclid.
 */
export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { gclid?: unknown } | null;
  const gclid = typeof body?.gclid === "string" ? body.gclid.trim() : "";
  if (!isPlausibleGclid(gclid)) {
    return NextResponse.json({ error: "gclid is required" }, { status: 400 });
  }

  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  const existing = org.publicMetadata?.gclid;
  if (typeof existing === "string" && existing.length > 0) {
    return NextResponse.json({ ok: true, firstTouch: false });
  }

  await client.organizations.updateOrganizationMetadata(orgId, {
    publicMetadata: { gclid, gclidAt: new Date().toISOString() },
  });
  console.log(`[dashboard-ads-attribution] org=${orgId} gclid recorded`);
  return NextResponse.json({ ok: true, firstTouch: true });
}
