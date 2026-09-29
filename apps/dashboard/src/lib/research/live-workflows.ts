/**
 * Research's LIVE workflow list for one crew: the producer's own ranking at the crew's leg,
 * one row per workflow, in the producer's order.
 *
 * Every value is read off the ladder features-service serves (the same read campaign-service
 * picks a workflow from). Nothing here ranks, divides or sums: the order is the served `rank`,
 * the price is the row's `resolved.costPerOutcomeUsd`, the verdict is `maturity.resolved.isMature`.
 * The cost is shown beside the rank so a reader sees at once when the two orders disagree.
 *
 * Alias-free (types only) so it carries real unit tests.
 */

/** The slice of a ladder row this list reads. */
export interface LiveLadderRow {
  audienceId: string | null;
  workflow: { workflowDynastySlug: string; workflowDynastyName: string | null };
  resolved: { costPerOutcomeUsd: number | null; roiMultiple: number | null; conversionRatePct: number | null; grain: string | null };
  estimatesByGrain: Partial<
    Record<string, { legOutcome?: { outcomeCount: number | null; spentUsd: number | null } | null } | undefined>
  >;
  maturity?: { isMature: boolean | null; resolved: { isMature: boolean | null } } | undefined;
  measured: boolean;
  rank?: number | null;
  legAssignment?: { state: string; selectable: boolean } | undefined;
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
  /** The producer's verdict for this row; null when it states none. */
  mature: boolean | null;
  measured: boolean;
  /** `active` / `deprecated`, or null when the producer states no assignment. */
  assignment: string | null;
  selectable: boolean;
  /** The first row in the producer's order a run may pick: it goes first. */
  first: boolean;
  /** The first MATURE row a run may pick, in the producer's order: where the money goes. */
  cash: boolean;
}

/**
 * The campaign-level rows (`audienceId: null`), minus the workflows never put on this leg
 * (`unassigned`, hidden like every v2 workflow surface), in the producer's rank order.
 * A row the producer gives no rank sits last, in its served order.
 */
export function liveWorkflowRows(rows: readonly LiveLadderRow[]): LiveWorkflowRow[] {
  const out: LiveWorkflowRow[] = [];
  for (const r of rows) {
    if (r.audienceId !== null) continue;
    if (r.legAssignment?.state === "unassigned") continue;
    const grain = r.resolved.grain;
    const block = grain ? r.estimatesByGrain[grain] : undefined;
    out.push({
      slug: r.workflow.workflowDynastySlug,
      name: r.workflow.workflowDynastyName,
      rank: r.rank ?? null,
      costPerOutcomeUsd: r.resolved.costPerOutcomeUsd,
      roiMultiple: r.resolved.roiMultiple,
      conversionRatePct: r.resolved.conversionRatePct,
      outcomes: block?.legOutcome?.outcomeCount ?? null,
      spentUsd: block?.legOutcome?.spentUsd ?? null,
      mature: r.maturity?.resolved.isMature ?? null,
      measured: r.measured,
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
  const cash = ordered.find((r) => r.selectable && r.rank != null && r.mature === true);
  if (cash) cash.cash = true;
  return ordered;
}
