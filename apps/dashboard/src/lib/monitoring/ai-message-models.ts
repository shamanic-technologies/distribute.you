import { z } from "zod";

/**
 * Monitoring > AI vendors > Model named (staff only, MODEL-TAG-EVERY-AI-MESSAGE-1126), alias-free so vitest reads it.
 *
 * Owner 2026-11-26: every message our AI wrote wears the model that wrote it in the Unibox (logo + name). features-service
 * names that model off what actually ran (the LLM billed in the writing run) and stores, per UTC day, how many messages
 * our runs sent with vs without a model named, fleet + per org: `GET /internal/stats/ai-message-models?days=N`, through
 * api-service's staff route. Red on the hub IS the alert (no email), only on the served `health.broken` (a recent send
 * with no model, or the series stopped). The page draws served counts as served: no ratio, no re-grading.
 */

const int = z.number();

export const AiMessageModelTallySchema = z.object({
  sentNotWrittenByOurRuns: int,
  messages: int,
  withModel: int,
  withoutModel: int,
  // reason -> count, a plain string key: the producer widens its reasons.
  withoutByReason: z.record(z.string(), int),
  // chat-service model id -> messages it wrote.
  byModel: z.record(z.string(), int),
});

export const AiMessageModelsDaySchema = z.object({
  day: z.string(),
  computedAt: z.string(),
  fleet: AiMessageModelTallySchema,
  orgs: z.array(AiMessageModelTallySchema.extend({ orgId: z.string() })),
});

export const AiMessageModelsSchema = z.object({
  rule: z.string(),
  ruleText: z.string(),
  days: z.array(AiMessageModelsDaySchema),
  modelNames: z.record(z.string(), z.object({ name: z.string(), vendor: z.object({ id: z.string(), name: z.string() }) }).nullable()),
  health: z.object({
    broken: z.boolean(),
    unnamedOnRecentSends: int,
    lastComputedAt: z.string().nullable(),
    reason: z.string().nullable(),
  }),
});
export type AiMessageModels = z.infer<typeof AiMessageModelsSchema>;
export type AiMessageModelsDay = AiMessageModels["days"][number];

/** The stored day of one UTC date, or null (features-service stores no row for a day with no send). */
export function dayOf(data: AiMessageModels, day: string): AiMessageModelsDay | null {
  return data.days.find((d) => d.day.slice(0, 10) === day) ?? null;
}

/** A model id in words: chat-service's served name, else the bare id (never a guessed name). */
export function modelWords(data: AiMessageModels, id: string): string {
  return data.modelNames[id]?.name ?? id;
}

/** Why a message has no model, in plain words. Display only; an unknown reason prints as served. */
export const REASON_WORDS: Record<string, string> = {
  ledger_unreadable: "Ledger unreadable",
  no_send_in_ledger: "Send not in the ledger",
  send_ambiguous_in_ledger: "Send matches several ledger rows",
  no_writing_in_ledger: "No writing in the ledger",
  several_writings_in_ledger: "Several writings for one send",
  writing_run_unreadable: "Writing run unreadable",
  no_llm_billed: "No AI model billed in the writing run",
  llm_cost_names_unreadable: "AI price list unreadable",
  model_names_unreadable: "Model names unreadable",
  model_not_served: "Model not in the catalogue",
};
export const reasonWords = (r: string) => REASON_WORDS[r] ?? r.replace(/_/g, " ");

/** The served health in one sentence. */
export function healthSentence(data: AiMessageModels): string {
  if (data.health.reason === "series_not_rebuilt") return "The count stopped: not rebuilt for over 3 hours.";
  const n = data.health.unnamedOnRecentSends;
  if (n > 0) return `${n.toLocaleString("en-US")} AI ${n === 1 ? "message" : "messages"} sent today or yesterday with no model named.`;
  return "Every AI message sent today and yesterday names the model that wrote it.";
}
