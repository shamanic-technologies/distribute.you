/**
 * The acquisition model, as the fleet actually declares it.
 *
 * Everything a customer buys is one pair: a SALES FUNNEL (the chain of steps
 * from a first signal to a paid client) bought through an ACQUISITION CHANNEL
 * (where we go to produce that first signal). features-service publishes both
 * halves and the join between them: a channel states the steps it can PRODUCE,
 * a funnel states the step it STARTS on, and the sellable pairs fall out of
 * that. So this module holds NO catalogue of its own — it shapes what the wire
 * says into rows a table can render, and a channel or funnel that ships
 * upstream appears here the same day.
 *
 * Alias-free on purpose (the only import is type-only and erased at build), so
 * this file carries real unit tests rather than source-substring guards.
 */

import type { PublicChannel, PublicChannelFunnelPair, PublicStepTransition } from "./api";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * The families features-service groups channels into. An unknown token is
 * rendered verbatim rather than dropped: a family we have not met yet is a
 * statement about the catalogue, not a gap to hide.
 */
const CHANNEL_FAMILY_LABEL: Record<string, string> = {
  outbound_one_to_one: "Outbound, one to one",
  paid_reach: "Paid reach",
  earned: "Earned",
  conversion: "Conversion",
};

export function channelFamilyLabel(family: string | null | undefined): string {
  if (!family) return "Not stated";
  return CHANNEL_FAMILY_LABEL[family] ?? family;
}

/**
 * Who puts the hours in. A channel the CUSTOMER operates spends none of the platform's money, so
 * its daily operating cost is a stated zero rather than a blank — what such a leg costs THEM is
 * declared per lead, and the catalogue never guesses at it.
 */
const CHANNEL_OPERATOR_LABEL: Record<string, string> = {
  platform: "Us",
  customer: "Their own team",
};

export function channelOperatorLabel(operator: string | null | undefined): string {
  if (!operator) return "Not stated";
  return CHANNEL_OPERATOR_LABEL[operator] ?? operator;
}

/**
 * The leg in words: what a channel moves a lead FROM and TO. `from: null` means the lead was not on
 * the chain at all, which is every entry channel, so it reads as producing the step rather than as
 * converting one.
 */
export function legLabel(transition: PublicStepTransition): string {
  return transition.from === null
    ? `Produces ${transition.to.label}`
    : `${transition.from.label} to ${transition.to.label}`;
}

/**
 * Why a pair carries no measured economics. features-service names the missing
 * INGREDIENT rather than returning an empty figure, so the table states the
 * reason instead of a dash a reader has to interpret.
 */
const UNMEASURED_REASON_LABEL: Record<string, string> = {
  no_spend_recorded: "Nothing spent through this pair yet",
  no_entry_step_produced: "The entry step has never been produced here",
  no_economics_declared: "No brand has declared this funnel's economics",
};

export function unmeasuredReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Not measured";
  return UNMEASURED_REASON_LABEL[reason] ?? reason;
}

/** Why ONE step of an otherwise measured pair carries no price. */
const UNPRICED_STEP_LABEL: Record<string, string> = {
  rate_not_declared: "No brand has declared this leg's conversion rate",
  rate_is_zero: "The declared rate for this leg is zero",
};

export function unpricedStepLabel(reason: string | null | undefined): string {
  if (!reason) return "Not priced";
  return UNPRICED_STEP_LABEL[reason] ?? reason;
}

// ---------------------------------------------------------------------------
// Funnels, derived from the channels that can sell them
// ---------------------------------------------------------------------------

export type FunnelSummary = {
  key: string;
  name: string;
  /** The whole chain, worded as brand-service words it. */
  steps: string[];
  /** The step the chain STARTS on. This is what a channel has to produce. */
  entryStep: string | null;
  /** How many published channels may be sold through it. */
  channelCount: number;
};

/**
 * The funnel catalogue, read off the channels rather than kept here. A funnel
 * nothing can sell has no row, which is the honest reading: a chain with no
 * channel able to produce its entry step is not on sale.
 *
 * Ordered by how many channels can sell it (widest first), then by name, so the
 * table is stable across polls.
 */
