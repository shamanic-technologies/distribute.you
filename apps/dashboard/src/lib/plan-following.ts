import { z } from "zod";

/**
 * A funnel campaign that FOLLOWS ITS PLAN (owner 2026-10-28, FACTORY-P1-PLAN-FOLLOWING-DASH). Alias-free so vitest reads it.
 *
 * campaign-service #808: a funnel campaign's switch `followsPlan` (off by default) makes it run features-service's best
 * line to its Target and follow each plan change; `runningSalesFunnelId` = the funnel it runs now; `planCheck` = the
 * last check of the plan follower (every 10 min); a unit whose pipe left the plan is `planRole: "draining"` (it keeps
 * answering the people it already owes, takes no new people). Staff Monitoring reads `GET /internal/ops/plan-following`
 * through api-service #1409 (`/v1/campaigns/ops/plan-following?days=N`): status ok|red, the red campaigns, one row per
 * UTC day. Shapes as served (campaign-service openapi + `readPlanFollowing`); nothing is computed or re-graded here.
 */

const num = z.number();

export const PlanCheckSchema = z
  .object({
    state: z.string(),
    detail: z.string(),
    checkedAt: z.string(),
    planSalesFunnelId: z.string().optional(),
    planComputedAt: z.string().optional(),
  })
  .passthrough();
export type PlanCheck = z.infer<typeof PlanCheckSchema>;

export const PlanFollowingSchema = z
  .object({
    status: z.enum(["ok", "red"]),
    staleReason: z.string().nullable(),
    following: num,
    red: z.array(
      PlanCheckSchema.extend({
        salesFunnelCampaignId: z.string(),
        orgId: z.string(),
        brandId: z.string(),
        salesFunnelName: z.string(),
        runningSalesFunnelId: z.string(),
      }).passthrough(),
    ),
    byDay: z.array(z.object({ day: z.string(), following: num, red: num, changesApplied: num, checkedAt: z.string() }).passthrough()),
  })
  .passthrough();
export type PlanFollowing = z.infer<typeof PlanFollowingSchema>;

/**
 * Each served plan-check state in plain words (display lookup); an unknown state reads as served. `red` = the tone it
 * wears: campaign-service's own red list (`RED_PLAN_STATES`: the six states it puts on Monitoring), named here, never
 * decided here.
 */
const STATE_WORDS: Record<string, { words: string; red: boolean }> = {
  following: { words: "follows its plan: nothing to change", red: false },
  applied: { words: "plan applied", red: false },
  stopped: { words: "the campaign is stopped", red: false },
  no_plan: { words: "no plan computed for it yet", red: true },
  plan_unreadable: { words: "the plan could not be read", red: true },
  plan_not_ready: { words: "the plan is not ready yet", red: true },
  plan_not_runnable: { words: "plan not applied: we cannot run it", red: true },
  plan_outside_caps: { words: "plan not applied: it would spend outside the campaign's budget", red: true },
  apply_failed: { words: "plan not applied: the change failed", red: true },
};

export function planStateWords(state: string): { words: string; red: boolean } {
  return STATE_WORDS[state] ?? { words: state, red: false };
}

/** The read-only switch, in the owner's words. */
export function followsPlanWords(followsPlan: boolean): string {
  return followsPlan ? "Follows its plan" : "Fixed funnel";
}

/** A pipe that left the plan: it keeps answering the people it already owes, takes no new people. */
export const DRAINING_WORDS = "Finishing its follow-ups";

export function isDraining(unit: { planRole?: string | null }): boolean {
  return unit.planRole === "draining";
}
