/**
 * WHERE THE COST CURVE IS HEADING — the floor the best workflow can put it on, and the
 * dotted path from today's price down to it.
 *
 * The solid curve is a CUMULATIVE cost per outcome: every dollar spent over every outcome
 * dated so far. A cumulative average approaches whatever the NEXT outcome costs, so a
 * floor plus the curve's own last point determines the path exactly — nothing here is
 * invented, it is two served numbers and one division.
 *
 * The floor is the recommended workflow's own campaign-grain price, read verbatim off the
 * ranking ladder. This module ranks nothing, compares no figure and picks no winner: the
 * producer states `recommendedWorkflowDynastySlug` and states that row's cost, and both
 * are taken as given. The one judgement is refusing a floor that is not below the curve.
 *
 * Deliberately alias-free so it carries real unit tests. Keep it that way.
 */

/** How far the tail is drawn, as a multiple of the outcomes already counted. */
const TAIL_OUTCOME_MULTIPLE = 9;

/**
 * How much of the chart the tail is allowed to take, as a share of the real days.
 *
 * A categorical axis gives every point the same width, so the tail's LENGTH is its share
 * of the picture — and the picture is about what actually happened. At 24 fixed points
 * against a week of history the real curve was squeezed into the left third and the
 * projection became the subject, which is backwards. Proportional keeps the balance at
 * every age: a week of history or a quarter of it, the tail stays a hint.
 */
const TAIL_SHARE_OF_HISTORY = 0.6;
const TAIL_MIN_POINTS = 4;
const TAIL_MAX_POINTS = 12;

/** How many points the tail draws beside `historyPoints` real days. */
export function asymptoteTailPoints(historyPoints: number): number {
  return Math.max(
    TAIL_MIN_POINTS,
    Math.min(TAIL_MAX_POINTS, Math.round(historyPoints * TAIL_SHARE_OF_HISTORY)),
  );
}

/** The one row shape this module reads. Structural, so the api client's type satisfies it. */
export interface LadderRowForFloor {
  audienceId: string | null;
  workflow: { workflowDynastySlug: string; workflowDynastyName: string | null };
  resolved: { costPerOutcomeUsd: number | null };
  rank?: number | null;
}

export interface BestWorkflowFloor {
  /** The served price, verbatim. */
  costPerOutcomeUsd: number;
  /** The workflow it belongs to, in the producer's own words. Null when it names none. */
  workflowName: string | null;
  workflowDynastySlug: string;
}

/**
 * The floor, at CAMPAIGN grain.
 *
 * Campaign grain is `audienceId === null` — the same row the Workflows page draws in its
 * Campaign column, so the figure here and the one a reader clicks through to are one
 * number rather than two that happen to agree.
 *
 * `hiddenSlugs` is the page's own eligibility verdict (`hiddenWorkflowSlugs`), passed in
 * rather than re-derived: the producer's #1 can be a workflow this leg's model-tier rule
 * excludes, which campaign-service can never select — so a floor taken from it would be a
 * price nothing can reach. When the recommendation is hidden, the best rank that is NOT
 * is used instead; a row carrying no rank states no position and is passed over rather
 * than assumed last.
 */
export function bestWorkflowFloor(args: {
  rows: readonly LadderRowForFloor[];
  recommendedWorkflowDynastySlug: string | null;
  hiddenSlugs?: ReadonlySet<string>;
}): BestWorkflowFloor | null {
  const hidden = args.hiddenSlugs ?? new Set<string>();
  const campaignRows = args.rows.filter(
    (r) =>
      r.audienceId === null &&
      r.resolved.costPerOutcomeUsd != null &&
      !hidden.has(r.workflow.workflowDynastySlug),
  );
  if (campaignRows.length === 0) return null;

  const pick =
    campaignRows.find(
      (r) => r.workflow.workflowDynastySlug === args.recommendedWorkflowDynastySlug,
    ) ??
    // The producer's recommendation is excluded here, so the best OFFERED rank stands in.
    // Ranked ascending on the producer's own position — never on the price, which would
    // be this module re-deriving the ranking it exists to read.
    campaignRows
      .filter((r): r is LadderRowForFloor & { rank: number } => typeof r.rank === "number")
      .sort((a, b) => a.rank - b.rank)[0];
  if (!pick || pick.resolved.costPerOutcomeUsd == null) return null;
  return {
    costPerOutcomeUsd: pick.resolved.costPerOutcomeUsd,
    workflowName: pick.workflow.workflowDynastyName,
    workflowDynastySlug: pick.workflow.workflowDynastySlug,
  };
}

export interface TailPoint {
  /** Position past today. Unitless — the chart prints no tick for it. */
  step: number;
  /** The cumulative price after that many more outcomes at the floor's rate. */
  value: number;
}

/**
 * The dotted path from today's cumulative price down toward the floor.
 *
 * `(spend + floor·k) / (outcomes + k)` — what the cumulative average becomes after `k`
 * more outcomes each costing the floor. Strictly decreasing while the current price is
 * above the floor, and it never reaches it: the money already spent stays in the
 * numerator forever, which is the whole reading. Drawn out to nine times the outcomes
 * counted so far, which closes ninety per cent of the gap whatever the scale.
 *
 * Returns an empty array when there is nothing to draw — no outcomes yet, or a floor at
 * or above where the curve already sits. An asymptote above the line says nothing, and a
 * RISING dotted tail would read as a warning nobody meant.
 */
export function asymptoteTail(args: {
  cumulativeSpendUsd: number;
  cumulativeOutcomes: number;
  floorUsd: number;
  points?: number;
}): TailPoint[] {
  const { cumulativeSpendUsd: spend, cumulativeOutcomes: outcomes, floorUsd: floor } = args;
  if (!(outcomes > 0) || !(spend > 0) || !(floor > 0)) return [];
  const current = spend / outcomes;
  if (!(floor < current)) return [];
  const points = args.points ?? TAIL_MAX_POINTS;
  const maxK = outcomes * TAIL_OUTCOME_MULTIPLE;
  return Array.from({ length: points }, (_, i) => {
    const k = (maxK * (i + 1)) / points;
    return { step: i + 1, value: (spend + floor * k) / (outcomes + k) };
  });
}
