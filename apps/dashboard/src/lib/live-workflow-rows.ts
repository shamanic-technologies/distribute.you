/**
 * ONE ROW PER WORKFLOW ON ONE LEG, as the live ranking tables draw it: the price per outcome,
 * whether it is mature, its return, its conversion, its outcomes and its spend, plus which row
 * goes first and which one the money goes to.
 *
 * Two sources, one shape, so the two tables cannot read a workflow two ways:
 *
 *  - `fleetWorkflowRows` — Research. The fleet ranking (features-service
 *    `/public/stats/leg-workflow-ranking`) names no org, brand, offer, campaign or audience,
 *    so nothing Research states depends on who is looking. The ORDER and both flags are the
 *    producer's (the best mature workflow holds the money; learning ones cheaper than it sit
 *    above it). Nothing is re-ranked here.
 *  - `missionWorkflowRows` — the brand's Workflows page. One mission's own figures: the
 *    CAMPAIGN grain of the per-brand ladder, never a coarser grain wearing its name, and the
 *    realized return of the mission's own per-workflow group. "Goes first" is the producer's
 *    rank 1 for the mission; "Money goes here" is the workflow the mission's runs LAST picked
 *    (the ledger, a fact), never a guess from the table.
 *
 * A cost per outcome is observed: null at zero outcomes, never a spend floor. Alias-free (types
 * only) so it carries real unit tests.
 */

export interface LiveWorkflowRow {
  slug: string;
  name: string | null;
  rank: number | null;
  costPerOutcomeUsd: number | null;
  roiMultiple: number | null;
  conversionRatePct: number | null;
  outcomes: number | null;
  spentUsd: number | null;
  /** The verdict on the scope the row is read at; null when it states none. */
  mature: boolean | null;
  /** FALSE when this scope has no evidence for the workflow at all. */
  ran: boolean;
  /** `active` / `deprecated` / `unassigned`, or null when not stated. */
  assignment: string | null;
  selectable: boolean;
  first: boolean;
  cash: boolean;
}

/** One served fleet ranking row (features-service `LegWorkflowRankingRow`). */
export interface FleetRankingRow {
  rank: number;
  workflowDynastySlug: string;
  workflowDynastyName: string | null;
  assignment: string;
  selectable: boolean;
  isMature: boolean | null;
  costPerOutcomeUsd: number | null;
  conversionRatePct: number | null;
  outcomes: number;
  spentUsd: number;
  roiMultiple: number | null;
  goesFirst: boolean;
  moneyGoesHere: boolean;
}

/** Research: the fleet ranking, verbatim, in the producer's order. */
export function fleetWorkflowRows(rows: readonly FleetRankingRow[]): LiveWorkflowRow[] {
  return [...rows]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({
      slug: r.workflowDynastySlug,
      name: r.workflowDynastyName,
      rank: r.rank,
      costPerOutcomeUsd: r.costPerOutcomeUsd,
      roiMultiple: r.roiMultiple,
      conversionRatePct: r.conversionRatePct,
      outcomes: r.outcomes,
      spentUsd: r.spentUsd,
      mature: r.isMature,
      ran: r.spentUsd > 0,
      assignment: r.assignment,
      selectable: r.selectable,
      first: r.goesFirst,
      cash: r.moneyGoesHere,
    }));
}

/** The slice of a per-brand ladder row a mission's table reads. */
export interface MissionLadderRow {
  audienceId: string | null;
  workflow: { workflowDynastySlug: string; workflowDynastyName?: string | null };
  estimatesByGrain: Partial<
    Record<
      string,
      | {
          isMature?: boolean | null;
          flash?: HalfFigures | null;
          mature?: HalfFigures | null;
        }
      | undefined
    >
  >;
  rank?: number | null;
  legAssignment?: { state: string; selectable: boolean } | undefined;
}

interface HalfFigures {
  spentUsd: number | null;
  contacted: number;
  outcomes: number;
  costPerOutcomeUsd: number | null;
  conversionRatePct: number | null;
}

/**
 * The brand's Workflows page, one mission: every workflow the mission's ladder carries (minus
 * the ones never put on the leg), in the producer's rank for this mission.
 *
 * `roiBySlug` is the mission's realized return per workflow (its own grouped revenue read);
 * `lastPickedSlug` is the workflow its runs last picked (`observedPicks.last`).
 */
export function missionWorkflowRows(input: {
  ladderRows: readonly MissionLadderRow[];
  roiBySlug: ReadonlyMap<string, number | null>;
  lastPickedSlug: string | null;
}): LiveWorkflowRow[] {
  const out: LiveWorkflowRow[] = [];
  for (const r of input.ladderRows) {
    if (r.audienceId !== null) continue;
    if (r.legAssignment?.state === "unassigned") continue;
    const block = r.estimatesByGrain.campaign;
    const mature = block?.isMature ?? null;
    const half = (mature === true ? block?.mature : block?.flash) ?? null;
    const slug = r.workflow.workflowDynastySlug;
    out.push({
      slug,
      name: r.workflow.workflowDynastyName ?? null,
      rank: r.rank ?? null,
      costPerOutcomeUsd: half?.costPerOutcomeUsd ?? null,
      roiMultiple: input.roiBySlug.get(slug) ?? null,
      conversionRatePct: half?.conversionRatePct ?? null,
      outcomes: half ? half.outcomes : null,
      spentUsd: half?.spentUsd ?? null,
      mature: block ? mature : null,
      ran: Boolean(block),
      assignment: r.legAssignment?.state ?? null,
      selectable: r.legAssignment ? r.legAssignment.selectable : true,
      first: false,
      cash: false,
    });
  }
  const ordered = out
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const ra = a.row.rank;
      const rb = b.row.rank;
      if (ra == null && rb == null) return a.i - b.i;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
    })
    .map((x) => x.row);
  const first = ordered.find((r) => r.selectable && r.rank != null);
  if (first) first.first = true;
  const cash = input.lastPickedSlug ? ordered.find((r) => r.slug === input.lastPickedSlug) : undefined;
  if (cash) cash.cash = true;
  return ordered;
}