export function funnelCatalogueFrom(channels: PublicChannel[]): FunnelSummary[] {
  const byKey = new Map<string, FunnelSummary>();
  for (const channel of channels) {
    for (const funnel of channel.salesFunnels ?? []) {
      const existing = byKey.get(funnel.key);
      if (existing) {
        existing.channelCount += 1;
        continue;
      }
      const steps = funnel.steps ?? [];
      byKey.set(funnel.key, {
        key: funnel.key,
        name: funnel.name,
        steps,
        entryStep: steps[0] ?? null,
        channelCount: 1,
      });
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.channelCount - a.channelCount || a.name.localeCompare(b.name),
  );
}

// ---------------------------------------------------------------------------
// The funnel x channel matrix
// ---------------------------------------------------------------------------

export type StepCost = {
  step: string;
  /** True for the step the funnel is NAMED after. */
  milestone: boolean;
  costPerStepUsd: number | null;
  unpricedReason: string | null;
};

export type MatrixCell =
  /** This channel cannot produce anything this funnel starts on. */
  | { kind: "not_sellable" }
  /** Sellable, and features-service has priced it. */
  | {
      kind: "measured";
      returnPerDollar: number | null;
      costPerSaleUsd: number | null;
      lifetimeRevenueUsd: number | null;
      steps: StepCost[];
    }
  /** Sellable, and features-service says which ingredient is missing. */
  | { kind: "unmeasured"; reason: string }
  /**
   * Sellable, and the economics read carries no row for it. Deliberately its
   * OWN state: reading a missing row as "not sellable" would state something
   * the catalogue contradicts one column over.
   */
  | { kind: "unknown" };

export type MatrixRow = {
  slug: string;
  name: string;
  family: string | null;
  dailyOperatingCostCents: number | null;
  minimumCommitmentDays: number | null;
  maxDaysToFirstProduction: number | null;
  operatedBy: string;
  /** One entry per leg this channel performs, in the catalogue's own order. */
  legLabels: string[];
  /** True when every leg starts from nothing, i.e. the channel only ever opens a chain. */
  entryOnly: boolean;
  sellableFunnelCount: number;
  /** One entry per funnel of the catalogue, in catalogue order. */
  cells: MatrixCell[];
};

function cellFromPair(pair: PublicChannelFunnelPair): MatrixCell {
  const result = pair.result;
  if (result.measured) {
    return {
      kind: "measured",
      returnPerDollar: result.economics.returnPerDollar,
      costPerSaleUsd: result.economics.costPerSaleUsd,
      lifetimeRevenueUsd: result.economics.lifetimeRevenueUsd,
      steps: result.economics.steps.map((step) => ({
        step: step.step,
        milestone: step.milestone,
        costPerStepUsd: step.costPerStepUsd,
        unpricedReason: step.unpricedReason,
      })),
    };
  }
  return { kind: "unmeasured", reason: result.reason };
}

/**
 * One row per published channel, one cell per funnel of the catalogue.
 *
 * A channel keeps its row whatever it can sell — a channel able to sell nothing
 * is a real state of the catalogue and hiding it would make the page disagree
 * with the channel table above it.
 */
export function buildMatrixRows(
  channels: PublicChannel[],
  funnels: FunnelSummary[],
  pairs: PublicChannelFunnelPair[],
): MatrixRow[] {
  const pairByKey = new Map<string, PublicChannelFunnelPair>();
  for (const pair of pairs) pairByKey.set(`${pair.channelSlug}|${pair.funnelKey}`, pair);

  return [...channels]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name))
    .map((channel) => {
      const sellable = new Set((channel.salesFunnels ?? []).map((f) => f.key));
      const cells = funnels.map<MatrixCell>((funnel) => {
        if (!sellable.has(funnel.key)) return { kind: "not_sellable" };
        const pair = pairByKey.get(`${channel.slug}|${funnel.key}`);
        if (!pair) return { kind: "unknown" };
        return cellFromPair(pair);
      });
      return {
        slug: channel.slug,
        name: channel.name,
        family: channel.family ?? null,
        dailyOperatingCostCents: channel.terms?.dailyOperatingCostCents ?? null,
        minimumCommitmentDays: channel.terms?.minimumCommitmentDays ?? null,
        maxDaysToFirstProduction: channel.terms?.maxDaysToFirstProduction ?? null,
        operatedBy: channel.operatedBy,
        legLabels: (channel.stepTransitions ?? []).map(legLabel),
        entryOnly: (channel.stepTransitions ?? []).every((t) => t.from === null),
        sellableFunnelCount: sellable.size,
        cells,
      };
    });
}

export type MatrixSummary = {
  /** Pairs that CAN be sold: every cell that is not `not_sellable`. */
  sellable: number;
  measured: number;
  unmeasured: number;
  unknown: number;
};

/**
 * How many pairs exist and how many we can actually price.
 *
 * A count of the cells on screen, not a metric derived from served figures, so
 * it stays on the right side of "the dashboard renders, it never computes".
 * Worth stating: at 33 channels the matrix is mostly the same grey word, and a
 * reader deserves to know at a glance that the emptiness IS the answer.
 */
