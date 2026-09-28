import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  inviteRedirectUrl,
  isInvitableEmail,
  isInviteRole,
  normalizeInviteEmail,
  sanitizeInviteBrand,
} from "@/lib/org-invite";

/**
 * POST /api/orgs/invitations  { orgId, emailAddress, role }
 *
 * Invites a teammate into the org the request is scoped to. Clerk stores the
 * invitation and mails it; this route exists (rather than the browser calling
 * Clerk directly) because only the Backend API lets us say where the link lands,
 * and that has to be our `/invite` page, which knows how to turn the ticket into an
 * account inside THIS org.
 *
 * The org is `auth().orgId`, never a value the client picked: the body's `orgId`
 * must equal it, so a tab showing one org cannot invite into another. Only an
 * admin of that org may invite.
 */
function clerkErrorText(err: unknown): string | null {
  if (typeof err === "object" && err !== null && "errors" in err) {
    const first = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors?.[0];
    return first?.longMessage ?? first?.message ?? null;
  }
  return null;
}

export async function POST(req: Request) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "No active organization" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as
    | { orgId?: unknown; emailAddress?: unknown; role?: unknown; brand?: unknown }
    | null;
  if (!body || body.orgId !== orgId) {
    return NextResponse.json({ error: "This page is open on another organization. Reload it and try again." }, { status: 409 });
  }
  if (orgRole !== "org:admin") {
    return NextResponse.json({ error: "Only an admin of this organization can invite people." }, { status: 403 });
  }
  if (typeof body.emailAddress !== "string" || !isInvitableEmail(body.emailAddress)) {
    return NextResponse.json({ error: "Enter a full email address, like name@company.com." }, { status: 400 });
  }
  if (!isInviteRole(body.role)) {
    return NextResponse.json({ error: "Pick a role: Admin or Member." }, { status: 400 });
  }

  const emailAddress = normalizeInviteEmail(body.emailAddress);
  const client = await clerkClient();
  try {
    const invitation = await client.organizations.createOrganizationInvitation({
      organizationId: orgId,
      inviterUserId: userId,
      emailAddress,
      role: body.role,
      // The brand rides the link so the invite page can greet with it; display only.
      redirectUrl: inviteRedirectUrl(req.headers.get("origin"), orgId, sanitizeInviteBrand(body.brand)),
    });
    console.log(`[org-invitations] invited ${emailAddress} as ${body.role} to org=${orgId} by user=${userId}`);
    return NextResponse.json({ id: invitation.id, emailAddress, role: body.role });
  } catch (err) {
    // Clerk refuses an address that is already a member or already invited, and says
    // so in words a person can act on, so that sentence is what the form shows.
    const text = clerkErrorText(err);
    console.error(`[org-invitations] invite ${emailAddress} to org=${orgId} failed:`, err);
    if (text) return NextResponse.json({ error: text }, { status: 400 });
    return NextResponse.json({ error: "Could not send the invitation. Try again." }, { status: 502 });
  }
}
