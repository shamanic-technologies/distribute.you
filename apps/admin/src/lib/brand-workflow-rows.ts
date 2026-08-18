/**
 * The brand Workflows scorecard's row model: one row per workflow dynasty the
 * brand has run, every figure scoped to THIS brand and realized.
 *
 * There is no cross-brand half. The page answers "which of MY workflows paid",
 * and a fleet benchmark sitting in the same table under the same column names
 * invites the reader to compare one brand against everyone line for line —
 * two different questions wearing one heading. The fleet answer keeps its own
 * page (`/feature-stats/<slug>/workflows`), where every row IS the fleet.
 *
 * Every figure is a field features-service served for this brand; this module
 * joins, converts cents to dollars and orders. It computes no ratio.
 *
 * Alias-free (type-only imports) so it carries real unit tests.
 */
import type { FeatureRevenueByWorkflowGroup } from "./api";

export type BrandWorkflowRow = {
  slug: string;
  name: string;
  /** Realized money, all four already served on the per-workflow grouping. */
  roiMultiple: number | null;
  cacPct: number | null;
  cacUsd: number | null;
  pipelineUsd: number | null;
  /**
   * What the return was made of: how many people this workflow reached and what
   * each outcome cost, for THIS brand.
   *
   * OBSERVED, never floored — a workflow with spend that bought none of an
   * outcome reports null, "we could not measure this", never a 0 and never a
   * fleet estimate. Projection has its own surface.
   */
  positiveReplies: number | null;
  cpprUsd: number | null;
  websiteVisits: number | null;
  cpwvUsd: number | null;
  outreach: number | null;
  /**
   * Realized spend — the ACTUAL billed amount, which is the same denominator
   * ROI and %CAC ride. Deliberately not the committed total (actual + open
   * provisioned holds): a row whose ROI divides by one number and whose spend
   * column prints another contradicts itself.
   */
  investedUsd: number | null;
};

function numOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Pure unit conversion, not a derived metric. */
function centsToUsd(value: number | null | undefined): number | null {
  const cents = numOrNull(value);
  return cents === null ? null : cents / 100;
}

/**
 * The workflow key a brand group is filed under.
 *
 * The producer owns how it identifies a workflow, so both spellings are read and
 * the dynasty is preferred. A group carrying neither is unfileable and is
 * dropped rather than rendered under a fabricated name.
 */
export function brandGroupKey(group: FeatureRevenueByWorkflowGroup): string | null {
  return group.workflowDynastySlug ?? group.workflowSlug ?? null;
}

/** One row per workflow dynasty this brand has run. */
export function buildBrandWorkflowRows(
  brandGroups: FeatureRevenueByWorkflowGroup[],
): BrandWorkflowRow[] {
  const byBrand = new Map<string, FeatureRevenueByWorkflowGroup>();
  for (const g of brandGroups) {
    const key = brandGroupKey(g);
    if (key) byBrand.set(key, g);
  }

  return [...byBrand.entries()].map(([slug, g]) => ({
    slug,
    name: g.workflowDynastyName ?? g.workflowName ?? slug,
    roiMultiple: numOrNull(g.costEconomics.roiMultiple),
    cacPct: numOrNull(g.costEconomics.costOfAcquisitionPct),
    cacUsd: numOrNull(g.costEconomics.costPerAcquisitionUsd),
    pipelineUsd: numOrNull(g.headline.totalPipelineUsd),
    positiveReplies: numOrNull(g.outcomes?.recipientsRepliesPositive),
    cpprUsd: centsToUsd(g.outcomes?.cpprCents),
    websiteVisits: numOrNull(g.outcomes?.recipientsClicked),
    cpwvUsd: centsToUsd(g.outcomes?.cpcCents),
    outreach: numOrNull(g.outcomes?.recipientsContacted),
    // COMMITTED spend, the number the ROI and % CAC on this same row divide by.
    // No fallback onto the billed-only sibling: it is a smaller figure answering a
    // different question, so rendering it here would make the row contradict itself.
    investedUsd: numOrNull(g.costEconomics.committedCostUsd),
  }));
}

/**
 * Column key → the value it sorts on.
 *
 * A column features-service cannot yet answer sorts on null, which the shared
 * comparator sinks to the bottom — the right reading of "we could not measure
 * this", and it never reorders the columns that ARE answered.
 */
export const BRAND_WORKFLOW_SORT_KEYS: Record<
  string,
  (r: BrandWorkflowRow) => number | string | null
> = {
  name: (r) => r.name,
  roi: (r) => r.roiMultiple,
  cacPct: (r) => r.cacPct,
  cacUsd: (r) => r.cacUsd,
  revenue: (r) => r.pipelineUsd,
  positiveReplies: (r) => r.positiveReplies,
  cppr: (r) => r.cpprUsd,
  websiteVisits: (r) => r.websiteVisits,
  cpwv: (r) => r.cpwvUsd,
  outreach: (r) => r.outreach,
  invested: (r) => r.investedUsd,
};
