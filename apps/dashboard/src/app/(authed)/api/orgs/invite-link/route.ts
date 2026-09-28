import { randomBytes } from "node:crypto";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { readInviteLink } from "@/lib/org-invite-link-store";

/**
 * The org's shareable invite link: GET reads it, POST creates it (or returns the one
 * that exists), DELETE revokes it. One link per org; revoking and creating again
 * mints a new code, so an old link stops working the moment it is revoked.
 *
 * The code lives on the Clerk org's privateMetadata, readable server-side only. The
 * org is `auth().orgId` and the caller must be an admin of it; the `orgId` the page
 * sends must equal it, so a tab showing one org cannot touch another's link.
 */
async function gate(orgIdFromClient: string | null) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!orgId || orgIdFromClient !== orgId) {
    return { error: NextResponse.json({ error: "This page is open on another organization. Reload it and try again." }, { status: 409 }) };
  }
  if (orgRole !== "org:admin") {
    return { error: NextResponse.json({ error: "Only an admin of this organization can manage the invite link." }, { status: 403 }) };
  }
  return { userId, orgId };
}

export async function GET(req: Request) {
  const g = await gate(new URL(req.url).searchParams.get("orgId"));
  if ("error" in g) return g.error;
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: g.orgId });
  const link = readInviteLink(org.privateMetadata);
  return NextResponse.json({ code: link?.code ?? null, createdAt: link?.createdAt ?? null });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { orgId?: unknown } | null;
  const g = await gate(typeof body?.orgId === "string" ? body.orgId : null);
  if ("error" in g) return g.error;
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: g.orgId });
  const existing = readInviteLink(org.privateMetadata);
  if (existing) return NextResponse.json({ code: existing.code, createdAt: existing.createdAt });
  const link = { code: randomBytes(18).toString("base64url"), createdAt: new Date().toISOString(), createdBy: g.userId };
  await client.organizations.updateOrganizationMetadata(g.orgId, { privateMetadata: { inviteLink: link } });
  console.log(`[invite-link] created for org=${g.orgId} by user=${g.userId}`);
  return NextResponse.json({ code: link.code, createdAt: link.createdAt });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { orgId?: unknown } | null;
  const g = await gate(typeof body?.orgId === "string" ? body.orgId : null);
  if ("error" in g) return g.error;
  const client = await clerkClient();
  await client.organizations.updateOrganizationMetadata(g.orgId, { privateMetadata: { inviteLink: null } });
  console.log(`[invite-link] revoked for org=${g.orgId} by user=${g.userId}`);
  return NextResponse.json({ code: null });
}
