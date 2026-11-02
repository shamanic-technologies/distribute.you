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
