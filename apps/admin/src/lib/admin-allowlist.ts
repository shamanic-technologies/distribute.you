/**
 * Admin-only staff allowlist. The admin app is a fork of the dashboard served
 * on admin.distribute.you; only internal staff may use it. The list is the
 * single source of truth, consumed by:
 *  - the edge gate in `proxy.ts` (refuses any signed-in non-staff with 403), and
 *  - the `/api/admin/*` route handlers (defense-in-depth re-check server-side).
 *
 * Gated off the session `email` claim — zero fetch.
 */
export const ADMIN_ALLOWED_EMAILS = [
  "kevin.lourd@gmail.com",
  "kevin@distribute.you",
  "adam@distribute.you",
  "adam2d3d@gmail.com",
];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_ALLOWED_EMAILS.includes(email);
}
