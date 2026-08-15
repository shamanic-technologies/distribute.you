/**
 * The Workflow page's row model: one row per workflow dynasty, cross-brand.
 *
 * Every cell is a field features-service SERVED — the browser divides nothing.
 * That is why three reads are joined instead of one: the cost-per-outcome
 * endpoint answers for ONE objective at a time, so the positive-reply rate and
 * the website-visit rate are two calls, and the outreach volume lives on a
 * third (the ranked leaderboard's `stats` bag). Joining them on
 * `workflowDynastySlug` is a display lookup, not a computed metric.
 *
 * Alias-free (type-only imports) so it carries real unit tests.
 */
import type { CrossOrgWorkflowCostRow, CrossOrgWorkflowOutreachRow } from "./api";
import type { WorkflowCatalogueEntry } from "./feature-stats-workflow-catalogue";

export type WorkflowPerfRow = {
  slug: string;
  name: string;
  /** Cross-org positive replies attributed to this workflow. */
  positiveReplies: number | null;
  /** Cost per positive reply — the lifetime pooled rate for objective=positiveReply. */
  cpprUsd: number | null;
  /** Cross-org website visits (clicks) attributed to this workflow. */
  websiteVisits: number | null;
  /** Cost per website visit — the lifetime pooled rate for objective=websiteVisit. */
  cpwvUsd: number | null;
  /** People this workflow contacted. NOT a run count — see getCrossOrgWorkflowOutreach. */
  outreach: number | null;
  /** Cross-org fleet spend attributed to this workflow. */
  investedUsd: number | null;
};

/** `null` for absent/non-finite, so a missing figure renders "—" and never a false 0. */
function numOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Join the cross-org reads and the workflow catalogue into one row per dynasty.
 *
 * The row set is the UNION of every source: a workflow the outreach read has not
 * caught up on still shows its money, with "—" where a source is silent.
 * Dropping it would under-report the fleet.
 *
 * The catalogue is in that union for the same reason, one step further: all
 * three stats reads are keyed on spend and outcomes, so a workflow that has
 * never run is absent from every one of them. Without the catalogue a workflow
 * created from this page would be invisible on it until its first billed run —
 * the page would look like the creation had not happened.
 */
export function buildWorkflowPerfRows(
  replyRows: CrossOrgWorkflowCostRow[],
  visitRows: CrossOrgWorkflowCostRow[],
  outreachRows: CrossOrgWorkflowOutreachRow[],
  catalogueRows: WorkflowCatalogueEntry[] = [],
): WorkflowPerfRow[] {
  const byReply = new Map(replyRows.map((r) => [r.workflowDynastySlug, r]));
  const byVisit = new Map(visitRows.map((r) => [r.workflowDynastySlug, r]));
  const byOutreach = new Map(outreachRows.map((r) => [r.workflow.workflowDynastySlug, r]));
  const byCatalogue = new Map(catalogueRows.map((r) => [r.workflowDynastySlug, r]));

  const slugs = [
    ...new Set([
      ...byReply.keys(),
      ...byVisit.keys(),
      ...byOutreach.keys(),
      ...byCatalogue.keys(),
    ]),
  ];

  return slugs.map((slug) => {
    const reply = byReply.get(slug);
    const visit = byVisit.get(slug);
    const outreach = byOutreach.get(slug);
    const catalogue = byCatalogue.get(slug);
    return {
      slug,
      name:
        reply?.workflowDynastyName ??
        visit?.workflowDynastyName ??
        outreach?.workflow.workflowDynastyName ??
        catalogue?.workflowDynastyName ??
        slug,
      // Both cost endpoints report the same counts for a dynasty; prefer the
      // objective whose outcome the column names, then fall back.
      positiveReplies: numOrNull(reply?.observedPositiveReplies ?? visit?.observedPositiveReplies),
      cpprUsd: numOrNull(reply?.costPerOutcomeUsd),
      websiteVisits: numOrNull(visit?.observedClicks ?? reply?.observedClicks),
      cpwvUsd: numOrNull(visit?.costPerOutcomeUsd),
      outreach: numOrNull(outreach?.stats.recipientsContacted),
      // Spend is one figure per dynasty, identical on both objective responses.
      investedUsd: numOrNull(reply?.spentUsd ?? visit?.spentUsd),
    };
  });
}

/** Column key → the value it sorts on, so the table can never order by a column it does not show. */
export const WORKFLOW_PERF_SORT_KEYS: Record<
  string,
  (r: WorkflowPerfRow) => number | string | null
> = {
  name: (r) => r.name,
  positiveReplies: (r) => r.positiveReplies,
  cppr: (r) => r.cpprUsd,
  websiteVisits: (r) => r.websiteVisits,
  cpwv: (r) => r.cpwvUsd,
  outreach: (r) => r.outreach,
  invested: (r) => r.investedUsd,
};
