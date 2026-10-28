import { z } from "zod";

/**
 * GTM FACTORY STEP 1, SHADOW ONLY (owner 2026-10-28, FACTORY-P1-DASH). Alias-free so vitest reads it directly.
 *
 * features-service (#2123) stores, every 3 hours, per LIVE sales funnel campaign: the play Jev picks per pipe from the
 * campaign's brief (beside the play running today), and the best-ROI straight line of pipes to the campaign's Target
 * (beside the running funnel priced the same way). Nothing runs from it: it is the owner's check before switching a
 * client campaign to "follow its plan". Read through api-service's relays (#1406):
 *   - `GET /v1/features/brands/:brandId/sales-funnel-campaigns/:id/factory-shadow` (org-scoped; 404
 *     `factory_shadow_not_computed` before the first pass), drawn on the campaign page in staff mode only;
 *   - `GET /v1/features/audit/factory-shadow/monitoring?days=N` (staff only), drawn on Monitoring > Factory plan.
 *
 * Shapes as served (features-service openapi `FactoryShadowPlan`, `/internal/factory-shadow/monitoring`); the page
 * renders served fields only: no cost, ROI or "differs" is computed here.
 */

const num = z.number();

const LineLegSchema = z
  .object({
    legKey: z.string(),
    pipeId: z.string().nullable(),
    channelSlug: z.string().nullable(),
    channelName: z.string().nullable(),
    playId: z.string().nullable(),
    strategyName: z.string().nullable(),
  })
  .passthrough();

const FiguresSchema = z
  .object({
    costPerTargetUsd: num.nullable(),
    roi: num.nullable(),
    basis: z.string().nullable(),
    unavailableReason: z.string().nullable(),
    targetValueUsd: num.nullable(),
  })
  .passthrough();

const PlanLineSchema = z
  .object({
    funnelId: z.string(),
    line: z.string(),
    legs: z.array(LineLegSchema),
    figures: FiguresSchema,
  })
  .passthrough();

/** The running funnel: priced like the shadow line, or the reason it cannot be (it does not reach the Target). */
const RunningLineSchema = z.union([
  PlanLineSchema.extend({ reachesTarget: z.literal(true).optional() }),
  z.object({ funnelId: z.string(), reachesTarget: z.literal(false), unavailableReason: z.string() }).passthrough(),
]);

export const FactoryShadowPickSchema = z
  .object({
    basePipeId: z.string(),
    channelName: z.string(),
    inRunningFunnel: z.boolean(),
    runningPipeId: z.string().nullable(),
    runningPlayName: z.string().nullable(),
    pickedPipeId: z.string().nullable(),
    pickedPlayName: z.string().nullable(),
    confidence: num.nullable(),
    source: z.string().nullable(),
    failure: z.string().nullable(),
    differs: z.boolean().nullable(),
  })
  .passthrough();

export const FactoryShadowPlanSchema = z
  .object({
    campaignId: z.string(),
    orgId: z.string(),
    brandId: z.string(),
    salesFunnelName: z.string(),
    brief: z.string().nullable(),
    briefUpdatedAt: z.string().nullable(),
    status: z.string(),
    failure: z.string().nullable(),
    picks: z.array(FactoryShadowPickSchema),
    pickDiffers: z.boolean(),
    plan: z
      .object({
        target: z.string(),
        targetSource: z.string(),
        mode: z.string(),
        triggerId: z.string().nullable(),
        startStep: z.string().nullable(),
        running: RunningLineSchema.nullable(),
        shadow: PlanLineSchema.nullable(),
        shadowUnavailableReason: z.string().nullable(),
        rankedOn: z.string().optional(),
        planDiffers: z.boolean().nullable(),
      })
      .passthrough()
      .nullable(),
    computedAt: z.string(),
  })
  .passthrough();
export type FactoryShadowPlan = z.infer<typeof FactoryShadowPlanSchema>;
export type FactoryShadowPick = z.infer<typeof FactoryShadowPickSchema>;
export type FactoryPlanLine = z.infer<typeof PlanLineSchema>;
export type FactoryRunningLine = z.infer<typeof RunningLineSchema>;

/** The running line when it is priced (it reaches the Target), else null. */
export function pricedRunning(running: FactoryRunningLine | null): FactoryPlanLine | null {
  if (!running || !("legs" in running)) return null;
  return running as FactoryPlanLine;
}

/** Why the running funnel has no figures, when it does not reach the Target. */
export function runningUnavailable(running: FactoryRunningLine | null): string | null {
  if (!running) return null;
  return "reachesTarget" in running && running.reachesTarget === false ? (running as { unavailableReason: string }).unavailableReason : null;
}

// ─── Monitoring (staff, fleet-wide) ────────────────────────────────────────

