import { z } from "zod";

/**
 * Today's "Why each one was picked" (FACTORY-USER-DASHBOARD-1102, the GTM Factory Today page): the latest Engine picks
 * across the selected offer's live campaigns, newest first, each with the plain sentence features-service writes for the
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
  })
  .passthrough();
export type EnginePick = z.infer<typeof EnginePickSchema>;

export const EnginePicksSchema = z
  .object({ offerId: z.string(), brandId: z.string(), computedAt: z.string().nullable(), picks: z.array(EnginePickSchema) })
  .passthrough();
export type EnginePicks = z.infer<typeof EnginePicksSchema>;

/** A pick the Engine took back (its guard rolled it back) reads so; a running one reads nothing extra. */
export function pickStateWords(state: string): string | null {
  return state === "rolled_back" ? "Rolled back" : null;
}
