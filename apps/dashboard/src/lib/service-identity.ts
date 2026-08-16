/**
 * The identity a PLATFORM JOB sends to the api-service gateway.
 *
 * Every admin-key call carries `x-external-org-id` + `x-external-user-id`, and the
 * gateway resolves that pair through client-service `/internal/resolve`, which
 * UPSERTS a `users` row for whatever external user id it is handed. That is right
 * for a person signing in; it is a row-per-call-site for a cron.
 *
 * These three call sites have no person behind them — a nightly digest scan, a
 * public report read, a share-link read — so each was inventing an id keyed on the
 * org (`outcome-digest:org_ABC`). One row per org per job, forever: prod reached
 * **89 such rows against 64 real users**, and client-service's public user count
 * (the figure the `/investors` page prints) read **153**, because its exclusion
 * list only knew about `system-%` and two test ids.
 *
 * So the id is keyed on the JOB, not the org, and it lives in the `system-`
 * namespace client-service already excludes. Three rows instead of eighty-nine,
 * counted as users by nobody.
 *
 * Nothing is lost by dropping the org from the id: the org travels on its own
 * header and is stored on the run row (`runs.organization_id`), so per-org
 * attribution is unaffected. `users.orgId` does churn on the shared row as the
 * scan walks orgs — harmless, because the gateway reads the org from the ORG
 * upsert, never from the user row.
 */
export const SERVICE_IDENTITY = {
  /** The nightly outcome-digest fleet scan (`lib/outcome-digest.ts`). */
  outcomeDigest: "system-outcome-digest",
  /** The no-login public report proxy (`admin/lib/report-api.ts`). */
  reportPublic: "system-report-public",
  /** The read-only share-link proxy (`app/share/[token]/api/v1`). */
  sharePublic: "system-share-public",
} as const;

/**
 * True when an external user id belongs to a platform job rather than a person.
 * Clerk mints every real user id as `user_...`, so the namespace is unambiguous.
 */
export function isServiceIdentity(externalUserId: string): boolean {
  return externalUserId.startsWith("system-");
}
