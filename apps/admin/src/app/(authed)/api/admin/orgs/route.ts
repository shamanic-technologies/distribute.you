import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin-allowlist";

/**
 * GET /api/admin/orgs?q=<search>
 *
 * Lists EVERY organization on the Clerk instance (platform-wide) so an admin can
 * jump into any customer's org/brand from the breadcrumb — not only the orgs they
 * are already a member of (`useOrganizationList({ userMemberships })`). Backed by
 * the Clerk Backend API (`getOrganizationList`), which the admin app can call via
 * `CLERK_SECRET_KEY`. Search-driven + capped because the instance may hold many
 * orgs. Staff-only: re-checked off the session `email` claim (the edge gate in
 * proxy.ts already blocks non-staff; this is defense-in-depth).
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
