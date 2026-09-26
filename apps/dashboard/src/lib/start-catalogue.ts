// WHAT A VISITOR IS BUYING, derived from the catalogue features-service publishes —
// never a local list of our own.
//
// The sell-first onboarding asks ONE question before anyone signs up: which outcome do
// you want. An OUTCOME is a step one of our channels lands a leg on (a positive reply, a
// website visit, a booked meeting). Picking one names the campaigns that reach it — one
// per (leg x channel) — with no second question: the legs are the producer's, read off
// `GET /v1/public/channels`.
//
// Only value imports that carry no "@" alias live here, so this module stays directly
// unit-testable (vitest does not resolve the alias).

import { PROVISIONABLE_CHANNEL_SLUGS } from "./channel-fundable";

/** A step a channel can put a buyer on, in the producer's own words. */
export interface CatalogueStep {
  key: string;
  label: string;
  description: string;
}

/** One leg a channel performs: out of `from` (null = the buyer was on no step at all)
 *  and onto `to`. `legKey` is the fleet's canonical identifier — never parsed. */
export interface CatalogueLeg {
  legKey: string;
  from: CatalogueStep | null;
  to: CatalogueStep;
}

export interface CatalogueChannel {
  slug: string;
  name: string;
  description: string;
  displayOrder: number;
  family: string;
  /** `platform` is us, `customer` is the brand's own team. */
  operatedBy: string;
  terms: {
    dailyOperatingCostCents: number;
    minimumCommitmentDays: number;
    maxDaysToFirstProduction: number;
  };
  stepTransitions: CatalogueLeg[];
}

/** The producer's catalogue, as the screens read it. */
export interface StartCatalogue {
  channels: CatalogueChannel[];
  steps: CatalogueStep[];
}

/**
 * The channel a leg is run through when several perform it: the one we run by default.
 * A fact about OUR operations, not a preference.
 */
export const DEFAULT_CHANNEL_SLUG = "sales-cold-email-outreach";

/** One thing a visitor can ask for. */
export interface StartOutcome {
  /** The step key. Also the identity carried through signup. */
  key: string;
  label: string;
  description: string;
}

/** A channel WE run and can start a campaign on. A customer-operated channel is their
 *  own team's work, not an outcome we deliver. */
function isOurChannel(c: CatalogueChannel): boolean {
  return c.operatedBy === "platform" && PROVISIONABLE_CHANNEL_SLUGS.has(c.slug);
}

/** Our channels, the default one first, then the producer's own order. */
function ourChannels(catalogue: StartCatalogue): CatalogueChannel[] {
  return catalogue.channels
    .filter(isOurChannel)
    .sort(
      (a, b) =>
        Number(b.slug === DEFAULT_CHANNEL_SLUG) - Number(a.slug === DEFAULT_CHANNEL_SLUG) ||
        a.displayOrder - b.displayOrder ||
        a.slug.localeCompare(b.slug),
    );
}

/**
 * The outcomes to offer: every step one of our channels lands a leg on, the deepest
 * first (a booked meeting before the reply that leads to it), in the producer's words.
 */
export function startOutcomes(catalogue: StartCatalogue): StartOutcome[] {
  const byKey = new Map(catalogue.steps.map((s) => [s.key, s]));
  const seen = new Map<string, { outcome: StartOutcome; depth: number }>();
  for (const channel of ourChannels(catalogue)) {
    for (const leg of channel.stepTransitions) {
      if (seen.has(leg.to.key)) continue;
      const step = byKey.get(leg.to.key) ?? leg.to;
      seen.set(leg.to.key, {
        outcome: { key: step.key, label: step.label, description: step.description ?? "" },
        depth: legsTo(leg.to.key, catalogue).length,
      });
    }
  }
  return [...seen.values()].sort((a, b) => b.depth - a.depth).map((e) => e.outcome);
}

/** One (leg x channel) a visitor funds: a campaign. */
export interface StartLegPair {
  /** `<legKey>::<channelSlug>` — the identity the selection carries. */
  key: string;
  legKey: string;
  fromKey: string | null;
  toKey: string;
  fromLabel: string | null;
  toLabel: string;
  channelSlug: string;
  channelName: string;
  /** What a day of this channel costs, as the producer publishes it. */
  dailyOperatingCostCents: number;
}

/** The identity of one pair, as the selection carries it. */
export function startPairKey(legKey: string, channelSlug: string): string {
  return `${legKey}::${channelSlug}`;
}

/** Split a pair key back into its halves. Null for anything that is not one. */
export function parsePairKey(key: string): { legKey: string; channelSlug: string } | null {
  const at = key.indexOf("::");
  if (at <= 0 || at === key.length - 2) return null;
  return { legKey: key.slice(0, at), channelSlug: key.slice(at + 2) };
}

/**
 * The campaigns that REACH an outcome, entry leg first.
 *
 * A leg landing on the outcome, run by one of our channels (the default one first); and
 * when that leg starts from a step, the campaign that produces THAT step, walked back to
 * a leg that starts from nothing. A booked meeting therefore needs the cold email that
 * produces the reply AND the booker that turns the reply into a meeting — one leg alone
 * would be a campaign with nothing to work on. Bounded, so a cycle cannot spin.
 */
export function legsTo(outcomeKey: string, catalogue: StartCatalogue): StartLegPair[] {
  const channels = ourChannels(catalogue);
  const out: StartLegPair[] = [];
  const visited = new Set<string>();
  let target: string | null = outcomeKey;
  while (target && !visited.has(target) && out.length < 8) {
    visited.add(target);
    let found: { channel: CatalogueChannel; leg: CatalogueLeg } | null = null;
    for (const channel of channels) {
      const leg = channel.stepTransitions.find((l) => l.to.key === target);
      if (leg) {
        found = { channel, leg };
        break;
      }
    }
    if (!found) return [];
    out.unshift({
      key: startPairKey(found.leg.legKey, found.channel.slug),
      legKey: found.leg.legKey,
      fromKey: found.leg.from?.key ?? null,
      toKey: found.leg.to.key,
      fromLabel: found.leg.from?.label ?? null,
      toLabel: found.leg.to.label,
      channelSlug: found.channel.slug,
      channelName: found.channel.name,
      dailyOperatingCostCents: found.channel.terms.dailyOperatingCostCents,
    });
    target = found.leg.from?.key ?? null;
  }
  return target === null ? out : [];
}

/** Every campaign the picked outcomes need, deduped, entry legs first. */
export function pairsForOutcomes(outcomeKeys: string[], catalogue: StartCatalogue): StartLegPair[] {
  const byKey = new Map<string, StartLegPair>();
  for (const outcome of outcomeKeys) {
    for (const pair of legsTo(outcome, catalogue)) {
      if (!byKey.has(pair.key)) byKey.set(pair.key, pair);
    }
  }
  return [...byKey.values()];
}
