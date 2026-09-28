import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { INVITE_ROLE, parseJoinToken } from "@/lib/org-invite";
import { inviteCodeMatches, readInviteLink } from "@/lib/org-invite-link-store";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { sendTeamMemberJoinedEmails } from "@/lib/team-joined-email";

/**
 * POST /api/join  { token }
 *
 * The signed-in caller joins the org the invite link names, as an Admin, if the
 * link's code is still the one stored on that org. A pending session counts as signed
 * in here: somebody who just created an account through the link has no org yet, which
 * is exactly why they are here.
 *
 * Every other admin of the org is then emailed, which is the guard this link relies on
 * (it has no expiry and anyone holding it can join). Joining an org you already belong
 * to succeeds and emails nobody.
 */
function isAlreadyMemberError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    Array.isArray((err as { errors?: unknown }).errors) &&
    (err as { errors: Array<{ code?: string }> }).errors.some((e) => e?.code === "already_a_member_in_organization")
  );
}

export async function POST(req: Request) {
  const { userId } = await auth({ treatPendingAsSignedOut: false });
  if (!userId) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const parsed = parseJoinToken(typeof body?.token === "string" ? body.token : null);
  if (!parsed) return NextResponse.json({ error: "This invite link is not valid." }, { status: 404 });

  const client = await clerkClient();
  let org;
  try {
    org = await client.organizations.getOrganization({ organizationId: parsed.orgId });
  } catch (err) {
    console.error(`[join] org ${parsed.orgId} not readable`, err);
    return NextResponse.json({ error: "This invite link is not valid." }, { status: 404 });
  }
  if (!inviteCodeMatches(readInviteLink(org.privateMetadata), parsed.code)) {
    return NextResponse.json({ error: "This invite link was revoked. Ask your team for a new one." }, { status: 410 });
  }

  try {
    await client.organizations.createOrganizationMembership({ organizationId: org.id, userId, role: INVITE_ROLE });
  } catch (err) {
    if (isAlreadyMemberError(err)) return NextResponse.json({ orgId: org.id, alreadyMember: true });
    console.error(`[join] membership for user=${userId} in org=${org.id} failed`, err);
    return NextResponse.json({ error: "Could not add you to the team. Try again." }, { status: 502 });
  }

  const joiner = await client.users.getUser(userId);
  const joinerEmail = joiner.primaryEmailAddress?.emailAddress ?? "";
  console.log(`[join] user=${userId} (${joinerEmail}) joined org=${org.id} via invite link`);

  // Tell every other admin. Staff are god-mode members of every org and are not the
  // customer's team, so they are not told. A failed notification is logged, never a
  // failed join: the person is already in.
  const memberships = await client.organizations.getOrganizationMembershipList({ organizationId: org.id, limit: 100 });
  const recipients = memberships.data
    .filter((m) => m.role === "org:admin" && m.publicUserData?.userId !== userId)
    .map((m) => m.publicUserData?.identifier ?? "")
    .filter((email) => email && !isAdminEmail(email));
  try {
    await sendTeamMemberJoinedEmails({ orgId: org.id, orgName: org.name, joinerUserId: userId, joinerEmail, recipients });
  } catch (err) {
    console.error(`[join] joined-notification for org=${org.id} failed`, err);
  }

  return NextResponse.json({ orgId: org.id });
}
