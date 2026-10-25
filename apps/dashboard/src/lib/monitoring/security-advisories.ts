import { z } from "zod";

/**
 * Monitoring > Security > Advisories (staff only, SEC-ADVISORIES-MONITORING-1025), alias-free so vitest reads it directly.
 *
 * The owner's daily audit job (npm/pnpm audit over every repo running in prod) posts one report a day to
 * features-service (#2083), read through api-service's staff passthrough (#1382):
 * `GET /v1/features/audit/security-advisories?days=N`. The producer serves the red/green VERDICT and its plain-words
 * reason, the fleet totals per day, and every repo red first. The page renders those as they are: no sort, no sum,
 * no re-grading from the counts. A day with no report is `reported: false` / `status: "missing"` with NULL counts:
 * a gap, never a zero. Red on the hub IS the alert (no email, owner 2026-10-22).
 */

const count = z.number().nullable();

export const AdvisoryPointStatusSchema = z.enum(["red", "green", "missing"]);
export type AdvisoryPointStatus = z.infer<typeof AdvisoryPointStatusSchema>;

export const RepoDayPointSchema = z.object({
  day: z.string(),
  status: AdvisoryPointStatusSchema,
  critical: count,
  high: count,
  moderate: count,
  low: count,
  packages: z.array(z.string()),
  error: z.string().nullish(),
});
export type RepoDayPoint = z.infer<typeof RepoDayPointSchema>;

export const FleetDayPointSchema = z.object({
  day: z.string(),
  reported: z.boolean(),
  repoCount: z.number(),
  critical: count,
  high: count,
  moderate: count,
  low: count,
  failedAudits: z.number(),
  redRepoCount: z.number(),
});
export type FleetDayPoint = z.infer<typeof FleetDayPointSchema>;

export const SecurityAdvisoriesSchema = z.object({
  status: z.enum(["red", "green"]),
  reason: z.string(),
  staleAfterHours: z.number(),
  stale: z.boolean(),
  lastReportAt: z.string().nullish(),
  hoursSinceLastReport: z.number().nullish(),
  latestDay: z.string().nullish(),
  redRepos: z.array(
    z.object({
      repo: z.string(),
      reason: z.string(),
      critical: count,
      high: count,
      packages: z.array(z.string()),
      error: z.string().nullish(),
    }),
  ),
  windowDays: z.number(),
  days: z.array(z.string()),
  daily: z.array(FleetDayPointSchema),
  repos: z.array(
    z.object({
      repo: z.string(),
      status: AdvisoryPointStatusSchema,
      inLatestReport: z.boolean(),
      latest: RepoDayPointSchema.nullish(),
      series: z.array(RepoDayPointSchema),
    }),
  ),
});
export type SecurityAdvisories = z.infer<typeof SecurityAdvisoriesSchema>;
export type SecurityRepo = SecurityAdvisories["repos"][number];

/** The producer's own status word, capitalised. */
export function statusWord(s: AdvisoryPointStatus): string {
  return s === "red" ? "Red" : s === "green" ? "Green" : "Missing";
}
