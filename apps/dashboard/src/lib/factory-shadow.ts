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

/** One side of "what would change" (features-service v0.179.452+): only the legs that differ, and the WHOLE line's figures. */
const ChangeSideSchema = z
  .object({
    pipes: z.array(z.object({ legKey: z.string(), pipeId: z.string().nullable(), name: z.string() }).passthrough()),
    text: z.string(),
    costPerTargetUsd: num.nullable(),
    roi: num.nullable(),
    basis: z.string().nullable(),
    inputsBasis: z.string().nullish(),
    unavailableReason: z.string().nullable(),
  })
  .passthrough();
export type FactoryChangeSide = z.infer<typeof ChangeSideSchema>;

/**
 * One campaign of the last pass. Since features-service v0.179.452 it carries its STATE: `problem` (red, something
 * broken), `not_yet` (normal colours: waiting on a first price or a catalogue line), `ok`; the served one-sentence
 * `stateDetail`; and `change` when the plan differs. Nullish: a body from an older build carries none of them.
 */
// ─── Engine per outcome, SHADOW (features-service ENGINE-PER-OUTCOME-SHADOW, owner 2026-10-31) ─────────────
// Per candidate place (each leg of the line a campaign runs: the outcome it calls), today's pick (the running pipe and its
// best-ROI workflow) beside the Engine's (Thompson sampling on value per dollar over every workflow of every pipe making
// that outcome). Served on Monitoring as `engine`; every figure below is served, none computed here.

const EnginePickRefSchema = z
  .object({ candidateId: z.string(), pipeId: z.string(), channelName: z.string(), workflowDynastySlug: z.string(), workflowDynastyName: z.string().nullable() })
  .passthrough();

const EnginePlaceSummarySchema = z
  .object({
    outcome: z.string(),
    outcomeName: z.string(),
    consumer: z.string(),
    consumerName: z.string(),
    today: EnginePickRefSchema.nullable(),
    todayUnavailableReason: z.string().nullable(),
    engine: EnginePickRefSchema.nullable(),
    engineModal: EnginePickRefSchema.nullable(),
    agrees: z.boolean().nullable(),
    todayPickSharePct: num.nullable(),
    state: z.string(),
    candidates: num,
  })
  .passthrough();

const CampaignEngineSchema = z
  .object({
    status: z.string(),
    failure: z.string().nullable(),
    comparable: num,
    agreed: num,
    expectedAgreementPct: num.nullable(),
    places: z.array(EnginePlaceSummarySchema),
  })
  .passthrough();

const EngineReplayFamilySchema = z
  .object({
    outcome: z.string(),
    outcomeName: z.string(),
    candidates: num,
    graded: num,
    windowDecisions: num,
    bestValuePerDollar: num.nullable(),
    todayRegret: num.nullable(),
    todayValuePerDollar: num.nullable(),
    todayUngradedPct: num.nullable(),
    engineRegret: num.nullable(),
    engineValuePerDollar: num.nullable(),
    engineUngradedPct: num.nullable(),
    regretGain: num.nullable(),
    reason: z.string().nullable(),
  })
  .passthrough();

