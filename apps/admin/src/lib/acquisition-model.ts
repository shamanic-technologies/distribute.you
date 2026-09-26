/**
 * The acquisition model, as the fleet actually declares it.
 *
 * Everything a customer buys is an OUTCOME (a step a lead reaches: a positive reply, a
 * website visit, a paid client), reached through LEGS (one step to the next), each
 * performed by an ACQUISITION CHANNEL. features-service publishes the channels, the legs
 * they perform and the projected price of every outcome their legs reach, so this module
 * holds NO catalogue of its own: it shapes what the wire says into rows a table can
 * render, and a channel or a leg that ships upstream appears here the same day.
 *
 * Alias-free on purpose (the only import is type-only and erased at build), so
 * this file carries real unit tests rather than source-substring guards.
 */

import type {
  PublicChannel,
  PublicChannelOutcomeEconomicsEntry,
  PublicChannelStep,
  PublicStepTransition,
} from "./api";

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
 * The leg in words: what a channel moves a lead FROM and TO. `from: null` means the lead was on no
 * step at all, which is every entry channel, so it reads as producing the step rather than as
 * converting one.
 */
export function legLabel(transition: PublicStepTransition): string {
  return transition.from === null
    ? `Produces ${transition.to.label}`
    : `${transition.from.label} to ${transition.to.label}`;
}

/**
 * Why an outcome carries no price. features-service names the missing INGREDIENT
 * rather than returning an empty figure, so the table states the reason instead
 * of a dash a reader has to interpret. An unknown token is rendered verbatim.
 */
const UNPRICED_REASON_LABEL: Record<string, string> = {
  no_spend_recorded: "Nothing spent through this channel yet",
  no_entry_step_produced: "The first step has never been produced here",
  no_economics_declared: "No brand has declared the economics this outcome is priced on",
  rate_not_declared: "No brand has declared a conversion rate on the way to it",
  rate_is_zero: "A declared rate on the way to it is zero",
};

export function unpricedReasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Not priced";
  return UNPRICED_REASON_LABEL[reason] ?? reason;
}

// ---------------------------------------------------------------------------
// Legs, read off the channels that perform them
// ---------------------------------------------------------------------------

export type LegSummary = {
  key: string;
  /** The leg in words, `legLabel`'s reading. */
  label: string;
  /** True for a leg that starts from nothing: it opens a lead's path. */
  entry: boolean;
  /** How many published channels perform it. */
  channelCount: number;
};

/**
 * The leg catalogue, read off the channels rather than kept here. A leg no
 * channel performs has no row: nothing can buy it.
 *
 * Ordered entry legs first, then by how many channels perform it (widest first),
 * then by words, so the list is stable across polls.
 */
