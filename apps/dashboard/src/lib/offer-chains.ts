/**
 * How an offer's sales chains read on screen.
 *
 * A chain is the finest scope whose money divides into a RETURN. The product sells a
 * chain one leg at a time, so a campaign buys a single link and the lifetime revenue
 * sits at the end of the chain: asking a campaign what it returned would credit the
 * whole sale to whichever link happened to be last.
 *
 * This module shapes what features-service serves into rows a table renders. It
 * computes no money: every figure below is a served field, and the one derived value
 * is a count of the rows on screen.
 *
 * Alias-free on purpose (its only import is type-only and erased at build), so it
 * carries real unit tests.
 */

import type { OfferChainRow } from "./api";

/**
 * Why a chain has no return, in the producer's own words.
 *
 * The SPEND is real and reported in all three: the customer paid it. What is null is
 * the pipeline, the return and the cost of acquisition, and null is never zero and
 * never the brand-wide record an un-narrowed read legitimately falls back to.
 */
const UNPRICED_REASON_LABEL: Record<string, string> = {
  no_channel_funnel: "No channel carrying this chain measures anything yet",
  no_economics_declared: "This brand states no conversion rates or lifetime revenue",
  chain_not_declared: "This brand does not sell through this chain",
};

export function unpricedChainReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Not priced";
  return UNPRICED_REASON_LABEL[reason] ?? reason;
}

/**
 * Which dollars a cost is made of, said out loud.
 *
 * `platform_spend_only` is the state today and it MATTERS: a chain whose last legs are
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

export type ChainView = {
  funnelKey: string;
  name: string;
  /** The chain's steps in order, so a row renders without knowing the catalogue. */
  steps: string[];
  /** How many campaigns of this offer sell through it. One today, one per leg as the product moves. */
  campaignCount: number;
  /** The channels carrying it, by name where the producer stated one. */
  channelNames: string[];
  priced: boolean;
  unpricedReason: string | null;
  pipelineUsd: number | null;
  /**
   * What this chain has cost ALL IN: what the platform charged plus what the customer
   * recorded for the legs their own team worked. The three ratios below divide by it.
   *
   * The charged half alone is not the customer's answer to "what did this chain cost
   * me" — a chain whose last legs they run themselves would read far cheaper than it
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
  /** True while some leg of this chain has no cost recorded against it. */
  partiallyCosted: boolean;
};

/**
 * One view row per served chain, in the order the producer sent them (its catalogue's
 * canonical order). Nothing is re-sorted here: a chain's place in the catalogue is a
 * fact about the catalogue, and ordering by return would put an unpriced chain
 * somewhere arbitrary.
 */
export function chainViews(chains: OfferChainRow[]): ChainView[] {
  return chains.map((chain) => ({
    funnelKey: chain.funnelKey,
    name: chain.name,
    steps: chain.steps,
    campaignCount: chain.campaignIds.length,
    channelNames: chain.channels.map((c) => c.name ?? c.slug),
    priced: chain.priced,
    unpricedReason: chain.unpricedReason,
    pipelineUsd: chain.headline.totalPipelineUsd,
    // The combined block when the producer sends one, the charged block otherwise.
    // NOT a fallback that mixes them: with nothing declared the producer makes the two
    // identical by construction, so this reads the same figure either way and simply
    // keeps working against a body that predates the block.
    investedUsd:
      chain.combinedCostEconomics?.committedCostUsd ?? chain.costEconomics.committedCostUsd ?? null,
    platformCostUsd:
      chain.combinedCostEconomics?.platformCommittedCostUsd ??
      chain.costEconomics.committedCostUsd ??
      null,
    customerCostUsd: chain.combinedCostEconomics?.customerDeclaredCostUsd ?? null,
    roiMultiple: chain.combinedCostEconomics?.roiMultiple ?? chain.costEconomics.roiMultiple,
    costOfAcquisitionPct:
      chain.combinedCostEconomics?.costOfAcquisitionPct ?? chain.costEconomics.costOfAcquisitionPct,
    costPerAcquisitionUsd:
      chain.combinedCostEconomics?.costPerAcquisitionUsd ??
      chain.costEconomics.costPerAcquisitionUsd ??
      null,
    coverage: chain.costCoverage ?? null,
    partiallyCosted: coverageIsPartial(chain.costCoverage),
  }));
}

/**
 * How many chains are on screen and how many of them could be priced.
 *
 * A count of the rows, not a metric off served fields, so it stays on the right side of
 * "the dashboard renders, it never computes". Worth saying: a table where most rows
 * decline to state a return should say so once rather than leave a reader counting
 * dashes.
 */
export function summariseChains(rows: ChainView[]): { total: number; priced: number } {
  return { total: rows.length, priced: rows.filter((r) => r.priced).length };
}
