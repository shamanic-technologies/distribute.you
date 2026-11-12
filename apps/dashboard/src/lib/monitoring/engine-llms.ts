import { z } from "zod";

/**
 * Monitoring > AI vendors > LLMs (staff only, LLM-RATING-PER-ENGINE-1112), alias-free so vitest reads it directly.
 *
 * Owner 2026-11-12: « une page dans monitoring qui liste tous les Engines avec les LLM autorisés dedans et leur stats
 * d'utilisation ». features-service's Rating rates LLMs per Engine like any candidate (framework v10 §8) and serves, per
 * Engine, its universe of allowed LLMs, every LLM ranked with its usage (whole history, workflow era included) and the
 * LLMs it used outside its universe: `GET /internal/research/engine-llms`, read through api-service's staff passthrough
 * `/v1/features/research/engine-llms`. The page draws served values in served order: no sort, no sum, no re-grading.
 */

const num = z.number();

export const EngineLlmDaySchema = z.object({ day: z.string(), calls: num, spentUsd: num });

export const EngineLlmSchema = z.object({
  llmDynastySlug: z.string(),
  name: z.string(),
  provider: z.string().nullable(),
  allowed: z.boolean(),
  notPickableReason: z.string().nullable(),
  rank: num.nullable(),
  shareOfDraws: num.nullable(),
  shareOfPicks: num.nullable(),
  picks: num,
  calls: num,
  decisions: num,
  outcomes: num,
  spentUsdToDate: num,
  spentUsdPerDay: num,
  dailySpend: z.array(EngineLlmDaySchema),
  costPerOutcomeUsd: num.nullable(),
  costPerOutcomeUnavailableReason: z.string().nullable(),
  outcomeRate: num.nullable(),
  firstCallDay: z.string().nullable(),
  lastCallDay: z.string().nullable(),
});

export const EngineLlmsEngineSchema = z.object({
  outcome: z.string(),
  name: z.string(),
  universe: z.object({
    source: z.string(),
    allowed: z.array(z.string()),
    excluded: z.array(z.string()),
    decidedBy: z.string().nullable(),
    decidedAt: z.string().nullable(),
    note: z.string().nullable(),
  }),
  favourite: z.object({ llmDynastySlug: z.string(), name: z.string() }).nullable(),
  places: z.array(z.object({ place: z.string(), picks: num })),
  llms: z.array(EngineLlmSchema),
  outsideUniverse: z.array(EngineLlmSchema),
  totals: z.object({ calls: num, decisions: num, outcomes: num, spentUsdToDate: num }),
});

export const EngineLlmsSchema = z.object({
  computedAt: z.string(),
  evidenceComputedAt: z.string().nullable(),
  evidenceUnavailableReason: z.string().nullable(),
  evidenceCounts: z
    .object({
      calls: num,
      callsWithNoEngine: num,
      supportCalls: num,
      decisionsAwaitingUnits: num,
      lastCallAt: z.string().nullable(),
    })
    .nullable(),
  engines: z.array(EngineLlmsEngineSchema),
  limits: z.array(z.unknown()),
});

export type EngineLlm = z.infer<typeof EngineLlmSchema>;
export type EngineLlmsEngine = z.infer<typeof EngineLlmsEngineSchema>;
export type EngineLlms = z.infer<typeof EngineLlmsSchema>;

/** The served reason before the Rating's FIRST evidence build (a normal « not yet », never red). */
export const EVIDENCE_NOT_BUILT_YET = "evidence_not_built_yet";

/** True before the first build of the evidence: the page says so in normal colours. */
export function evidenceNotBuiltYet(d: EngineLlms): boolean {
  return d.evidenceUnavailableReason === EVIDENCE_NOT_BUILT_YET;
}

/** Red = the Rating could not read its evidence for another reason than its first build: the one BROKEN state. */
export function evidenceBroken(d: EngineLlms): boolean {
  return d.evidenceUnavailableReason != null && !evidenceNotBuiltYet(d);
}

/**
 * The LLMs an Engine still CALLS outside its universe in the last 30 days (a script that forces a model, owner
 * 2026-11-12 « pas normal qu'on ait des scripts qui tournent sur du Fable ou du Opus »). A served daily series with a
 * call on it, nothing summed.
 */
export function forcedOutside(e: EngineLlmsEngine): EngineLlm[] {
  return e.outsideUniverse.filter((l) => l.dailySpend.some((d) => d.calls > 0));
}

/** Every Engine with at least one LLM called outside its universe in the last 30 days, in served order. */
export function enginesForcingOutside(d: EngineLlms): EngineLlmsEngine[] {
  return d.engines.filter((e) => forcedOutside(e).length > 0);
}

/** The dynasty names an Engine may use, in the served order of its universe (slug when the Engine never called it). */
export function allowedNames(e: EngineLlmsEngine): string[] {
  const names = new Map([...e.llms, ...e.outsideUniverse].map((l) => [l.llmDynastySlug, l.name]));
  return e.universe.allowed.map((slug) => names.get(slug) ?? slug);
}

/** Who decided the universe, in words: the fleet list every Engine reads, or this Engine's own. */
export function universeSourceWords(source: string): string {
  if (source === "engine") return "Its own list";
  if (source === "fleet") return "Fleet list";
  return "No list";
}
