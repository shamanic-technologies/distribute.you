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
 *    rank 1 for the mission, mature or not; "Money goes here" is the producer's
 *    `recommendedWorkflowDynastySlug`, read, never re-derived. Electing "the first mature row in
 *    rank order" here put the money on Dawn ($4.73/visit) while the producer recommended and ran
 *    Osprey ($2.26/visit): the rank had tied on the offer and fallen back to the slug (prod
 *    2026-10-01, brand c4b5284d).
 *
 * A cost per outcome is observed: null at zero outcomes, never a spend floor. Alias-free (types
 * only) so it carries real unit tests.
 */

/**
 * A workflow's distinctive name: its channel's name dropped from the front ("Sales Cold Email
 * Outreach Maelstrom" under "Sales Cold Email Outreach" reads "Maelstrom"). A name that does not
 * start with it, or that would be left empty, is returned unchanged.
 */
export function shortWorkflowName(name: string, channelName: string | null | undefined): string {
  const prefix = channelName?.trim();
  if (!prefix) return name;
  if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
    const rest = name.slice(prefix.length).replace(/^[\s·:-]+/, "").trim();
    if (rest) return rest;
  }
  return name;
}

export interface LiveWorkflowRow {
  slug: string;
  name: string | null;
  rank: number | null;
  costPerOutcomeUsd: number | null;
  roiMultiple: number | null;
  conversionRatePct: number | null;
  outcomes: number | null;
  spentUsd: number | null;
  /**
   * Whether the WORKFLOW is proven on the leg (mature) or still learning — the producer's verdict,
   * stated on every row, including a workflow this mission has not run yet.
   */
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
  /** The WORKFLOW's verdict on the fleet of its leg (the ladder's row `maturity.isMature`). */
  maturity?: { isMature: boolean | null } | undefined;
}

interface HalfFigures {
  spentUsd: number | null;
  contacted: number;
  outcomes: number;
  costPerOutcomeUsd: number | null;
  conversionRatePct: number | null;
}

/**
 * The brand's Workflows page, one mission: every ladder row the caller passes, in the producer's
 * rank for this mission.
 *
 * `roiBySlug` is the mission's realized return per workflow (its own grouped revenue read).
 * `recommendedSlug` is the producer's pick for the mission: the row the money goes to.
 */
export function missionWorkflowRows(input: {
  ladderRows: readonly MissionLadderRow[];
  roiBySlug: ReadonlyMap<string, number | null>;
  recommendedSlug: string | null;
}): LiveWorkflowRow[] {
  const out: LiveWorkflowRow[] = [];
  for (const r of input.ladderRows) {
    if (r.audienceId !== null) continue;
    // Which workflows are shown is the CALLER's call (`hiddenWorkflowSlugs` hides an unassigned
    // one only when this mission never ran it). Dropping every unassigned row here lost the
    // workflow a mission actually runs when the owner has not assigned it on the leg yet.
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
      mature: r.maturity?.isMature ?? null,
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
  const cash = ordered.find((r) => r.selectable && r.slug === input.recommendedSlug);
  if (cash) cash.cash = true;
  return ordered;
}
