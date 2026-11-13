import { z } from "zod";

/**
 * Monitoring > AI vendors > Scripts per Engine (staff only, SCRIPT-VALUE-RATING-1113-MON-DASH), alias-free so vitest
 * reads it directly.
 *
 * Owner 2026-11-13: « un pick = toujours un script »; the LLM and the template are TACTICS of the script. The Engine
 * runner asks features-service's script pick (a Thompson draw on what each script's runs led to), so this page shows,
 * per Engine, the scripts that compete, the one the Rating favours today and what that rests on:
 * `GET /internal/research/script-engines`, read through api-service's staff passthrough
 * `/v1/features/research/script-engines`. Built every 15 min; a 503 `script_engines_not_built_yet` is « being built »
 * (normal colours), red only when the served `health.broken` says the board was not rebuilt for over an hour.
 * The page draws served values in served order: no sort, no division, no re-grading.
 */

const num = z.number();

export const ScriptEngineScriptSchema = z.object({
  scriptDynasty: z.string(),
  runnable: z.boolean(),
  version: num.nullable(),
  shareOfDrawsPct: num.nullable(),
  runs: num,
  reached: z.array(z.object({ outcome: z.string().nullable(), runs: num, creditUsd: num })),
  spentUsd: num.nullable(),
  costPerRunUsd: num.nullable(),
  valuePerRunUsd: num.nullable(),
  valuePerDollar: num.nullable(),
  valuePerDollarUnavailableReason: z.string().nullable(),
  llms: z.array(z.object({ place: z.string().nullable(), provider: z.string().nullable(), model: z.string().nullable() })),
  templates: z.array(z.object({ place: z.string().nullable(), templateDynastySlug: z.string() })),
  runsByDay: z.array(z.object({ day: z.string(), runs: num, spentUsd: num.nullable() })),
});

export const ScriptEngineSchema = z.object({
  outcome: z.string(),
  outcomeValueUsd: num.nullable(),
  outcomeValueSource: z.string().nullable(),
  basis: z.string(),
  favourite: z.string().nullable(),
  runnableScripts: num,
  runs: num,
  scripts: z.array(ScriptEngineScriptSchema),
  drawShareHistory: z.array(z.object({ day: z.string(), shares: z.array(z.object({ scriptDynasty: z.string(), sharePct: num })) })),
});

export const ScriptEnginesSchema = z.object({
  ledgerBuiltAt: z.string(),
  computedAt: z.string(),
  draws: num,
  health: z.object({ broken: z.boolean(), reason: z.string().nullable() }),
  engines: z.array(ScriptEngineSchema),
});

export type ScriptEngineScript = z.infer<typeof ScriptEngineScriptSchema>;
export type ScriptEngine = z.infer<typeof ScriptEngineSchema>;
export type ScriptEngines = z.infer<typeof ScriptEnginesSchema>;

/** The served 503 reason before the board's first build: a normal « being built », never red. */
export const SCRIPT_ENGINES_NOT_BUILT_YET = "script_engines_not_built_yet";

/** What the reader hands the page: the board, or « being built » (the served 503). */
export type ScriptEnginesRead = { state: "ready"; board: ScriptEngines } | { state: "building" };

/** Red = the board was not rebuilt for over an hour (served `health.broken`): the one BROKEN state. */
export function boardBroken(r: ScriptEnginesRead): boolean {
  return r.state === "ready" && r.board.health.broken;
}

/** A script's name on screen: its dynasty, the Engine's own prefix dropped (`email_sent/cold-intro` → `cold-intro`). */
export function scriptName(scriptDynasty: string, outcome: string): string {
  return scriptDynasty.startsWith(`${outcome}/`) ? scriptDynasty.slice(outcome.length + 1) : scriptDynasty;
}

/** Rows shown before « +N more »: Email sent alone has ~67 dynasties. */
export const SCRIPTS_SHOWN = 8;
/** Scripts drawn one by one on the share chart; the rest is one « Other » band. */
export const CHART_SCRIPTS = 4;

/**
 * An Engine's scripts split for display, served order kept: the runnable ones (first `SCRIPTS_SHOWN` shown, the rest
 * folded) then the retired ones (`runnable: false`, folded at the bottom).
 */
export function splitScripts(e: ScriptEngine, shown = SCRIPTS_SHOWN): { top: ScriptEngineScript[]; more: ScriptEngineScript[]; retired: ScriptEngineScript[] } {
  const runnable = e.scripts.filter((s) => s.runnable);
  return { top: runnable.slice(0, shown), more: runnable.slice(shown), retired: e.scripts.filter((s) => !s.runnable) };
}

/** The scripts the chart draws one by one: the first runnable ones in served order (today's largest shares). */
export function chartScripts(e: ScriptEngine, count = CHART_SCRIPTS): string[] {
  return e.scripts.filter((s) => s.runnable).slice(0, count).map((s) => s.scriptDynasty);
}

/**
 * The served daily share series laid out for a stacked bar: per day, the share of each charted script (0 when absent
 * that day) and the served shares of every other script grouped into one « Other » band.
 */
export function shareBars(e: ScriptEngine, charted: readonly string[]): Array<{ day: string; parts: number[]; other: number }> {
  return e.drawShareHistory.map((d) => {
    const byScript = new Map(d.shares.map((s) => [s.scriptDynasty, s.sharePct]));
    return {
      day: d.day,
      parts: charted.map((k) => byScript.get(k) ?? 0),
      other: d.shares.filter((s) => !charted.includes(s.scriptDynasty)).reduce((t, s) => t + s.sharePct, 0),
    };
  });
}

/** How today's draws decided, in words (served `basis`). */
export function basisWords(basis: string): string {
  if (basis === "value_per_dollar") return "Drawn on value per dollar";
  if (basis === "value_only") return "Drawn on value alone (no cost known yet)";
  if (basis === "cost_only") return "Drawn on cost alone (no value known yet)";
  if (basis === "no_candidate") return "No runnable script";
  return basis;
}

/** Why a script has no Rating score, in words (served `valuePerDollarUnavailableReason`). */
export function scoreMissingWords(reason: string | null): string | null {
  if (reason == null) return null;
  if (reason === "no_runs") return "No runs yet";
  if (reason === "no_spend") return "No spend yet";
  if (reason === "spend_not_served") return "Spend not known";
  return reason;
}
