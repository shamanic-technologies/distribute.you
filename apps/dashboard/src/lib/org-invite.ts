/**
 * Inviting a teammate into an organization.
 *
 * Clerk owns the invitation (it stores it, mails it, and turns the link into a
 * membership), so this module only states our side of it: which roles a person may
 * be invited as, what an address has to look like before we ask Clerk, where the
 * link in the email lands, and where the new member goes once they are in.
 *
 * Alias-free on purpose so every rule here carries real unit tests.
 */

export const INVITE_ROLES = ["org:admin", "org:member"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const INVITE_ROLE_LABEL: Record<InviteRole, string> = {
  "org:admin": "Admin",
  "org:member": "Member",
};

export function isInviteRole(value: unknown): value is InviteRole {
  return typeof value === "string" && (INVITE_ROLES as readonly string[]).includes(value);
}

// Shape only: whether the address can receive mail is Clerk's answer.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInviteEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isInvitableEmail(raw: string): boolean {
  return EMAIL_SHAPE.test(normalizeInviteEmail(raw));
}

/** The origin a link in the invitation email may point at. Anything else falls back to prod. */
export const DASHBOARD_ORIGIN = "https://dashboard.distribute.you";
const ALLOWED_ORIGINS = new Set([
  DASHBOARD_ORIGIN,
  "https://app.distribute.you",
  "http://localhost:3001",
]);

/**
 * Where the link in Clerk's email lands. Clerk appends `__clerk_ticket` and
 * `__clerk_status` to it; `/invite` reads both. The org id rides along so the new
 * member is made active in THAT org, rather than whichever org Clerk picks first.
 * A caller-supplied origin is only honoured when it is one of ours, so an invite can
 * never be pointed at somebody else's site.
 */
export function inviteRedirectUrl(origin: string | null | undefined, orgId: string): string {
  const base = origin && ALLOWED_ORIGINS.has(origin) ? origin : DASHBOARD_ORIGIN;
  return `${base}/invite?org=${encodeURIComponent(orgId)}`;
}

/** Where a member lands once the invitation is accepted: the org itself, which resolves its last brand. */
export function inviteLandingHref(orgId: string | null): string {
  return orgId ? `/orgs/${encodeURIComponent(orgId)}` : "/orgs";
}

export type InviteTicketStatus = "sign_up" | "sign_in" | "complete";

/** Clerk's `__clerk_status`, read as one of the three values it documents, or null. */
export function parseInviteStatus(raw: string | null): InviteTicketStatus | null {
  return raw === "sign_up" || raw === "sign_in" || raw === "complete" ? raw : null;
}
