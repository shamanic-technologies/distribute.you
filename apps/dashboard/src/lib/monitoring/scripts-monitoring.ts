import { z } from "zod";

/**
 * Monitoring > Scripts (staff only, FACTORY-P3). Alias-free so vitest reads it.
 *
 * workflow-service runs "Engines" stored scripts: versioned code in its DB that makes one outcome (the first live one,
 * `message_written/dy_template_writer_full`, writes every cold email of the fleet in place of content-generation-service's
 * own writer). `GET /internal/scripts/monitoring` (workflow-service), relayed byte for byte by api-service as
 * `/v1/scripts/ops/monitoring?days=N`, serves per outcome a stored daily series comparing the SCRIPT path to the SERVICE
 * path it replaced, the proof of each script (recorded cases replayed), and two verdicts: `red` (the script path errs
 * more than the service path on the latest day) and `readyToDelete` (7 stored days with zero service-path runs). The
 * `guard` (rolls the fleet back to the previous workflow versions when the script's last-hour error rate is too high)
 * ships separately, so it is optional. Nothing here computes a figure; helpers only name and filter served values.
 */

const num = z.coerce.number();
const numOrNull = z.union([z.null(), z.coerce.number()]);

export const ScriptPathDaySchema = z
  .object({
    day: z.string(),
    runs: numOrNull,
    totalRuns: num,
    sample: num,
    errorRate: numOrNull,
    avgCostCents: numOrNull,
    tasks: z.array(z.string()),
  })
  .passthrough();
export type ScriptPathDay = z.infer<typeof ScriptPathDaySchema>;

export const ScriptGuardSchema = z
  .object({
    state: z.string(),
    windowMinutes: num,
    lastHour: z.object({ runs: num, failed: num, errorRate: numOrNull }).passthrough(),
    baselineErrorRate: numOrNull,
    thresholdErrorRate: numOrNull,
    minRuns: num,
    rolledBackAt: z.string().nullable(),
    reason: z.string().nullable(),
    switches: z.array(
      z.object({ workflowDynastySlug: z.string(), fromVersion: num, toVersion: num, state: z.string() }).passthrough(),
    ),
  })
  .passthrough();
export type ScriptGuard = z.infer<typeof ScriptGuardSchema>;

export const ScriptOutcomeSchema = z
  .object({
    outcome: z.string(),
    servicePath: z.object({ serviceName: z.string(), taskNames: z.array(z.string()) }).passthrough().nullable(),
    scripts: z.array(
      z
        .object({
          scriptSlug: z.string(),
          proof: z.object({ cases: num, matches: num }).passthrough().nullable(),
        })
        .passthrough(),
    ),
    red: z.boolean(),
    readyToDelete: z.boolean(),
    // Absent until workflow-service deploys the guard.
    guard: ScriptGuardSchema.optional(),
    days: z.array(z.object({ day: z.string(), service: ScriptPathDaySchema.nullable(), script: ScriptPathDaySchema.nullable() }).passthrough()),
  })
  .passthrough();
export type ScriptOutcome = z.infer<typeof ScriptOutcomeSchema>;

export const ScriptsMonitoringSchema = z.object({ since: z.string(), outcomes: z.array(ScriptOutcomeSchema) }).passthrough();
export type ScriptsMonitoring = z.infer<typeof ScriptsMonitoringSchema>;

/** Each outcome in plain words, and what one case of it is (display lookup); an unknown one reads as served. */
const OUTCOME_WORDS: Record<string, { name: string; unit: string }> = {
  message_written: { name: "Cold emails written", unit: "emails" },
};

export function outcomeName(outcome: string): string {
  return OUTCOME_WORDS[outcome]?.name ?? outcome;
}

export function outcomeUnit(outcome: string): string {
  return OUTCOME_WORDS[outcome]?.unit ?? "cases";
}

/** Broken = the served verdict is red, or the guard already rolled the fleet back. */
export function isBroken(o: ScriptOutcome): boolean {
  return o.red || o.guard?.state === "rolled_back";
}

export function brokenOutcomes(d: ScriptsMonitoring): ScriptOutcome[] {
  return d.outcomes.filter(isBroken);
}

/** Problems first, then the rest, each group in the served order. */
export function problemsFirst(d: ScriptsMonitoring): ScriptOutcome[] {
  return [...d.outcomes.filter(isBroken), ...d.outcomes.filter((o) => !isBroken(o))];
}

/** Why an outcome is red, in plain words. */
export function brokenWords(o: ScriptOutcome): string {
  if (o.guard?.state === "rolled_back") return "the script failed too often, so we went back to the old workflows";
  return "the script fails more often than the code it replaced";
}

/** The guard state in plain words. */
export function guardStateWords(state: string): { words: string; tone: "red" | "run" | "muted" } {
  if (state === "rolled_back") return { words: "Rolled back", tone: "red" };
  if (state === "watching") return { words: "Watching", tone: "run" };
  if (state === "off") return { words: "Off", tone: "muted" };
  return { words: state, tone: "muted" };
}

/** A workflow switch's served state in plain words. */
export function switchStateWords(state: string): string {
  if (state === "rolled_back") return "Back on the old version";
  if (state === "switched") return "Runs the script";
  return state;
}

/** "76 of 76 recorded emails replayed the same"; null proof = not proven yet. */
export function proofWords(outcome: string, proof: { cases: number; matches: number } | null): string {
  if (!proof) return "Not proven yet";
  return `${proof.matches.toLocaleString("en-US")} of ${proof.cases.toLocaleString("en-US")} recorded ${outcomeUnit(outcome)} replayed the same`;
}

/** A served rate (a fraction) as a percent number, for the chart and the formatter. Pure unit conversion. */
export function toPct(rate: number | null | undefined): number | null {
  return rate == null ? null : rate * 100;
}

/** Cents per run in dollars, small values kept readable ("$0.0035"). Formatting only. */
export function dollarsPerRun(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  const usd = cents / 100;
  if (usd === 0) return "$0";
  if (Math.abs(usd) >= 1) return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${usd.toLocaleString("en-US", { maximumSignificantDigits: 2 })}`;
}
