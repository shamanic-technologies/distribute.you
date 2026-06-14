/**
 * Beta-surface email allowlist for the public dashboard.
 *
 * Background: in the dashboard app `useFeatureFlag()` is hard-disabled (returns
 * false unconditionally — alpha/beta surfaces live only in the admin app since
 * the 2026-06-14 split). So a dashboard surface that must ship to a SMALL set of
 * people (an opt-in beta) can't use the PostHog flag path. This allowlist is the
 * dashboard equivalent of `apps/admin/src/lib/admin-allowlist.ts`: a single
 * source of truth, gated off the Clerk user's email, zero fetch.
 *
 * To graduate a beta surface to GA, drop its gate (don't widen this list).
 */
export const BETA_ALLOWED_EMAILS = [
  "kevin.lourd@gmail.com",
  "kevin@distribute.you",
  "adam@distribute.you",
  "adam2d3d@gmail.com",
];

export function isBetaEmail(email?: string | null): boolean {
  return !!email && BETA_ALLOWED_EMAILS.includes(email);
}
