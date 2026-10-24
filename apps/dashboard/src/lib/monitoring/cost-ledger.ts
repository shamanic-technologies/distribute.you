import { z } from "zod";

/**
 * Monitoring > Cost ledger (staff only, COST-ACCOUNTING-1023-MONITOR), alias-free so vitest reads it.
 *
 * runs-service is the general ledger (v0.47.60): every spending service declares, on its runs, the
 * outcomes it produced. Two stored reads watch it, through api-service's staff passthroughs:
 * - outcome coverage: per UTC day, the spend and the part of it whose run declared its outcome, fleet,
 *   per service, per task. The share read is the served `outcomeSpendCoveragePct` (v0.47.71, owner
 *   2026-10-24): declared / (spend - support). Support = spend that produces no outcome by design
 *   (payment fees, brand setup, Copilot, ...), served apart per function; `coveragePct` (support
 *   counted as undeclared) is never shown;
 * - the to-the-cent check: per (UTC day, org), standard cost − reuse gain + spend that produced none
 *   = the ledger, on gross, net and vendor, with the served `balanced` verdict and the failing org-days.
 * This module only reshapes what is served (one point per day for the chart) and states the target.
 * It sums, divides and re-grades nothing. Red on the hub IS the alert (no email, owner 2026-10-22).
 */

/** The share of spend whose run declared its outcome we expect (owner 2026-10-23: exact to the cent). */
export const COVERAGE_TARGET_PCT = 95;

const Cents = z.string();

/** The support functions in the producer's enum order (runs-service `RunSupportOnCreate.kind`), with their words. */
export const SUPPORT_FUNCTIONS: { key: string; label: string }[] = [
  { key: "payment_fees", label: "Payment fees" },
  { key: "brand_setup", label: "Brand setup" },
  { key: "copilot", label: "Copilot" },
  { key: "platform_llm", label: "Platform AI calls" },
  { key: "staff_experiment", label: "Staff tests" },
  { key: "product_feature", label: "Product features" },
  { key: "retired_product", label: "Retired products" },
];

const SupportMoneySchema = z.object({ grossCents: Cents, netCents: Cents });

const CoveragePointShape = {
  day: z.string(),
  complete: z.boolean(),
  spendGrossCents: Cents,
  coveredGrossCents: Cents,
  spendNetCents: Cents,
  coveredNetCents: Cents,
  coveragePct: z.string().nullable(),
  // runs-service v0.47.71 (support split). Optional so a payload stored before it still parses.
  supportGrossCents: Cents.optional(),
  supportNetCents: Cents.optional(),
  /** Only the functions that spent are keyed; `{}` on a day with no support. */
  supportByFunction: z.record(z.string(), SupportMoneySchema).optional(),
  /** declared / (spend - support) x 100. Null when no outcome spend. */
  outcomeSpendCoveragePct: z.string().nullish(),
};

export const CoveragePointSchema = z.object(CoveragePointShape);
export type CoveragePoint = z.infer<typeof CoveragePointSchema>;

export const OutcomeCoverageSchema = z.object({
  allocationVersion: z.number(),
  since: z.string(),
  until: z.string(),
  daysMissing: z.array(z.string()),
  supportComplete: z.boolean().optional(),
  /** Days stored before the support split: support reads 0 there (so the share counts it) until recomputed. */
  supportDaysMissing: z.array(z.string()).optional(),
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

/** The served share on outcome spend only; null when the day had none (or the payload predates the split). */
export function outcomeShare(p: CoveragePoint): string | null {
  return p.outcomeSpendCoveragePct ?? null;
}

/** The day the hub reads: the latest finished day with outcome spend, else the latest such day (today runs on). */
export function headlinePoint(c: OutcomeCoverage): CoveragePoint | null {
  const spent = c.fleet.filter((p) => outcomeShare(p) != null);
  return [...spent].reverse().find((p) => p.complete) ?? spent[spent.length - 1] ?? null;
}

/** Red when the served share on outcome spend sits under the target. No outcome spend = no share, so no verdict. */
export function belowTarget(p: CoveragePoint | null): boolean {
  if (p == null) return false;
  const v = outcomeShare(p);
  return v != null && Number(v) < COVERAGE_TARGET_PCT;
}

/** The days whose share still counts support as undeclared spend (stored before the split). */
export function supportNotSplit(c: OutcomeCoverage, day: string): boolean {
  return (c.supportDaysMissing ?? []).includes(day);
}

/** A function's served gross support that day, in cents (0 when the function did not spend). */
export function supportCents(p: CoveragePoint, fn: string): number {
  return Number(p.supportByFunction?.[fn]?.grossCents ?? 0);
}

/** The functions with support spend on some fleet day, in the producer's enum order, then any key it adds. */
export function supportFunctions(c: OutcomeCoverage): { key: string; label: string }[] {
  const seen = new Set(c.fleet.flatMap((p) => Object.keys(p.supportByFunction ?? {}).filter((k) => supportCents(p, k) !== 0)));
  const known = SUPPORT_FUNCTIONS.filter((f) => seen.has(f.key));
  const extra = [...seen].filter((k) => !SUPPORT_FUNCTIONS.some((f) => f.key === k)).map((k) => ({ key: k, label: k }));
  return [...known, ...extra];
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
  /** The fleet's served spend, covered spend and support spend that day, for the hover line. */
  spendGrossCents: string;
  coveredGrossCents: string;
  supportGrossCents: string | null;
  /** Stored before the support split: the share there still counts support as undeclared. */
  supportNotSplit: boolean;
  services: Record<string, number | null>;
}

export function coverageChart(c: OutcomeCoverage): CoverageChartPoint[] {
  const byDay = new Map<string, Record<string, number | null>>();
  for (const s of c.services) {
    const at = byDay.get(s.day) ?? {};
    const v = outcomeShare(s);
    at[s.serviceName] = v == null ? null : Number(v);
    byDay.set(s.day, at);
  }
  return c.fleet.map((p) => ({
    day: p.day,
    fleet: outcomeShare(p) == null ? null : Number(outcomeShare(p)),
    spendGrossCents: p.spendGrossCents,
    coveredGrossCents: p.coveredGrossCents,
    supportGrossCents: p.supportGrossCents ?? null,
    supportNotSplit: supportNotSplit(c, p.day),
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