const OrgDaySchema = z
  .object({
    orgId: z.string(),
    campaigns: num,
    planDiffers: num,
    pickDiffers: num,
    differs: num,
    judgeFailed: num,
    planFailed: num,
  })
  .passthrough();

export const FactoryShadowMonitoringSchema = z
  .object({
    verdict: z.object({ red: z.boolean(), reasons: z.array(z.string()) }).passthrough(),
    lastPass: z
      .object({ sweptAt: z.string(), campaigns: num, judgeFailed: num, planFailed: num, durationMs: num })
      .passthrough()
      .nullable(),
    everyHours: num,
    series: z.array(
      z
        .object({
          day: z.string(),
          campaigns: num,
          planDiffers: num,
          pickDiffers: num,
          differs: num,
          judgeFailed: num,
          planFailed: num,
          orgs: z.array(OrgDaySchema),
        })
        .passthrough(),
    ),
    campaigns: z.array(
      z
        .object({
          campaignId: z.string(),
          orgId: z.string(),
          brandId: z.string(),
          salesFunnelName: z.string(),
          status: z.string(),
          failure: z.string().nullable(),
          planDiffers: z.boolean().nullable(),
          pickDiffers: z.boolean(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export type FactoryShadowMonitoring = z.infer<typeof FactoryShadowMonitoringSchema>;
export type FactoryShadowMonitoringCampaign = FactoryShadowMonitoring["campaigns"][number];

// ─── Words (display lookups only) ──────────────────────────────────────────

const VERDICT_WORDS: Record<string, string> = {
  never_computed: "no pass has ever run",
  last_pass_stale: "the last pass is too old",
  judge_failed: "Jev could not answer for a campaign",
  plan_failed: "no line to the Target could be priced for a campaign",
};

/** A served verdict reason in plain words; an unknown one reads as served. */
export function verdictReasonWords(code: string): string {
  return VERDICT_WORDS[code] ?? code;
}

const REASON_WORDS: Record<string, string> = {
  target_unvalued: "the Target has no value",
  customer_time_only: "only the client's own team works this line",
  running_funnel_does_not_reach_target: "the running funnel does not reach the Target",
  no_runnable_line_to_target: "no line we run reaches the Target",
  no_priced_line_to_target: "no line to the Target has a price yet",
  offer_not_found: "the offer could not be read",
};

/**
 * Why a figure or a line is missing, in plain words. A served `<code>:<subject>` (`pipe_unpriced:<pipe>`,
 * `leg_unrated:<leg>`) names its subject as served; an unknown code reads as served.
 */
export function unavailableWords(reason: string | null): string | null {
  if (!reason) return null;
  if (REASON_WORDS[reason]) return REASON_WORDS[reason];
  const at = reason.indexOf(":");
  const code = at > 0 ? reason.slice(0, at) : reason;
  const subject = at > 0 ? reason.slice(at + 1) : "";
  if (code === "pipe_unpriced") return `a pipe has no price yet${subject ? ` (${subject})` : ""}`;
  if (code === "leg_unrated") return `a step has no rate yet${subject ? ` (${subject})` : ""}`;
  return reason;
}

/**
 * Below this, Jev's confidence in its pick reads rose (owner 2026-10-28 brief: "low confidence in rose"). A display
 * tone only: nothing is decided on it, the pick is served as is.
 */
export const LOW_CONFIDENCE = 0.5;

export function isLowConfidence(confidence: number | null): boolean {
  return confidence != null && confidence < LOW_CONFIDENCE;
}

/** Jev's confidence as a whole percent ("82%"), or null when no Jev call was made. */
export function confidenceWords(confidence: number | null): string | null {
  if (confidence == null) return null;
  return `${Math.round(confidence * 100)}%`;
}

const PICK_SOURCE_WORDS: Record<string, string> = {
  empty_brief: "default, no brief",
  single_play: "only one play",
};

/** Why a pick carries no confidence (no Jev call was made), in words; null when Jev answered. */
export function pickSourceWords(source: string | null): string | null {
  if (!source || source === "jev") return null;
  return PICK_SOURCE_WORDS[source] ?? source;
}

/** The campaigns of the last pass the hub turns red on: the served status, never re-graded. */
export function failedCampaigns(data: FactoryShadowMonitoring): FactoryShadowMonitoringCampaign[] {
  return data.campaigns.filter((c) => c.status !== "ok");
}

/** The campaigns of the last pass whose plan or a pick differs from what runs (served flags). */
export function changingCampaigns(data: FactoryShadowMonitoring): FactoryShadowMonitoringCampaign[] {
  return data.campaigns.filter((c) => c.planDiffers === true || c.pickDiffers);
}
