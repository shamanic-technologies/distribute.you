/**
 * How an offer's sales funnels read on screen.
 *
 * A sales funnel is the finest scope whose money divides into a RETURN. The product
 * sells a funnel one leg at a time, so a campaign buys a single link and the lifetime
 * revenue sits at the end: asking a campaign what it returned would credit the whole
 * sale to whichever link happened to be last.
 *
 * This module shapes what features-service serves into rows a table renders. It
 * computes no money: every figure below is a served field, and the one derived value
 * is a count of the rows on screen.
 *
 * Alias-free on purpose (its only import is type-only and erased at build), so it
 * carries real unit tests.
 */

import type { OfferFunnelRow } from "./api";

/**
 * Why a funnel has no return, in the producer's own words.
 *
 * The SPEND is real and reported in all three: the customer paid it. What is null is
 * the pipeline, the return and the cost of acquisition, and null is never zero and
 * never the brand-wide record an un-narrowed read legitimately falls back to.
 */
const UNPRICED_REASON_LABEL: Record<string, string> = {
  no_channel_funnel: "No channel carrying this funnel measures anything yet",
  no_economics_declared: "This brand states no conversion rates or lifetime revenue",
  funnel_not_declared: "This brand does not sell through this funnel",
};

export function unpricedFunnelReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Not priced";
  return UNPRICED_REASON_LABEL[reason] ?? reason;
}

/**
 * Which dollars a cost is made of, said out loud.
 *
 * `platform_spend_only` is the state today and it MATTERS: a funnel whose last legs are
 * worked by the customer's own team reads cheaper here than it truly is, because what
 * those legs cost THEM is declared per lead and is not folded in yet. Stating it is the
 * alternative to presenting an optimistic return as the whole answer.
 */
const COST_COVERAGE_NOTE: Record<string, string> = {
  platform_spend_only:
    "These costs are what the platform spent. Nobody has recorded what a step your own team worked cost you, so a funnel you finish yourself reads cheaper here than it really is.",
  platform_and_partial_customer_spend:
    "Some steps your own team worked have no cost recorded against them, so what these funnels cost you is a floor rather than the whole figure.",
  platform_and_customer_spend:
    "These costs are what the platform spent plus what you recorded for the steps your own team worked.",
};

export function costCoverageNote(coverage: string | null | undefined): string | null {
  if (!coverage) return null;
  return COST_COVERAGE_NOTE[coverage] ?? null;
}

/** True while some leg of this scope has no cost recorded against it. */
export function coverageIsPartial(coverage: string | null | undefined): boolean {
  return coverage === "platform_and_partial_customer_spend";
}

export type FunnelView = {
  funnelKey: string;
  name: string;
  /** The funnel's steps in order, so a row renders without knowing the catalogue. */
  steps: string[];
  /** How many campaigns of this offer sell through it. One today, one per leg as the product moves. */
  campaignCount: number;
    /**
   * The feature slugs of the channels carrying this funnel. SLUGS, not names: a
   * channel's name is resolved from the catalogue this app already fetches, which is
   * where every other surface reads it. Asking the producer for a second copy of the
   * name is how the two come to disagree about one channel.
   */
  channelSlugs: string[];
  priced: boolean;
  unpricedReason: string | null;
  pipelineUsd: number | null;
  /**
   * What this funnel has cost ALL IN: what the platform charged plus what the customer
   * recorded for the legs their own team worked. The three ratios below divide by it.
   *
   * The charged half alone is not the customer's answer to "what did this funnel cost
   * me" — a funnel whose last legs they run themselves would read far cheaper than it
   * is. The split is carried beside it so either half is readable without inferring
   * one from the other.
   */
  investedUsd: number | null;
  platformCostUsd: number | null;
  customerCostUsd: number | null;
  roiMultiple: number | null;
  costOfAcquisitionPct: number | null;
  costPerAcquisitionUsd: number | null;
  /** Which dollars this row's figures are made of. */
  coverage: string | null;
  /** True while some leg of this funnel has no cost recorded against it. */
  partiallyCosted: boolean;
};

/**
 * One view row per served funnel, in the order the producer sent them (its catalogue's
 * canonical order). Nothing is re-sorted here: a funnel's place in the catalogue is a
 * fact about the catalogue, and ordering by return would put an unpriced funnel
 * somewhere arbitrary.
 */
export function funnelViews(funnels: OfferFunnelRow[]): FunnelView[] {
  return funnels.map((funnel) => ({
    funnelKey: funnel.funnelKey,
    name: funnel.name,
    steps: funnel.steps,
    campaignCount: funnel.campaignIds.length,
    channelSlugs: funnel.channels.map((c) => c.featureSlug),
    priced: funnel.priced,
    unpricedReason: funnel.unpricedReason,
    pipelineUsd: funnel.headline.totalPipelineUsd,
    // The combined block when the producer sends one, the charged block otherwise.
    // NOT a fallback that mixes them: with nothing declared the producer makes the two
    // identical by construction, so this reads the same figure either way and simply
    // keeps working against a body that predates the block.
    investedUsd:
      funnel.combinedCostEconomics?.committedCostUsd ??
      funnel.costEconomics.committedCostUsd ??
      null,
    platformCostUsd:
      funnel.combinedCostEconomics?.platformCommittedCostUsd ??
      funnel.costEconomics.committedCostUsd ??
      null,
    customerCostUsd: funnel.combinedCostEconomics?.customerDeclaredCostUsd ?? null,
    roiMultiple: funnel.combinedCostEconomics?.roiMultiple ?? funnel.costEconomics.roiMultiple,
    costOfAcquisitionPct:
      funnel.combinedCostEconomics?.costOfAcquisitionPct ??
      funnel.costEconomics.costOfAcquisitionPct,
    costPerAcquisitionUsd:
      funnel.combinedCostEconomics?.costPerAcquisitionUsd ??
      funnel.costEconomics.costPerAcquisitionUsd ??
      null,
    coverage: funnel.costCoverage ?? null,
    partiallyCosted: coverageIsPartial(funnel.costCoverage),
  }));
}

/**
 * How many funnels are on screen and how many of them could be priced.
 *
 * A count of the rows, not a metric off served fields, so it stays on the right side of
 * "the dashboard renders, it never computes". Worth saying: a table where most rows
 * decline to state a return should say so once rather than leave a reader counting
 * dashes.
 */
export function summariseFunnels(rows: FunnelView[]): { total: number; priced: number } {
  return { total: rows.length, priced: rows.filter((r) => r.priced).length };
}
