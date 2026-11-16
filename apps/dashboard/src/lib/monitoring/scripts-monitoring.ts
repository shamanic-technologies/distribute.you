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

/**
 * Campaign Engines (MIGRATE-1105 S2b): per outcome a campaign's leg reaches, its runs by stored script (no workflow) vs by
 * workflow, per UTC day and per client, read from workflow-service's own run rows; spend = each client's runs x its
 * sampled cost per run (runs-service). `red` = the script fails more than the workflow did; `onWorkflow` = some campaign
 * still ran it on a workflow today (a normal "not yet", never red).
 */
const EnginePathSchema = z
  .object({
    runs: num,
    completed: num,
    failed: num,
    errorRate: numOrNull,
    spendCents: numOrNull,
    costPerRunCents: numOrNull,
    sampledRuns: num,
  })
  .passthrough()
  .nullable();
export type EnginePath = z.infer<typeof EnginePathSchema>;

export const EngineOutcomeSchema = z
  .object({
    outcome: z.string(),
    red: z.boolean(),
    verdict: z.object({ scriptErrorRate: numOrNull, scriptFinishedRuns: num, workflowErrorRate: numOrNull, thresholdErrorRate: num }).passthrough(),
    onWorkflow: z.boolean(),
    lastWorkflowDay: z.string().nullable(),
    window: z.object({ script: EnginePathSchema, workflow: EnginePathSchema }).passthrough(),
    days: z.array(z.object({ day: z.string(), script: EnginePathSchema, workflow: EnginePathSchema }).passthrough()),
    orgs: z.array(z.object({ orgId: z.string(), script: EnginePathSchema, workflow: EnginePathSchema, lastWorkflowDay: z.string().nullable() }).passthrough()),
  })
  .passthrough();
export type EngineOutcome = z.infer<typeof EngineOutcomeSchema>;

export const EngineMonitoringSchema = z.object({ since: z.string(), minRunsForRed: num, outcomes: z.array(EngineOutcomeSchema) }).passthrough();
export type EngineMonitoring = z.infer<typeof EngineMonitoringSchema>;

/**
 * Writer proofs (PROVEN-BEFORE-PEOPLE-1116): a "writer combination" = one stored script version that writes to a person,
 * with the LLM its tactics state. Before it may write to real people, its LLM answers up to 5 recorded production cases
 * live (nothing sent) and Jev judges every field a person would read. `red` (served) = a LIVE combination whose latest
 * proof failed, the only broken state; unproven / no cases / being proven / interrupted are a normal "not yet".
 */
export const WriterProofCombinationSchema = z
  .object({
    outcome: z.string(),
    dynasty: z.string(),
    version: num,
    llm: z.string().nullable(),
    live: z.boolean(),
    state: z.string(),
    usable: num,
    sample: num,
    spendAtMostUsd: numOrNull,
    provedAt: z.string().nullable(),
    failures: z.array(z.string()),
    red: z.boolean(),
  })
  .passthrough();
export type WriterProofCombination = z.infer<typeof WriterProofCombinationSchema>;

export const WriterProofsSchema = z
  .object({
    engines: z.array(z.object({ outcome: z.string(), enforced: z.boolean(), cases: num }).passthrough()),
    combinations: z.array(WriterProofCombinationSchema),
  })
  .passthrough();
export type WriterProofs = z.infer<typeof WriterProofsSchema>;

export const ScriptsMonitoringSchema = z
  .object({
    since: z.string(),
    outcomes: z.array(ScriptOutcomeSchema),
    // Absent until workflow-service serves campaign Engines.
    engines: EngineMonitoringSchema.optional(),
    // Absent until workflow-service serves writer proofs (PROVEN-BEFORE-PEOPLE-1116).
    writerProofs: WriterProofsSchema.optional(),
  })
  .passthrough();
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

/** Campaign Engines whose script fails more than the workflow did (the only red). */
export function brokenEngines(e: EngineMonitoring | undefined): EngineOutcome[] {
  return (e?.outcomes ?? []).filter((o) => o.red);
}

/** Outcomes some campaign still ran on a workflow today (a normal "not yet"). */
export function enginesOnWorkflow(e: EngineMonitoring | undefined): EngineOutcome[] {
  return (e?.outcomes ?? []).filter((o) => o.onWorkflow);
}

/** Red first, then still on a workflow (most workflow runs first), then script only (most script runs first). */
export function enginesInOrder(e: EngineMonitoring): EngineOutcome[] {
  const rank = (o: EngineOutcome) => (o.red ? 0 : o.onWorkflow ? 1 : 2);
  return [...e.outcomes].sort(
    (a, b) => rank(a) - rank(b) || (b.window.workflow?.runs ?? 0) - (a.window.workflow?.runs ?? 0) || (b.window.script?.runs ?? 0) - (a.window.script?.runs ?? 0),
  );
}

/** The chart's buckets for one combination's served state: only a live failed one is red. */
export type ProofBucket = "proven" | "failing" | "failedOff" | "running" | "notYet";

export const PROOF_BUCKETS: readonly ProofBucket[] = ["failing", "failedOff", "running", "notYet", "proven"];

export function proofBucket(c: WriterProofCombination): ProofBucket {
  if (c.red) return "failing";
  if (c.state === "passed") return "proven";
  if (c.state === "failed") return "failedOff";
  if (c.state === "running") return "running";
  return "notYet";
}

/** Each bucket in plain words. */
export const PROOF_BUCKET_WORDS: Record<ProofBucket, string> = {
  proven: "Proven",
  failing: "Failing, live",
  failedOff: "Failed, not drawn",
  running: "Being proven",
  notYet: "Not proven yet",
};

/** A combination's served state in plain words (its row in the list). */
export function proofStateWords(state: string): string {
  if (state === "passed") return "Proven";
  if (state === "failed") return "Failed";
  if (state === "running") return "Being proven";
  if (state === "no_cases") return "Not provable yet: too few recorded cases";
  if (state === "error" || state === "abandoned") return "Interrupted, retried";
  if (state === "unproven") return "Not proven yet";
  return state;
}

/** Live combinations that failed their proof (the served `red`): the only red. */
export function redWriters(wp: WriterProofs | undefined): WriterProofCombination[] {
  return (wp?.combinations ?? []).filter((c) => c.red);
}

/** Per Engine, its combinations tallied by bucket, in the served Engine order then any Engine only a combination names. */
export function proofsByEngine(wp: WriterProofs): Array<{ outcome: string; enforced: boolean; cases: number | null; counts: Record<ProofBucket, number>; total: number }> {
  const outcomes = [...wp.engines.map((e) => e.outcome)];
  for (const c of wp.combinations) if (!outcomes.includes(c.outcome)) outcomes.push(c.outcome);
  return outcomes
    .map((outcome) => {
      const e = wp.engines.find((x) => x.outcome === outcome);
      const counts: Record<ProofBucket, number> = { proven: 0, failing: 0, failedOff: 0, running: 0, notYet: 0 };
      const mine = wp.combinations.filter((c) => c.outcome === outcome);
      for (const c of mine) counts[proofBucket(c)] += 1;
      return { outcome, enforced: e?.enforced ?? false, cases: e ? e.cases : null, counts, total: mine.length };
    })
    .sort((a, b) => b.counts.failing - a.counts.failing || b.total - a.total);
}

/** Failed combinations to name under the chart: live ones (red) first, served order kept inside each group. */
export function failedWriters(wp: WriterProofs): WriterProofCombination[] {
  const failed = wp.combinations.filter((c) => c.state === "failed");
  return [...failed.filter((c) => c.red), ...failed.filter((c) => !c.red)];
}
