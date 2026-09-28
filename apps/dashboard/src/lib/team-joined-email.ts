/**
 * "Somebody joined your team" — sent to every other admin when a person joins an
 * org through its invite link. That email is the guard the link relies on (no
 * expiry, anyone holding it becomes an Admin), so it names who joined and says where
 * to revoke the link.
 *
 * Template `team_member_joined` is registered at boot in `instrumentation.ts`.
 */
export const TEAM_MEMBER_JOINED_TEMPLATE = "team_member_joined";

export async function sendTeamMemberJoinedEmails(input: {
  orgId: string;
  orgName: string;
  joinerUserId: string;
  joinerEmail: string;
  recipients: string[];
}): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL?.replace(/\/$/, "");
  const adminKey = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!apiUrl || !adminKey) throw new Error("[team-joined-email] NEXT_PUBLIC_DISTRIBUTE_API_URL and ADMIN_DISTRIBUTE_API_KEY are required");

  for (const recipientEmail of input.recipients) {
    const res = await fetch(`${apiUrl}/v1/emails/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": adminKey,
        "x-external-org-id": input.orgId,
        "x-external-user-id": input.joinerUserId,
      },
      body: JSON.stringify({
        eventType: TEAM_MEMBER_JOINED_TEMPLATE,
        recipientEmail,
        // One email per (joiner, recipient): a retried join never mails twice.
        productId: `${TEAM_MEMBER_JOINED_TEMPLATE}:${input.orgId}:${input.joinerUserId}:${recipientEmail}`,
        metadata: {
          orgName: input.orgName,
          joinerEmail: input.joinerEmail,
          teamUrl: `https://dashboard.distribute.you/orgs/${input.orgId}`,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`[team-joined-email] send to ${recipientEmail} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  }
}
