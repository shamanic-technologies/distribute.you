/**
 * Why nothing goes out on a campaign (NEXT-STEPS-TRUE-REASON-1111): the step of the campaign that cannot
 * run, read from features-service's next-steps (`nextSends.heldBy`, `nextSends.leadsWaitingOnHeldEngine`).
 * Alias-free so vitest reads it directly.
 *
 * The verdict is the producer's: this module only NAMES it. The outcome is named by its served catalogue
 * label (passed in), never its key; the refusal is told in the client's words, never its code. A reason the
 * client can fix carries its fix (a brief); any other reason is ours to fix and carries none.
 */
import { z } from "zod";

const HeldEngineSchema = z.object({
  outcome: z.string(),
  pipeCampaignId: z.string().nullish(),
  reason: z.string(),
  heldSince: z.string(),
  lastAnsweredAt: z.string().nullish(),
});

/** The part of the next-steps read the campaign page uses. Every field lenient: an older producer omits them. */
export const CampaignNextStepsSchema = z.object({
  salesFunnelCampaignId: z.string(),
  nextSends: z
    .object({
      heldBy: HeldEngineSchema.nullish(),
      leadsWaitingOnHeldEngine: z.number().int().nullish(),
    })
    .nullish(),
  heldEngines: z.array(HeldEngineSchema).nullish(),
});

export type CampaignNextSteps = z.infer<typeof CampaignNextStepsSchema>;
export type HeldEngine = z.infer<typeof HeldEngineSchema>;

/** The client's fix for a refusal, when one exists. */
export type HeldStepFix = "brief";

/** Refusals the client fixes, keyed on the producer's code. Every other code is ours. */
const CLIENT_FIXES: Record<string, HeldStepFix> = {
  campaign_states_no_brief: "brief",
};

export interface HeldStepCopy {
  headline: string;
  body: string;
  fix: HeldStepFix | null;
  actionLabel: string | null;
}

/** "Oct 29", the day in UTC (one day on every surface, whatever the reader's zone). */
function utcDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function people(n: number): string {
  return n === 1 ? "1 person has been waiting" : `${n.toLocaleString("en-US")} people have been waiting`;
}

/**
 * The note's words. `stepLabel` is the served catalogue name of `heldBy.outcome`; null while the catalogue
 * has not answered (the note waits rather than print a key).
 */
export function heldStepCopy(held: HeldEngine, waiting: number | null | undefined, stepLabel: string): HeldStepCopy {
  const fix = CLIENT_FIXES[held.reason] ?? null;
  const since = utcDay(held.heldSince);
  const who = typeof waiting === "number" && waiting > 0 ? `${people(waiting)} at this step since ${since}.` : `On hold since ${since}.`;
  if (fix === "brief") {
    return {
      headline: `${stepLabel} needs your brief`,
      body: `${who} Write a brief to start this step.`,
      fix,
      actionLabel: "Write a brief",
    };
  }
  return {
    headline: `${stepLabel} is on hold`,
    body: `${who} Our team is on it. You have nothing to do.`,
    fix: null,
    actionLabel: null,
  };
}

/** The held step to state: the producer's `heldBy`, else nothing. */
export function heldStepOf(steps: CampaignNextSteps | null | undefined): { held: HeldEngine; waiting: number | null } | null {
  const held = steps?.nextSends?.heldBy ?? null;
  if (!held) return null;
  return { held, waiting: steps?.nextSends?.leadsWaitingOnHeldEngine ?? null };
}
