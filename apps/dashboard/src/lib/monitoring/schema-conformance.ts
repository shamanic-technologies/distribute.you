import { z } from "zod";

/**
 * Monitoring > AI vendors > Schema (staff only, SCHEMA-HONOURED-1115), alias-free so vitest reads it directly.
 *
 * On 2026-11-15 GLM-5.3 Flash wrote "cold_email_followup" and "M3" as email bodies: the answer ignored the response
 * schema the calling script sent, 6 reached real prospects, and every call counted as a success. chat-service now checks
 * every schema'd answer against the caller's schema and serves, per model, how many answers followed it, with its
 * verdict (`broken` = more than 5% of at least 20 answers missed it) and a daily series per day x provider x model x
 * route: `GET /internal/schema-conformance?days=N`, read through api-service's staff passthrough. Red on the hub IS the
 * alert (no email). The page draws the served verdicts, sentences and counts as served: no sort, no re-grading.
 */

const int = z.number();

export const SchemaConformanceModelSchema = z.object({
  provider: z.string(),
  model: z.string(),
  answeredCalls: int,
  nonConformingCalls: int,
  conformingShare: z.number(),
  verdict: z.enum(["ok", "broken", "not_enough_answers"]),
  sentence: z.string(),
  lastViolations: z.string().nullable(),
  lastNonConformingAt: z.string().nullable(),
});

export const SchemaConformanceDaySchema = z.object({
  day: z.string(),
  provider: z.string(),
  model: z.string(),
  route: z.string(),
  answeredCalls: int,
  nonConformingCalls: int,
});

export const SchemaConformanceSchema = z.object({
  days: z.number(),
  verdict: z.enum(["ok", "broken"]),
  models: z.array(SchemaConformanceModelSchema),
  series: z.array(SchemaConformanceDaySchema),
});
export type SchemaConformance = z.infer<typeof SchemaConformanceSchema>;
export type SchemaConformanceModel = SchemaConformance["models"][number];
export type SchemaConformanceDay = SchemaConformance["series"][number];

/** The models served `broken`, in served order (chat-service serves broken first). */
export function brokenModels(data: SchemaConformance): SchemaConformanceModel[] {
  return data.models.filter((m) => m.verdict === "broken");
}

/** One model's stored rows (one per UTC day x route), in served order. */
export function modelDays(data: SchemaConformance, m: Pick<SchemaConformanceModel, "provider" | "model">): SchemaConformanceDay[] {
  return data.series.filter((d) => d.provider === m.provider && d.model === m.model);
}

/**
 * The window's UTC days, oldest first, ending today: the chart's time axis. chat-service stores no row for a quiet day,
 * so the axis is the calendar, never the rows (a quiet week would otherwise vanish between two bars).
 */
export function windowDays(days: number, now: Date): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** Words for a served verdict. Display only: the verdict itself is chat-service's. */
export const VERDICT_WORDS: Record<SchemaConformanceModel["verdict"], string> = {
  broken: "Broken",
  ok: "Follows the schema",
  not_enough_answers: "Too few answers yet",
};
