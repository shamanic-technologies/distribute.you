/**
 * Beta-surface email allowlist for the admin app.
 *
 * Byte-equal copy of `apps/dashboard/src/lib/beta-allowlist.ts` (kept in lockstep):
 * gates the beta optimization goals shown in the shared Brand Sales Economics card,
 * off the Clerk user's email, zero fetch.
 *
 * To graduate a beta surface to GA, drop its gate (don't widen this list).
 */
export const BETA_ALLOWED_EMAILS = [
  "kevin.lourd@gmail.com",
  "kevin@distribute.you",
  "kevin@pressbeat.io",
];

export function isBetaEmail(email?: string | null): boolean {
  return !!email && BETA_ALLOWED_EMAILS.includes(email);
}
