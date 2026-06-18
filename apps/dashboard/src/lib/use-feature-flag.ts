/**
 * Alpha/beta surfaces are DISABLED in the dashboard app.
 *
 * As of the admin/dashboard split (2026-06-14), every maturity-gated
 * (alpha/beta) feature lives ONLY in the admin app (admin.distribute.you).
 * The public dashboard is GA-only: every alpha/beta surface gates through this
 * hook, so returning `false` unconditionally hard-removes them for everyone
 * (staff included) without touching each call site. GA features carry no flag
 * and are unaffected.
 *
 * The admin copy of this file keeps the real PostHog-driven implementation, so
 * staff still see alpha/beta there. To bring a feature to the public dashboard,
 * graduate it to GA (drop its gate), not by re-enabling this hook.
 */
export function useFeatureFlag(_flag: string): boolean {
  return false;
}
