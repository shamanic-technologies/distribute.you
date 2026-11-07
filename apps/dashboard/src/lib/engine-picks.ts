import { z } from "zod";

/**
 * Today's "Why each one was picked" (FACTORY-USER-DASHBOARD-1102, the GTM Factory Today page): the latest Engine picks
 * across one offer's live campaigns, newest first, each with the plain sentence features-service writes for the
 * client. Read through api-service `GET /v1/offers/:offerId/engine-picks?brandId=` (features-service
 * `/offers/:offerId/engine-picks`, org-scoped). Alias-free so vitest reads it directly; nothing is computed here.
 */
export const EnginePickSchema = z
  .object({
    campaignId: z.string(),
    campaignName: z.string(),
    outcome: z.string(),
    outcomeName: z.string(),
    workflowDynastySlug: z.string(),
    workflowName: z.string().nullable(),
    channelName: z.string().nullable(),
    sharePct: z.number().nullable(),
    state: z.string(),
    why: z.string(),
    pickedAt: z.string().nullable(),
    runningSince: z.string().nullish(),
    retryAt: z.string().nullish(),
    // SCRIPT-MARKS-1103 (features-service): the script dynasty's served mark, null until it has one.
    icon: z.string().nullish(),
    color: z.string().nullish(),
  })
  .passthrough();
export type EnginePick = z.infer<typeof EnginePickSchema>;

export const EnginePicksSchema = z
  .object({ offerId: z.string(), brandId: z.string(), computedAt: z.string().nullable(), picks: z.array(EnginePickSchema) })
  .passthrough();
export type EnginePicks = z.infer<typeof EnginePicksSchema>;

/**
 * Several offers' picks joined into ONE list, newest first (a list, nothing counted or priced): the
 * brand is the scope (owner 2026-11-07, AUDIENCE-PER-OFFER-1107) and features-service serves picks per
 * offer. A pick with no date goes last, in served order.
 */
export function picksNewestFirst<T extends { pickedAt: string | null }>(picks: readonly T[]): T[] {
  return picks
    .map((p, i) => ({ p, i, t: p.pickedAt ? Date.parse(p.pickedAt) : Number.NEGATIVE_INFINITY }))
    .sort((a, b) => (b.t === a.t ? a.i - b.i : b.t - a.t))
    .map((x) => x.p);
}

/** A pick the Engine took back (its guard rolled it back) reads so; a running one reads nothing extra. */
export function pickStateWords(state: string): string | null {
  return state === "rolled_back" ? "Rolled back" : null;
}
