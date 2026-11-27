import { z } from "zod";

/**
 * Monitoring > Security > Secrets (staff only, SECURITY-ALERTS-1128-CHART), alias-free so vitest reads it directly.
 *
 * key-service writes an append-only audit row for every secret read or write and every request carrying a wrong
 * service key, and opens a security incident (mailed to staff ONCE, by key-service) on an unusual one. It serves the
 * daily series, the recent incidents and the red VERDICT at `GET /internal/security/daily?days=N`, read through
 * api-service's staff passthrough `GET /v1/keys/ops/security-daily`. The page draws those as served: no re-grading,
 * no sum. `red` already excludes staff `test` incidents (proof-of-fire), so a test incident never turns the tile red.
 * The series holds no key value or prefix, and this file shows none. No email from here.
 */

export const SecurityDaySchema = z.object({
  day: z.string(),
  secretReads: z.number(),
  secretReadsRefused: z.number(),
  keyWrites: z.number(),
  wrongKeyRequests: z.number(),
  incidentsOpened: z.number(),
});
export type SecurityDay = z.infer<typeof SecurityDaySchema>;

export const SecurityIncidentSchema = z.object({
  id: z.string(),
  kind: z.string(),
  subject: z.string(),
  summary: z.string(),
  openedAt: z.string(),
  lastSeenAt: z.string(),
  eventCount: z.number(),
  alertStatus: z.string(),
  alertError: z.string().nullable(),
  test: z.boolean(),
});
export type SecurityIncident = z.infer<typeof SecurityIncidentSchema>;

export const KeySecuritySchema = z.object({
  red: z.boolean(),
  incidentsLast24h: z.number(),
  undeliveredAlerts: z.number(),
  days: z.array(SecurityDaySchema),
  incidents: z.array(SecurityIncidentSchema),
});
export type KeySecurity = z.infer<typeof KeySecuritySchema>;

/** The hub tile's tone: the producer's verdict, nothing else (a test incident or a quiet day never makes it red). */
export function secretsTone(d: KeySecurity): "red" | "green" {
  return d.red ? "red" : "green";
}

/** The tile's one-second read, in plain words. */
export function secretsHeadline(d: KeySecurity): string {
  if (!d.red) return "Nothing wrong in 24 h";
  const parts: string[] = [];
  if (d.incidentsLast24h > 0) parts.push(`${d.incidentsLast24h} incident${d.incidentsLast24h === 1 ? "" : "s"} in 24 h`);
  if (d.undeliveredAlerts > 0) parts.push(`${d.undeliveredAlerts} alert${d.undeliveredAlerts === 1 ? "" : "s"} not delivered`);
  return parts.join(", ") || "Red";
}

const KIND_WORDS: Record<string, string> = {
  key_write: "Secret written",
  unknown_caller_decrypt: "Unknown caller read a secret",
  provider_sweep: "One caller read many secrets",
  auth_failure_burst: "Burst of wrong-key requests",
};

/** The incident kind in words; an unknown kind shows as served, never dropped. */
export function kindWords(kind: string): string {
  return KIND_WORDS[kind] ?? kind;
}

/** Whether staff got the alert email for this incident, in words. */
export function alertWords(i: SecurityIncident): string {
  if (i.alertStatus === "sent") return "Staff alerted";
  if (i.alertStatus === "pending") return "Alert sending";
  if (i.alertStatus === "failed") return "Alert not delivered";
  return i.alertStatus;
}
