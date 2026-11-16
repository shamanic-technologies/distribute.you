import { z } from "zod";

/**
 * One measure's scripts as the FLEET ranks them right now (features-service `GET /internal/research/engines/live-scripts`,
 * RESEARCH-BY-ENGINE-1113), read on net pricing through the staff Research route. Names no org, brand, offer, campaign or
 * audience. Rows are in the producer's order (`rank`), never re-sorted here; `orderUnavailableReason` says when the order
 * is not one ranking (several sources ranked apart). `computedAt: null` = not built yet (no rows).
 */
const ServedFigureSchema = z.object({
  value: z.number().nullable(),
  basis: z.enum(["measured", "expected"]).nullable(),
  source: z.string().nullish(),
  expectedValue: z.number().nullable(),
  unavailableReason: z.string().nullable(),
});

export const LiveScriptsSchema = z
  .object({
    pricing: z.string(),
    grain: z.literal("fleet"),
    computedAt: z.string().nullable(),
    engine: z.string(),
    measure: z.object({ id: z.string() }).passthrough(),
    orderUnavailableReason: z.string().nullish(),
    rows: z.array(
      z
        .object({
          rank: z.number(),
          scriptDynastySlug: z.string(),
          scriptDynastyName: z.string().nullable(),
          assignment: z.string(),
          executable: z.boolean().nullish(),
          selectable: z.boolean(),
          isMature: z.boolean().nullable(),
          costPerOutcomeUsd: z.number().nullable(),
          conversionRatePct: z.number().nullable(),
          outcomes: z.number(),
          spentUsd: z.number(),
          goesFirst: z.boolean(),
          moneyGoesHere: z.boolean(),
          place: z.string().nullish(),
          explorePriceUsd: z.number().nullish(),
          figures: z
            .object({
              pricing: z.string(),
              half: z.string(),
              costPerOutcomeUsd: ServedFigureSchema,
              conversionRatePct: ServedFigureSchema,
              spentUsd: z.object({ value: z.number().nullable(), basis: z.string().nullable(), unavailableReason: z.string().nullable() }),
              outcomes: z.number(),
              contacted: z.number(),
            })
            .passthrough(),
          lastRunAt: z.string().nullish(),
          lastRunUnavailableReason: z.string().nullish(),
          tactics: z.array(z.object({ id: z.string(), name: z.string() })).nullish(),
          tacticsUnavailableReason: z.string().nullish(),
          icon: z.string().nullish(),
          color: z.string().nullish(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type LiveScripts = z.infer<typeof LiveScriptsSchema>;

export function parseLiveScripts(raw: unknown): LiveScripts {
  const parsed = LiveScriptsSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[dashboard] research live scripts: invalid response shape", parsed.error.issues);
    throw new Error("[dashboard] research live scripts: invalid response shape");
  }
  return parsed.data;
}

/** Why the order is not one ranking, in plain words (features-service `orderUnavailableReason`). */
const ORDER_WORDS: Record<string, string> = {
  several_sources_ranked_apart: "Scripts from several sources are ranked apart, so the order is not one ranking.",
};
export function orderReasonWords(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const w = ORDER_WORDS[reason];
  if (!w) console.error("[dashboard] research live scripts: no words for order reason", reason);
  return w ?? "The order is not one ranking right now.";
}