export function summariseCells(rows: MatrixRow[]): MatrixSummary {
  const summary: MatrixSummary = { sellable: 0, measured: 0, unmeasured: 0, unknown: 0 };
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.kind === "not_sellable") continue;
      summary.sellable += 1;
      if (cell.kind === "measured") summary.measured += 1;
      else if (cell.kind === "unmeasured") summary.unmeasured += 1;
      else summary.unknown += 1;
    }
  }
  return summary;
}

/** The per-step prices of one pair, or an empty list when it is not measured. */
export function stepCostsForPair(cell: MatrixCell): StepCost[] {
  return cell.kind === "measured" ? cell.steps : [];
}

// ---------------------------------------------------------------------------
// The objects themselves
// ---------------------------------------------------------------------------

export type ModelObject = {
  name: string;
  /** What it is, in one sentence. */
  what: string;
  /** The service that owns it. Asking anywhere else gets you a copy. */
  owner: string;
  /** What identifies one. */
  key: string;
  /** What it hangs off. */
  relatesTo: string;
};

/**
 * Every object the acquisition side of the platform manipulates, and who owns
 * it. Written here rather than read off a wire because no service publishes a
 * map of the fleet; it is documentation, and it is kept short for that reason.
 * Everything BELOW this on the page comes from the wire.
 */
export const MODEL_OBJECTS: ModelObject[] = [
  {
    name: "Organization",
    what: "The customer account. One per company that signs up.",
    owner: "Clerk for the identity, client-service for our own row",
    key: "orgId",
    relatesTo: "Holds every brand, and the credit balance that funds them.",
  },
  {
    name: "Brand",
    what: "The business we are making known. A domain, a name, a profile.",
    owner: "brand-service",
    key: "brandId",
    relatesTo: "Belongs to one organization.",
  },
  {
    name: "Offer",
    what: "One proposition a brand sells. A brand can sell several.",
    owner: "brand-service",
    key: "offerId",
    relatesTo: "Belongs to one brand.",
  },
  {
    name: "Sales funnel",
    what: "The chain of steps from a first signal to a paid client, with a conversion rate on every arrow.",
    owner: "brand-service declares it per brand; features-service publishes the catalogue",
    key: "funnelKey",
    relatesTo: "A brand declares the funnels it sells through, and prices each one.",
  },
  {
    name: "Funnel step",
    what: "One stage of a chain. The step a funnel is named after is its milestone.",
    owner: "brand-service words it, features-service prices it",
    key: "the step's own words",
    relatesTo: "Sits inside one funnel, between two conversion rates.",
  },
  {
    name: "Producible step",
    what: "A kind of first signal a channel knows how to produce. This is what joins a channel to a funnel.",
    owner: "features-service",
    key: "step key",
    relatesTo: "A channel produces some; a funnel starts on one.",
  },
  {
    name: "Acquisition channel",
    what: "Where we go to produce that first signal. A channel IS a feature slug in this fleet.",
    owner: "features-service",
    key: "featureSlug",
    relatesTo: "Sells the funnels whose entry step it can produce.",
  },
  {
    name: "Campaign",
    what: "What actually runs: one offer, sold through one funnel, on one channel.",
    owner: "campaign-service",
    key: "offerId x funnelKey x featureSlug",
    relatesTo: "Belongs to a brand, and is what every lead and every cost is filed under.",
  },
  {
    name: "Daily budget",
    what: "The ceiling a customer sets on what a campaign may spend in a day. Zero means stopped.",
    owner: "billing-service",
    key: "org x brand x funnel x channel x offer",
    relatesTo: "Funds exactly one campaign.",
  },
  {
    name: "Audience",
    what: "The set of people a campaign contacts, and the filters that define it.",
    owner: "human-service",
    key: "audienceId",
    relatesTo: "Belongs to a brand, and increasingly to one offer.",
  },
  {
    name: "Lead",
    what: "One person, and everything that happened to them.",
    owner: "lead-service",
    key: "leadId",
    relatesTo: "Served to a campaign, out of an audience.",
  },
  {
    name: "Workflow",
    what: "The pipeline a campaign executes to produce its next outcome.",
    owner: "workflow-service",
    key: "workflowSlug, grouped into a dynasty",
    relatesTo: "A campaign runs one at a time, and can be switched to another.",
  },
  {
    name: "Run and cost",
    what: "One execution and what it spent. Every displayed cost is summed from this ledger.",
    owner: "runs-service for the ledger, costs-service for the price catalogue",
    key: "runId",
    relatesTo: "Filed under a campaign, and charged to the organization.",
  },
];
