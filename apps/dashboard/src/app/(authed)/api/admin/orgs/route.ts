import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";

/**
 * GET /api/admin/orgs?q=<search>
 *
 * Staff-only "god-mode" org list: every organization on the Clerk instance, so a
 * staff member can jump into any customer's org/brand from the breadcrumb. Regular
 * users never call this (the breadcrumb only shows the all-orgs switcher to staff)
 * and would be refused anyway.
 *
 * SECURITY: the dashboard is the customer surface — there is NO edge allowlist in
 * front of this route, so the `isAdminEmail` check below is the SOLE boundary
 * stopping a non-staff customer from enumerating every tenant. Do not weaken it.
 */
export async function GET(req: NextRequest) {
  const { userId, sessionClaims } = await auth();
  if (!userId || !isAdminEmail(sessionClaims?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const client = await clerkClient();
  const { data, totalCount } = await client.organizations.getOrganizationList({
    ...(q ? { query: q } : {}),
    limit: 50,
    orderBy: "-created_at",
  });

  return NextResponse.json({
    organizations: data.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      imageUrl: o.imageUrl,
      hasImage: o.hasImage,
      membersCount: o.membersCount,
    })),
    totalCount,
  });
}
