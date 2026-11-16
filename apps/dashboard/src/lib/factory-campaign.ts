import { z } from "zod";

/**
 * The GTM Factory campaign page's joins (FACTORY-USER-DASHBOARD-1102). Alias-free so vitest reads it. Joins only:
 * every figure stays the served one, nothing is computed.
 */

// ─── Measured milestones and people journeys (features-service FACTORY-USER-DASHBOARD-1102) ───────────────────


/** A milestone figure: its value, whether it is MEASURED on the campaign or EXPECTED from its plan, else why none. */
const MilestoneValueSchema = z
  .object({ value: z.number().nullable(), basis: z.enum(["measured", "expected"]).nullable(), unavailableReason: z.string().nullable() })
  .passthrough();
export type MilestoneValue = z.infer<typeof MilestoneValueSchema>;

const MilestoneRowSchema = z
  .object({
    step: z.string(),
    label: z.string(),
    isTarget: z.boolean(),
    outcomes: z.number().nullable(),
    outcomesUnavailableReason: z.string().nullable(),
    costPerOutcomeUsd: MilestoneValueSchema,
    costFromStartUsd: MilestoneValueSchema,
    conversionFromAbovePct: MilestoneValueSchema,
    attemptsPerTarget: MilestoneValueSchema,
  })
  .passthrough();
export type MilestoneRow = z.infer<typeof MilestoneRowSchema>;

export const CampaignMilestonesSchema = z
  .object({
    salesFunnelCampaignId: z.string(),
    target: z.string().nullable(),
    planComputedAt: z.string().nullable(),
    milestones: z.array(MilestoneRowSchema),
    milestonesUnavailableReason: z.string().nullable(),
  })
  .passthrough();
export type CampaignMilestones = z.infer<typeof CampaignMilestonesSchema>;

// `icon` / `color`: the script's served mark (features-service SCRIPT-MARKS-1103), null until it has one.
const JourneyScriptSchema = z
  .object({ workflowDynastySlug: z.string(), workflowName: z.string(), sharePct: z.number(), icon: z.string().nullish(), color: z.string().nullish() })
  .passthrough();
const JourneyTransitionSchema = z
  .object({
    pipeId: z.string(),
    fromStep: z.string(),
    fromLabel: z.string(),
    toStep: z.string(),
    toLabel: z.string(),
    // LEDGER-ONLY-1107-P2: the ledger's Units of the step; null when the ledger holds none (never 0).
    people: z.number().nullable(),
    scripts: z.array(JourneyScriptSchema),
    scriptsUnavailableReason: z.string().nullable(),
  })
  .passthrough();
export type JourneyTransition = z.infer<typeof JourneyTransitionSchema>;

export const PeopleJourneysSchema = z.object({ salesFunnelCampaignId: z.string(), transitions: z.array(JourneyTransitionSchema) }).passthrough();
export type PeopleJourneys = z.infer<typeof PeopleJourneysSchema>;

/** Why a milestone has no figure, in the client's words. A reason with no words is logged by the caller. */
export function milestoneReasonWords(reason: string | null): string | null {
  switch (reason) {
    case "plan_not_computed_yet":
      return "Your campaign's plan is computed every 3 hours. It shows here after the next pass.";
    case "no_spend_yet":
      return "Nobody yet";
    case "spend_recorded_under_another_pipe":
      return "Its cost is counted on the next step";
    case "done_by_your_team":
      return "Done by your team";
    case null:
      return null;
    default:
      console.error("[factory-campaign] a served reason has no words yet", { reason });
      return null;
  }
}
