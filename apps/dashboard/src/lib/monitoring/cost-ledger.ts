import { z } from "zod";

/**
 * Monitoring > Cost ledger (staff only, COST-ACCOUNTING-1023-MONITOR), alias-free so vitest reads it.
 *
 * runs-service is the general ledger (v0.47.60): every spending service declares, on its runs, the
 * outcomes it produced. Two stored reads watch it, through api-service's staff passthroughs:
 * - outcome coverage: per UTC day, the spend and the part of it whose run declared its outcome, fleet,
 *   per service, per task, with the served `coveragePct`;
 * - the to-the-cent check: per (UTC day, org), standard cost − reuse gain + spend that produced none
 *   = the ledger, on gross, net and vendor, with the served `balanced` verdict and the failing org-days.
 * This module only reshapes what is served (one point per day for the chart) and states the target.
 * It sums, divides and re-grades nothing. Red on the hub IS the alert (no email, owner 2026-10-22).
 */

/** The share of spend whose run declared its outcome we expect (owner 2026-10-23: exact to the cent). */
export const COVERAGE_TARGET_PCT = 95;

const Cents = z.string();

const CoveragePointShape = {
  day: z.string(),
  complete: z.boolean(),
  spendGrossCents: Cents,
  coveredGrossCents: Cents,
  spendNetCents: Cents,
  coveredNetCents: Cents,
  coveragePct: z.string().nullable(),
};

export const CoveragePointSchema = z.object(CoveragePointShape);
export type CoveragePoint = z.infer<typeof CoveragePointSchema>;

export const OutcomeCoverageSchema = z.object({
  allocationVersion: z.number(),
  since: z.string(),
  until: z.string(),
  daysMissing: z.array(z.string()),
  fleet: z.array(CoveragePointSchema),
  services: z.array(z.object({ ...CoveragePointShape, serviceName: z.string() })),
  tasks: z.array(z.object({ ...CoveragePointShape, serviceName: z.string(), taskName: z.string() })),
});
export type OutcomeCoverage = z.infer<typeof OutcomeCoverageSchema>;
export type ServiceCoverage = OutcomeCoverage["services"][number];
export type TaskCoverage = OutcomeCoverage["tasks"][number];

const LedgerMoneySchema = z.object({ grossCents: Cents, netCents: Cents, vendorCents: Cents, unpricedGrossCents: Cents });
export type LedgerMoney = z.infer<typeof LedgerMoneySchema>;

export const LedgerCheckRowSchema = z.object({
  day: z.string(),
  organizationId: z.string().nullable(),
  ledger: LedgerMoneySchema,
  allocated: LedgerMoneySchema,
  producedNone: LedgerMoneySchema,
  standard: LedgerMoneySchema,
  reuseGain: LedgerMoneySchema,
  differences: LedgerMoneySchema,
  balanced: z.boolean(),
  costRows: z.number(),
  occurrences: z.number(),
  reuseCount: z.number(),
  unknownProvenanceCount: z.number(),
});
export type LedgerCheckRow = z.infer<typeof LedgerCheckRowSchema>;

export const LedgerCheckSchema = z.object({
  allocationVersion: z.number(),
  allocationRule: z.string(),
  since: z.string(),
  until: z.string(),
  balanced: z.boolean(),
  complete: z.boolean(),
  daysMissing: z.array(z.string()),
  totals: z.object({ ledger: LedgerMoneySchema, standard: LedgerMoneySchema, reuseGain: LedgerMoneySchema, allocated: LedgerMoneySchema, producedNone: LedgerMoneySchema }),
  mismatches: z.array(LedgerCheckRowSchema),
  rows: z.array(LedgerCheckRowSchema),
});
export type LedgerCheck = z.infer<typeof LedgerCheckSchema>;

/** The day the hub reads: the latest finished day with spend, else the latest day with spend (today runs on). */
export function headlinePoint(c: OutcomeCoverage): CoveragePoint | null {
  const spent = c.fleet.filter((p) => p.coveragePct != null);
  return [...spent].reverse().find((p) => p.complete) ?? spent[spent.length - 1] ?? null;
}

/** Red when the served fleet share sits under the target. A day with no spend has no share, so no verdict. */
export function belowTarget(p: CoveragePoint | null): boolean {
  return p != null && p.coveragePct != null && Number(p.coveragePct) < COVERAGE_TARGET_PCT;
}

/** Until the first service declares an outcome on any day of the window, the services are still being wired. */
export function rolloutInProgress(c: OutcomeCoverage): boolean {
  return c.services.every((s) => Number(s.coveredGrossCents) === 0);
}

/** Services in the producer's order of first appearance. */
export function serviceNames(c: OutcomeCoverage): string[] {
  return [...new Set(c.services.map((s) => s.serviceName))];
}

/** One chart point per fleet day: the fleet's served % and each service's served % that day (null = no spend). */
export interface CoverageChartPoint {
  day: string;
  fleet: number | null;
  /** The fleet's served spend and covered spend that day, for the hover line. */
  spendGrossCents: string;
  coveredGrossCents: string;
  services: Record<string, number | null>;
}

export function coverageChart(c: OutcomeCoverage): CoverageChartPoint[] {
  const byDay = new Map<string, Record<string, number | null>>();
  for (const s of c.services) {
    const at = byDay.get(s.day) ?? {};
    at[s.serviceName] = s.coveragePct == null ? null : Number(s.coveragePct);
    byDay.set(s.day, at);
  }
  return c.fleet.map((p) => ({
    day: p.day,
    fleet: p.coveragePct == null ? null : Number(p.coveragePct),
    spendGrossCents: p.spendGrossCents,
    coveredGrossCents: p.coveredGrossCents,
    services: byDay.get(p.day) ?? {},
  }));
}

/** The rows of one day, in the producer's order. */
export function servicesOn(c: OutcomeCoverage, day: string): ServiceCoverage[] {
  return c.services.filter((s) => s.day === day);
}
export function tasksOn(c: OutcomeCoverage, day: string): TaskCoverage[] {
  return c.tasks.filter((t) => t.day === day);
}
