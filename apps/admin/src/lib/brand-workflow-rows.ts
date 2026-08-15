/**
 * The brand Workflows scorecard's row model: one row per workflow the brand has
 * run, with THIS brand's realized money on the left and the cross-brand
 * benchmark for the same workflow on the right.
 *
 * The two halves answer different questions on purpose — "what did this workflow
 * return for me" versus "what does it return across the fleet" — so they are
 * labelled apart and never summed together. Every figure on both sides is a
 * field features-service served; this module joins and orders, it does not
 * compute.
 *
 * Alias-free (type-only imports) so it carries real unit tests.
 */
import type { FeatureRevenueByWorkflowGroup } from "./api";
import type { WorkflowPerfRow } from "./feature-stats-workflow-rows";

export type BrandWorkflowRow = {
  slug: string;
  name: string;
  /** THIS brand, realized. Null where features-service could not measure it. */
  brand: {
    roiMultiple: number | null;
    cacPct: number | null;
    cacUsd: number | null;
    pipelineUsd: number | null;
  };
  /** The same workflow across every brand — the benchmark, not this brand's. */
  fleet: WorkflowPerfRow | null;
};

function numOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The workflow key a brand group is filed under.
 *
 * The producer owns how it identifies a workflow, so both spellings are read and
 * the dynasty is preferred — that is what the cross-org rows key on. A group
 * carrying neither is unfileable and is dropped rather than rendered under a
 * fabricated name.
 */
export function brandGroupKey(group: FeatureRevenueByWorkflowGroup): string | null {
  return group.workflowDynastySlug ?? group.workflowSlug ?? null;
}

/**
 * Join the brand's per-workflow money to the cross-brand benchmark.
 *
 * Rows are the UNION: a workflow the brand ran but the fleet read has nothing
 * for still shows its own money, and a fleet workflow this brand never ran still
 * shows the benchmark, each with `—` on the other side. Dropping either would
 * hide a workflow that exists.
 */
export function buildBrandWorkflowRows(
  brandGroups: FeatureRevenueByWorkflowGroup[],
  fleetRows: WorkflowPerfRow[],
): BrandWorkflowRow[] {
  const byFleet = new Map(fleetRows.map((r) => [r.slug, r]));
  const byBrand = new Map<string, FeatureRevenueByWorkflowGroup>();
  for (const g of brandGroups) {
    const key = brandGroupKey(g);
    if (key) byBrand.set(key, g);
  }

  const slugs = [...new Set([...byBrand.keys(), ...byFleet.keys()])];

  return slugs.map((slug) => {
    const g = byBrand.get(slug);
    const fleet = byFleet.get(slug) ?? null;
    return {
      slug,
      name: g?.workflowDynastyName ?? g?.workflowName ?? fleet?.name ?? slug,
      brand: {
        roiMultiple: numOrNull(g?.costEconomics.roiMultiple),
        cacPct: numOrNull(g?.costEconomics.costOfAcquisitionPct),
        cacUsd: numOrNull(g?.costEconomics.costPerAcquisitionUsd),
        pipelineUsd: numOrNull(g?.headline.totalPipelineUsd),
      },
      fleet,
    };
  });
}

/**
 * Column key → the value it sorts on.
 *
 * A row the brand has never run sorts by a null on every brand column, so those
 * sink to the bottom under the shared comparator — which is the right reading of
 * "rank this brand's workflows".
 */
export const BRAND_WORKFLOW_SORT_KEYS: Record<
  string,
  (r: BrandWorkflowRow) => number | string | null
> = {
  name: (r) => r.name,
  roi: (r) => r.brand.roiMultiple,
  cacPct: (r) => r.brand.cacPct,
  cacUsd: (r) => r.brand.cacUsd,
  revenue: (r) => r.brand.pipelineUsd,
  positiveReplies: (r) => r.fleet?.positiveReplies ?? null,
  cppr: (r) => r.fleet?.cpprUsd ?? null,
  websiteVisits: (r) => r.fleet?.websiteVisits ?? null,
  cpwv: (r) => r.fleet?.cpwvUsd ?? null,
  outreach: (r) => r.fleet?.outreach ?? null,
  invested: (r) => r.fleet?.investedUsd ?? null,
};
