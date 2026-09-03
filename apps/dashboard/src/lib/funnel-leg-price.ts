// What one channel charges for the outcome of one arrow.
//
// A funnel is sold leg by leg, so the question a card answers is "what does this
// channel cost me per <the step this arrow lands on>". Two answers exist and they come
// from different places:
//
//   - A channel the CUSTOMER operates costs them nothing from us. That is a fact about
//     the channel, served on its own row (`operatedBy`), and it is true whether or not
//     anyone has ever spent on it — so it needs no measurement and reads `Free`.
//   - A channel WE operate has a price only once the fleet has spent enough to measure
//     one. features-service publishes that per (channel x funnel) pair, per step.
//
// A platform channel nobody has spent on yet has NO price, and it says so in the word
// the rest of the dashboard already uses for a figure withheld for want of evidence:
// `Learning`. Never a zero and never a dash — "we have not measured this" and "this is
// free" are different statements, and printing the second for the first would tell a
// customer a paid channel costs nothing.
//
// Only relative, alias-free imports live here (vitest does not resolve `@`), so this
// module carries REAL unit tests. Keep it that way.

/** One (channel x funnel) pair as features-service publishes it, narrowed to what a price needs. */
export interface ChannelFunnelEconomicsPair {
  channelSlug: string;
  funnelKey: string;
  /**
   * The funnel's steps in the PRODUCER's own words, index-parallel to
   * `result.economics.steps`. Carried only to check the two lists line up — the words
   * themselves are never rendered, because the customer reads this funnel's first step
   * as "Sales interest" while the producer calls it "Positive reply".
   */
  funnelSteps: string[];
  result: {
    measured: boolean;
    economics?: {
      steps: { costPerStepUsd: number | null }[];
    } | null;
  };
}

/**
 * The cross-org cost of reaching ONE step of ONE (channel x funnel) pair, in USD.
 *
 * Joined by INDEX, never by the step's words: the producer's label for a step is not
 * the one this app renders, so a match on labels finds nothing on the very funnel this
 * is most used for. The index is the arrow's own `toIndex`, which already indexes into
 * the funnel's steps.
 *
 * `expectedStepCount` guards the join. Two step lists that disagree on length are not the
 * same funnel, and an index taken across them points at a different step — a plausible
 * wrong number, which is worse than none.
 *
 * ⚠️ The served figure is CUMULATIVE from the funnel's entry: it is what reaching that
 * step has cost, not what this one arrow charges. Exact for a channel that produces the
 * funnel's first step; for an internal arrow it is the whole funnel priced under that
 * channel's name, which is the producer's model and not something to re-derive here.
 */
export function channelStepCostUsd({
  pairs,
  channelSlug,
  funnelKey,
  stepIndex,
  expectedStepCount,
}: {
  pairs: readonly ChannelFunnelEconomicsPair[];
  channelSlug: string;
  funnelKey: string;
  stepIndex: number;
  expectedStepCount: number;
}): number | null {
  const pair = pairs.find((p) => p.channelSlug === channelSlug && p.funnelKey === funnelKey);
  if (!pair) return null;
  if (!pair.result.measured) return null;
  const steps = pair.result.economics?.steps;
  if (!steps) return null;
  // Both lists must describe the same funnel before an index means anything.
  if (steps.length !== expectedStepCount) return null;
  if (pair.funnelSteps.length !== expectedStepCount) return null;
  const step = steps[stepIndex];
  if (!step) return null;
  return step.costPerStepUsd ?? null;
}

/**
 * What a card's price tag says.
 *
 * `learning` is the third state and the one that carries the rule: a channel WE operate
 * that the fleet has not spent enough through has no price to state, and the dashboard
 * already has a word for a figure withheld for want of evidence. Rendering nothing there
 * reads as a missing feature; rendering a dash or a zero states something false.
 *
 * `null` is NOT one of these — it means the price list has not settled yet, so the card
 * draws a skeleton. Answering `learning` before the read lands would state a verdict and
 * then replace it with a price, which is the surface contradicting itself a moment later.
 */
export type LegChannelPrice = { kind: "free" } | { kind: "priced"; usd: number } | { kind: "learning" };

/**
 * The price a card states, or null while the fleet price list is still in flight.
 *
 * `operatedBy` outranks the measurement: a channel the customer works themselves is
 * free from us however much the fleet has spent measuring the ones we run, so it needs
 * no read at all and states `Free` on the first paint.
 *
 * A price likewise needs no settle check — having one IS the answer. Only the absence of
 * one has to wait, because "not measured yet" and "not read yet" are different things
 * and only the first is `Learning`.
 */
export function legChannelPrice({
  operatedBy,
  costPerStepUsd,
  settled,
}: {
  operatedBy: string | null;
  costPerStepUsd: number | null;
  /** Has the price list resolved (or errored)? An errored read is settled: we have no figure. */
  settled: boolean;
}): LegChannelPrice | null {
  if (operatedBy === "customer") return { kind: "free" };
  if (costPerStepUsd != null) return { kind: "priced", usd: costPerStepUsd };
  if (!settled) return null;
  return { kind: "learning" };
}

/**
 * The tag's words for the two states that state a figure — `Free`, or the price over the
 * step it buys.
 *
 * `learning` is deliberately absent: it is rendered by the shared `LearningTag`, which
 * owns that word everywhere it appears, so this module never spells it. A second place
 * saying "Learning" is how one surface comes to say it differently.
 *
 * The step is named in THIS app's vocabulary (the funnel's own `steps`), never the
 * producer's — the reply funnel's first step reads "Sales interest" here and "Positive
 * reply" upstream, and a card must say what the rest of the dashboard says.
 */
export function legPriceLabel(
  price: { kind: "free" } | { kind: "priced"; usd: number },
  stepLabel: string,
  fmtUsd: (usd: number) => string,
): string {
  if (price.kind === "free") return "Free";
  return `${fmtUsd(price.usd)} / ${stepLabel}`;
}
