import { z } from "zod";

/**
 * Monitoring > Box > Watchdogs (staff only, BOX-WATCHDOGS-1030), alias-free so vitest reads it directly.
 *
 * Every watchdog cron on the production box (deploy pipeline, service health, workflow queue, Jev judgments, our own org's
 * credit, social posting) posts ONE run per tick to features-service (#2157, `POST /internal/box-checks/runs`, in-container
 * via distribute-box `box-check.sh`). They used to email Kevin; owner 2026-10-22 « no email in my inbox please », then
 * 2026-10-29 « Why do U receive this??? » on a false "deploy cron has not ticked" mail. Read through api-service's staff
 * passthrough: `GET /v1/features/audit/box-checks?days=N&expect=…`. The producer serves each check's verdict (broken / ok /
 * not_yet; a check silent past 3x its cadence is broken), its reason in plain words, a daily series (a day with no run is
 * absent) and every run of the last 48 h, broken checks first. The page draws those as served: no sort, no re-grading.
 */

const num = z.number();

export const BoxCheckDaySchema = z.object({
  day: z.string(),
  runs: num,
  failedRuns: num,
  valueMin: num.nullable(),
  valueMax: num.nullable(),
  valueMean: num.nullable(),
  valueLast: num.nullable(),
});

export const BoxCheckRunSchema = z.object({ ranAt: z.string(), ok: z.boolean(), value: num.nullable() });

export const BoxCheckSchema = z.object({
  check: z.string(),
  label: z.string().nullable(),
  verdict: z.enum(["broken", "ok", "not_yet"]),
  reason: z.string(),
  stale: z.boolean(),
  lastRunAt: z.string().nullable(),
  lastRunOk: z.boolean().nullable(),
  minutesSinceLastRun: num.nullable(),
  cadenceMinutes: num.nullable(),
  staleAfterMinutes: num.nullable(),
  brokenSince: z.string().nullable(),
  unit: z.string().nullable(),
  latestValue: num.nullable(),
  latestDetails: z.unknown().nullable(),
  daily: z.array(BoxCheckDaySchema),
  recent: z.array(BoxCheckRunSchema),
});

export const BoxChecksSchema = z.object({
  status: z.enum(["red", "green"]),
  brokenCount: num,
  reason: z.string(),
  windowDays: num,
  recentHours: num,
  staleCadenceMultiplier: num,
  checks: z.array(BoxCheckSchema),
});

export type BoxChecks = z.infer<typeof BoxChecksSchema>;
export type BoxCheck = BoxChecks["checks"][number];
export type BoxCheckDay = BoxCheck["daily"][number];
export type BoxCheckRun = BoxCheck["recent"][number];

/**
 * The watchdogs the box runs today, sent as `expect` so one that never reported reads "not yet" (never red) instead of
 * being absent. Display names only for a check that has not reported its own `label` yet.
 */
export const EXPECTED_BOX_CHECKS: Record<string, string> = {
  "deploy-pipeline": "Deploy pipeline",
  "service-health": "Service health",
  "workflow-queue": "Workflow queue",
  "jev-judgments": "Jev judgments",
  "own-org-balance": "Our own org's credit",
  "social-posting": "Social posting",
};

export const boxCheckName = (c: Pick<BoxCheck, "check" | "label">) => c.label ?? EXPECTED_BOX_CHECKS[c.check] ?? c.check;

/** "every 5 min", "every 6 h", "every day": the cadence the watchdog itself declared. */
export function cadenceLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes % 1440 === 0) return minutes === 1440 ? "every day" : `every ${minutes / 1440} days`;
  if (minutes % 60 === 0) return minutes === 60 ? "every hour" : `every ${minutes / 60} h`;
  return `every ${minutes} min`;
}

/** "15 min", "18 h", "3 days" off a served number of minutes. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 2880) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} days`;
}

/** "just now", "3 min ago", "2 h ago", "4 days ago" off the served minutes. */
export function agoLabel(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes < 1) return "just now";
  return `${durationLabel(minutes)} ago`;
}
