/**
 * Invite + claim API callers for the dashboard.
 * Routes through the existing /api/v1 proxy (Clerk session cookies for auth).
 * URL contracts locked in DIS-64.
 */

export interface InviteStatus {
  used: number;
  total: number;
  code: string;
  expired: boolean;
}

export interface ClaimResponse {
  ok: boolean;
  rewardGranted: boolean;
}

export async function getInviteStatus(orgId: string): Promise<InviteStatus> {
  const res = await fetch(`/api/v1/orgs/${orgId}/invites/status`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`getInviteStatus failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function claimInvite(
  orgId: string,
  code: string,
): Promise<ClaimResponse> {
  const res = await fetch(`/api/v1/orgs/${orgId}/invites/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new Error(`claimInvite failed: HTTP ${res.status}`);
  }
  return res.json();
}
