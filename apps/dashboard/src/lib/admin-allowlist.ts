/**
 * Internal staff allowlist. UNLIKE the admin app (admin.distribute.you, which is
 * staff-only and edge-gated as a whole), the dashboard is the CUSTOMER surface —
 * every logged-in user reaches it. So this list does NOT gate the app; it gates
 * the staff-only "god-mode" org switcher: `isAdminEmail` is the PRIMARY security
 * boundary on `/api/admin/*` here (there is NO edge allowlist behind it). A
 * non-staff caller MUST get 403 from those routes, and the breadcrumb only shows
 * the all-orgs switcher to staff — regular users see only their own memberships.
 *
 * Keep byte-equal with `apps/admin/src/lib/admin-allowlist.ts`.
 */
export const ADMIN_ALLOWED_EMAILS = [
  "kevin.lourd@gmail.com",
  "kevin@distribute.you",
];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_ALLOWED_EMAILS.includes(email);
}
