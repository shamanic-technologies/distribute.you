import { z } from "zod";
import type { EnginePlaceFull, FactoryShadowPlan, PipeVerdict } from "./factory-shadow";
import { pricedRunning } from "./factory-shadow";

/**
 * The GTM Factory campaign page's joins (FACTORY-USER-DASHBOARD-1102). Alias-free so vitest reads it. Joins only:
 * every figure stays the served one, nothing is computed.
 */

/** One outcome of the plan tree, from the Target down: the Engine place that makes it, or who performs it. */
export interface PlanNode {
  outcome: string;
  outcomeName: string;
  /** The Engine competing on this outcome for the campaign (features-service `engine.places`), when there is one. */
  place: EnginePlaceFull | null;
  /** The way the running line makes it, when no Engine competes on it (the client's own team). */
  channelName: string | null;
  pipeId: string | null;
  performedBy: string | null;
}

const toStepOf = (legKey: string): string => legKey.split("_to_")[1] ?? legKey;

/**
 * The plan tree from the Target down to the first outcome after Start. The running line names each outcome in order;
 * its Engine place (same outcome) carries the competing scripts. A campaign whose running line is not priced draws the
 * Engine places alone, Target-side first.
 */
export function planLegsFromTarget(shadow: Pick<FactoryShadowPlan, "plan" | "engine">): PlanNode[] {
  const places = shadow.engine?.places ?? [];
  const running = pricedRunning(shadow.plan?.running ?? null);
  if (running && running.legs.length > 0) {
    const figures = running.figures.legs ?? [];
    return running.legs
      .map((leg, i) => {
        const outcome = toStepOf(leg.legKey);
        const place = places.find((p) => p.outcome === outcome) ?? null;
        const fig = figures[i];
        return {
          outcome,
          outcomeName: place?.outcomeName ?? outcome,
          place,
          channelName: leg.channelName,
          pipeId: leg.pipeId,
          performedBy: fig?.costSource === "customer_team" ? "Done by your team" : null,
        };
      })
      .reverse();
  }
  return [...places].reverse().map((p) => ({ outcome: p.outcome, outcomeName: p.outcomeName, place: p, channelName: null, pipeId: null, performedBy: null }));
}

/** What the brief keeps and rules out at one Engine: the served verdicts on the ways that make its outcome, by channel. */
export function strategyOfPlace(place: Pick<EnginePlaceFull, "outcome">, verdicts: readonly PipeVerdict[]): { kept: string[]; ruledOut: string[] } {
  const here = verdicts.filter((v) => v.toStep === place.outcome);
  const kept = [...new Set(here.filter((v) => v.excluded === false || v.excluded === null).map((v) => v.channelName))];
  const ruledOut = [...new Set(here.filter((v) => v.excluded === true).map((v) => v.channelName))].filter((n) => !kept.includes(n));
  return { kept, ruledOut };
}

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

const JourneyScriptSchema = z.object({ workflowDynastySlug: z.string(), workflowName: z.string(), sharePct: z.number() }).passthrough();
const JourneyTransitionSchema = z
  .object({
    pipeId: z.string(),
    fromStep: z.string(),
    fromLabel: z.string(),
    toStep: z.string(),
    toLabel: z.string(),
    people: z.number(),
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
    case null:
      return null;
    default:
      console.error("[factory-campaign] a served reason has no words yet", { reason });
      return null;
  }
}