export function legCatalogueFrom(channels: PublicChannel[]): LegSummary[] {
  const byKey = new Map<string, LegSummary>();
  for (const channel of channels) {
    const seen = new Set<string>();
    for (const transition of channel.stepTransitions ?? []) {
      const key = transition.legKey ?? `${transition.from?.key ?? "start"}_to_${transition.to.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = byKey.get(key);
      if (existing) {
        existing.channelCount += 1;
        continue;
      }
      byKey.set(key, {
        key,
        label: legLabel(transition),
        entry: transition.from === null,
        channelCount: 1,
      });
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      Number(b.entry) - Number(a.entry) ||
      b.channelCount - a.channelCount ||
      a.label.localeCompare(b.label),
  );
}

// ---------------------------------------------------------------------------
// The outcome x channel matrix
// ---------------------------------------------------------------------------

export type MatrixCell =
  /** No leg this channel's paths walk lands on this outcome. */
  | { kind: "not_reached" }
  /** Reached, and features-service has priced it (PROJECTED, cheapest path). */
  | { kind: "priced"; costPerOutcomeUsd: number; landedByChannel: boolean }
  /** Reached, and features-service says which ingredient is missing. */
  | { kind: "unpriced"; reason: string | null; landedByChannel: boolean }
  /**
   * The economics read carries no entry for this channel at all. Deliberately
   * its OWN state: reading a missing entry as "not reached" would state
   * something the channel table one band up contradicts.
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
  /** True when every leg starts from nothing, i.e. the channel only ever opens a path. */
  entryOnly: boolean;
  /** How many outcomes its paths reach, as served. Null when the economics read has no entry. */
  reachedOutcomeCount: number | null;
  /** PROJECTED return per dollar on the channel's best-returning path, verbatim. */
  bestReturnPerDollar: number | null;
  /** One entry per step of the catalogue, in catalogue order. */
  cells: MatrixCell[];
};

/**
 * One row per published channel, one cell per step of the catalogue.
 *
 * A channel keeps its row whatever it reaches: a channel able to reach nothing
 * is a real state of the catalogue, and hiding it would make the page disagree
 * with the channel table above it.
 */
export function buildMatrixRows(
  channels: PublicChannel[],
  steps: PublicChannelStep[],
  economics: PublicChannelOutcomeEconomicsEntry[],
): MatrixRow[] {
  const bySlug = new Map<string, PublicChannelOutcomeEconomicsEntry>();
  for (const entry of economics) bySlug.set(entry.channelSlug, entry);

  return [...channels]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name))
    .map((channel) => {
      const entry = bySlug.get(channel.slug);
      const byStep = new Map((entry?.outcomes ?? []).map((o) => [o.step.key, o]));
      const cells = steps.map<MatrixCell>((step) => {
        if (!entry) return { kind: "unknown" };
        const outcome = byStep.get(step.key);
        if (!outcome) return { kind: "not_reached" };
        return typeof outcome.costPerOutcomeUsd === "number"
          ? {
              kind: "priced",
              costPerOutcomeUsd: outcome.costPerOutcomeUsd,
              landedByChannel: outcome.landedByChannel,
            }
          : {
              kind: "unpriced",
              reason: outcome.unpricedReason,
              landedByChannel: outcome.landedByChannel,
            };
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
        reachedOutcomeCount: entry ? entry.outcomes.length : null,
        bestReturnPerDollar: entry?.returnPerDollar ?? null,
        cells,
      };
    });
}

export type MatrixSummary = {
  /** Outcomes some channel reaches: every cell that is not `not_reached` or `unknown`. */
  reached: number;
  priced: number;
  unpriced: number;
  unknown: number;
};

/**
 * How many (channel, outcome) cells exist and how many we can actually price.
 *
 * A count of the cells on screen, not a metric derived from served figures, so
 * it stays on the right side of "the dashboard renders, it never computes".
 */
export function summariseCells(rows: MatrixRow[]): MatrixSummary {
  const summary: MatrixSummary = { reached: 0, priced: 0, unpriced: 0, unknown: 0 };
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.kind === "not_reached") continue;
      if (cell.kind === "unknown") {
        summary.unknown += 1;
        continue;
      }
      summary.reached += 1;
      if (cell.kind === "priced") summary.priced += 1;
      else summary.unpriced += 1;
    }
  }
  return summary;
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
    name: "Step",
    what: "One stage a lead can reach: a positive reply, a website visit, a booked meeting, a paid client.",
    owner: "features-service publishes the vocabulary",
    key: "step key",
    relatesTo: "An outcome is the step a customer buys.",
  },
  {
    name: "Leg",
    what: "One move from a step to the next, or from nothing to a first step. This is what joins a channel to an outcome.",
    owner: "features-service",
    key: "legKey",
    relatesTo: "A channel performs some; a brand states a conversion rate on each.",
  },
  {
    name: "Acquisition channel",
    what: "Where we go to produce that first signal. A channel IS a feature slug in this fleet.",
    owner: "features-service",
    key: "featureSlug",
    relatesTo: "Performs legs, and so reaches the outcomes those legs land on.",
  },
  {
    name: "Campaign",
    what: "What actually runs: one offer, bought for one leg, on one channel.",
    owner: "campaign-service",
    key: "offerId x legKey x featureSlug",
    relatesTo: "Belongs to a brand, and is what every lead and every cost is filed under.",
  },
  {
    name: "Daily budget",
    what: "The ceiling a customer sets on what a campaign may spend in a day. Zero means stopped.",
    owner: "billing-service",
    key: "org x brand x offer x leg x channel",
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