export const EngineMonitoringSchema = z
  .object({
    verdict: z.object({ red: z.boolean(), reasons: z.array(z.string()) }).passthrough(),
    last: z.object({ day: z.string(), places: num, agreed: num, agreementPct: num.nullable(), expectedAgreementPct: num.nullable(), failed: num }).passthrough().nullable(),
    series: z.array(z.object({ day: z.string(), places: num, agreed: num, disagreed: num.optional(), agreementPct: num.nullable(), expectedAgreementPct: num.nullable(), failed: num }).passthrough()),
    problems: z.array(z.object({ campaignId: z.string(), orgId: z.string(), brandId: z.string(), salesFunnelName: z.string(), failure: z.string().nullable() }).passthrough()),
    replay: z
      .object({
        computedAt: z.string(),
        windowDays: num,
        families: z.array(EngineReplayFamilySchema),
        totals: z.object({ todayRegret: num.nullable(), engineRegret: num.nullable(), regretGain: num.nullable(), families: num }).passthrough(),
        failure: z.string().nullable(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();
export type EngineMonitoring = z.infer<typeof EngineMonitoringSchema>;
export type EngineReplayFamily = NonNullable<EngineMonitoring["replay"]>["families"][number];
export type CampaignEngine = z.infer<typeof CampaignEngineSchema>;
export type EnginePlaceSummary = CampaignEngine["places"][number];

const MonitoringCampaignSchema = z
  .object({
    campaignId: z.string(),
    orgId: z.string(),
    brandId: z.string(),
    salesFunnelName: z.string(),
    status: z.string(),
    failure: z.string().nullable(),
    planDiffers: z.boolean().nullable(),
    pickDiffers: z.boolean(),
    followsPlan: z.boolean().nullish(),
    state: z.string().nullish(),
    stateReason: z.string().nullish(),
    stateDetail: z.string().nullish(),
    target: z.string().nullish(),
    change: z.object({ running: ChangeSideSchema, best: ChangeSideSchema }).passthrough().nullish(),
    engine: CampaignEngineSchema.nullish(),
  })
  .passthrough();

const OrgDaySchema = z
  .object({
    orgId: z.string(),
    campaigns: num,
    planDiffers: num,
    pickDiffers: num,
    differs: num,
    judgeFailed: num,
    planFailed: num,
    notYet: num.optional(),
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
          notYet: num.optional(),
          orgs: z.array(OrgDaySchema),
        })
        .passthrough(),
    ),
    campaigns: z.array(MonitoringCampaignSchema),
    // The last pass's campaigns in `state: problem` (red) and `state: not_yet` (normal colours), as served.
    problems: z.array(MonitoringCampaignSchema).optional(),
    notYet: z.array(MonitoringCampaignSchema).optional(),
    // Absent until features-service serves the Engine shadow (additive rollout).
    engine: EngineMonitoringSchema.optional(),
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

/** The last pass's campaigns with a real problem (red): the served `problems[]`, never re-graded. */
export function problemCampaigns(data: FactoryShadowMonitoring): FactoryShadowMonitoringCampaign[] {
  return data.problems ?? [];
}

/** The last pass's campaigns waiting on a first price or a catalogue line (normal colours): the served `notYet[]`. */
export function notYetCampaigns(data: FactoryShadowMonitoring): FactoryShadowMonitoringCampaign[] {
  return data.notYet ?? [];
}

/** The last pass's campaigns whose plan differs, with what would change (served `change`), in served order. */
export function changingCampaigns(data: FactoryShadowMonitoring): FactoryShadowMonitoringCampaign[] {
  return data.campaigns.filter((c) => c.change != null);
}

const STATE_REASON_WORDS: Record<string, string> = {
  judge_failed: "Jev could not answer for a pipe",
  only_line_unpriced: "its only line to the Target has no price yet",
};

/** A campaign's state in one sentence: the served `stateDetail`, else its reason code in words, else as served. */
export function stateSentence(c: FactoryShadowMonitoringCampaign): string {
  if (c.stateDetail) return c.stateDetail;
  const reason = c.stateReason ?? c.failure;
  if (!reason) return c.state ?? c.status;
  return STATE_REASON_WORDS[reason] ?? unavailableWords(reason) ?? reason;
}

const ENGINE_REASON_WORDS: Record<string, string> = {
  engine_failed: "the Engine could not be computed for a campaign",
  replay_failed: "the 30-day replay failed",
};

/** A served Engine verdict reason in plain words; an unknown one reads as served. */
export function engineReasonWords(code: string): string {
  return ENGINE_REASON_WORDS[code] ?? code;
}

/** Regret (0..1, served) as a whole percent of each dollar's value lost; null stays null. */
export function regretPct(v: number | null | undefined): string | null {
  return v == null ? null : `${Math.round(v * 100)}%`;
}

/** The last pass's campaign places where both picks exist, in served order (campaign order, then line order). */
export function enginePlaceRows(data: FactoryShadowMonitoring): Array<{ campaign: FactoryShadowMonitoringCampaign; place: EnginePlaceSummary }> {
  return data.campaigns.flatMap((c) => (c.engine?.places ?? []).map((place) => ({ campaign: c, place })));
}
