/**
 * WHAT EACH GRAIN SAYS ABOUT ONE WORKFLOW — read, never derived.
 *
 * features-service answers a leg-keyed workflow-projection with a cascade of grains per
 * row (the fleet, this brand, this campaign, one audience), and since v0.164.0 each of
 * them carries a `legOutcome`: the cost of one outcome OF THE LEG, how many of those
 * outcomes were observed, and the spend behind them. Every figure this module returns is
 * one of those fields verbatim.
 *
 * ── WHY A MODULE RATHER THAN A TERNARY AT THE RENDER SITE ────────────────────────
 *
 * The page offers the same three columns at three grains, and the panel offers all of
 * them at once plus every audience. Picking the block per grain in each of those places
 * is how two surfaces come to state different money for one workflow — so the pick
 * happens once, here, and both call it.
 *
 * ── THE RANK IS THE PRODUCER'S, AND THAT IS THE WHOLE POINT ──────────────────────
 *
 * Nothing here sorts workflows or assigns a position. A page that ranked the rows it
 * DISPLAYS produced a second order, and the two disagreed: the recommended workflow sat
 * 18th of 24 on a page that said the list was ranked the way we pick, because the page
 * ranked one row per workflow while the pick was made over every row a dynasty has —
 * including its audiences. `rank` is read off the wire and rendered.
 *
 * A consequence worth knowing before reading the table: for a workflow whose best row is
 * an AUDIENCE, the rank stands on a figure no grain column shows. `audienceRowsFor` is
 * what makes that visible — the panel lists those rows cheapest-first, so the figure the
 * rank stands on is the top line rather than a number nobody can find.
 *
 * Alias-free (no `@/` import, no zod) so it carries REAL unit tests — vitest resolves no
 * `@` alias in this repo. Keep it that way.
 */

/** The grains a READER compares. `audience` is deliberately absent: an audience is not a
 *  column, it is a row of the panel's own list. */
export type WorkflowGrain = "campaign" | "brand" | "crossOrg";

export const WORKFLOW_GRAINS: readonly WorkflowGrain[] = ["campaign", "brand", "crossOrg"];

export const WORKFLOW_GRAIN_LABEL: Record<WorkflowGrain, string> = {
  campaign: "Campaign",
  brand: "Brand",
  crossOrg: "Global",
};

/** One line under the heading, so the figures below it are never read at the wrong scope. */
export const WORKFLOW_GRAIN_NOTE: Record<WorkflowGrain, string> = {
  campaign: "Every figure below is this campaign's own.",
  brand: "Every figure below is this brand's own, across every campaign on this channel.",
  crossOrg:
    "Every figure below is across every client we run this channel for. It counts what each workflow costs to produce an outcome — including spend we later refunded — so it is a different question from what you were charged.",
};

/** What ONE grain states about the leg, exactly as served. */
export interface WorkflowLegOutcome {
  costPerOutcomeUsd: number | null;
  outcomeCount: number | null;
  /** FALSE means the count was walked through the funnel's declared rates rather than
   *  observed — a projection, and it says so on screen rather than reading as people. */
  outcomeObserved: boolean;
  spentUsd: number;
}

/** A grain block, as narrowly as this module reads one. */
export interface WorkflowGrainBlock {
  costBasis?: "charged" | "incurred" | null;
  evidence: { spentUsd: number; observedContacted: number };
  legOutcome?: WorkflowLegOutcome | null;
  projected?: {
    costPerPaidClientUsd: number | null;
    costPerMeetingBookedUsd: number | null;
    roiMultiple: number | null;
    cacPct: number | null;
  } | null;
}

export interface WorkflowLadderRowShape {
  audienceId: string | null;
  workflow: { workflowDynastySlug: string };
  estimatesByGrain: Partial<Record<"crossOrg" | "brand" | "campaign" | "audience", WorkflowGrainBlock>>;
  measured: boolean;
  rank?: number | null;
}

/**
 * ONE grain's figures, or null when the grain has nothing.
 *
 * NULL and ZERO are different answers and both occur: a grain absent from the cascade
 * never spent here, while a grain present with `outcomeCount: 0` spent and produced
 * nothing. The first renders a dash, the second renders the zero it measured.
 */
export function grainFigures(
  block: WorkflowGrainBlock | undefined,
): WorkflowLegOutcome | null {
  if (!block) return null;
  const leg = block.legOutcome;
  if (!leg) return null;
  return leg;
}

/** The grains this workflow actually has evidence at, in cascade order (coarse first). */
export function grainsWithEvidence(row: WorkflowLadderRowShape): WorkflowGrain[] {
  return WORKFLOW_GRAINS.filter((g) => row.estimatesByGrain[g] !== undefined).sort(
    (a, b) => WORKFLOW_GRAINS.indexOf(a) - WORKFLOW_GRAINS.indexOf(b),
  );
}

/** One audience's own row for a workflow — its id and what its grain states. */
export interface WorkflowAudienceRow {
  audienceId: string;
  figures: WorkflowLegOutcome | null;
  contacted: number | null;
}

/**
 * EVERY audience row this dynasty has, cheapest first.
 *
 * The producer sends one row per (audience x workflow) and the page throws none of them
 * away: they are what explains a rank standing on a figure no column shows. Ordering is
 * a DISPLAY choice over served values — nothing is computed, and no row is elected "the
 * one the rank stands on", because that claim belongs to the producer.
 *
 * A row whose audience grain states no price sorts LAST rather than being dropped: it
 * ran for that audience and produced nothing, which is a fact worth seeing.
 */
export function audienceRowsFor(
  rows: readonly WorkflowLadderRowShape[],
  dynastySlug: string,
): WorkflowAudienceRow[] {
  const out: WorkflowAudienceRow[] = [];
  for (const r of rows) {
    if (r.audienceId === null) continue;
    if (r.workflow.workflowDynastySlug !== dynastySlug) continue;
    const block = r.estimatesByGrain.audience;
    out.push({
      audienceId: r.audienceId,
      figures: grainFigures(block),
      contacted: block ? block.evidence.observedContacted : null,
    });
  }
  return out.sort((a, b) => {
    const ca = a.figures?.costPerOutcomeUsd ?? null;
    const cb = b.figures?.costPerOutcomeUsd ?? null;
    if (ca == null && cb == null) return a.audienceId < b.audienceId ? -1 : 1;
    if (ca == null) return 1;
    if (cb == null) return -1;
    if (ca !== cb) return ca - cb;
    return a.audienceId < b.audienceId ? -1 : 1;
  });
}

/** The BRAND-level row of each dynasty — the one the table draws, and the one carrying
 *  the rank every row of that dynasty shares. FIRST wins, deterministically. */
export function brandLevelRows(
  rows: readonly WorkflowLadderRowShape[],
): WorkflowLadderRowShape[] {
  const seen = new Set<string>();
  const out: WorkflowLadderRowShape[] = [];
  for (const r of rows) {
    if (r.audienceId !== null) continue;
    const slug = r.workflow.workflowDynastySlug;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(r);
  }
  return out;
}
