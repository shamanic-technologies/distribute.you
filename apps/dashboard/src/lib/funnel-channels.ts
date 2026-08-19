// Which acquisition channels a sales funnel can be sold through, and what the
// brand has funded each of them at.
//
// A funnel is WHAT happens once a lead lands; a channel is WHERE we went to find
// them. The same funnel can be worked through several channels at once, each
// running its own campaign, so each carries its own daily ceiling and the funnel
// figure is their SUM. billing serves that sum, so nothing here adds one up.
//
// Not every channel can sell every funnel: the feedback-request offer buys a
// CONVERSATION, while the website-led chains start with a click it has no way to
// sell. features-service states that per feature and this module reads it. Do
// NOT hardcode the matrix here, and do not infer it from a funnel's shape.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias).

import {
  ACQUISITION_CHANNELS,
  type AcquisitionChannelDef,
} from "./acquisition-channels";
import {
  SALES_FUNNELS,
  canonicalSalesFunnelKey,
  type SalesFunnelKey,
} from "./sales-funnels";

/**
 * Does a funnel key off the wire name this funnel, under either spelling?
 *
 * The producers are mid-rename, so a stored key arrives in the old vocabulary or
 * the new one and both must match. It compares on the CANONICAL spelling, which
 * both collapse onto, and derives the accepted set from the catalogue itself so
 * a fifth funnel needs no edit here.
 *
 * A key neither spelling covers is simply not this funnel. `normalizeSalesFunnelKey`
 * would be the obvious tool and is the wrong one: it is exhaustive and THROWS on
 * an unknown key, which is right for a write and wrong for a read that must not
 * take a settings page down over a spelling shipped upstream.
 */
function namesFunnel(key: string, funnelKey: SalesFunnelKey): boolean {
  const def = SALES_FUNNELS.find((f) => f.key === funnelKey);
  if (!def) return false;
  return key === def.key || key === canonicalSalesFunnelKey(def.key);
}

/** The fields this module reads off a features-service feature. */
export interface ChannelFeatureRow {
  slug: string;
  salesFunnels?: string[];
}

/**
 * One (funnel, channel, offer) ceiling off billing — the finest grain it serves,
 * and the one a campaign is actually funded at.
 *
 * `offerId` is null on every ceiling stated before billing carried the offer
 * dimension. Such a row is not "for no offer": it is the money of a brand that
 * had exactly one, which is every brand today.
 */
export interface FunnelOfferBudgetRow {
  funnelKey: string;
  featureSlug: string;
  offerId: string | null;
  dailyBudgetCents: number;
}

/** One channel of one funnel, with the ceiling the brand funds it at. */
export interface FunnelChannelBudget {
  channel: AcquisitionChannelDef;
  /** What billing has stored for this pair, in cents. Zero = not funded. */
  savedCents: number;
}

/**
 * The channels this funnel may be sold through, in catalogue order.
 *
 * Read off each feature's own statement, never inferred. A feature whose
 * statement is ABSENT is treated as selling through every funnel: the field
 * shipped additively, and this app reaches prod with no staging buffer, so
 * before features-service lands there the honest reading is the behaviour that
 * came before it (one channel, every funnel) rather than an empty list that
 * would make a brand's own funded funnel unfundable.
 *
 * An EMPTY statement is the opposite: the feature said it sells through none, so
 * it is offered nowhere. The two cases are read apart deliberately.
 */
export function channelsForFunnel(
  funnelKey: SalesFunnelKey,
  features: ChannelFeatureRow[],
  channels: AcquisitionChannelDef[] = ACQUISITION_CHANNELS,
): AcquisitionChannelDef[] {
  return channels.filter((channel) => {
    const feature = features.find((f) => f.slug === channel.featureSlug);
    // A channel whose feature this environment does not serve at all is not
    // offerable: funding it would create a campaign nothing can run.
    if (!feature) return false;
    if (feature.salesFunnels === undefined) return true;
    return feature.salesFunnels.some((key) => namesFunnel(key, funnelKey));
  });
}

/**
 * What the brand funds each of this funnel's channels at.
 *
 * `rows` is billing's per-pair grain. A channel with no row is not funded, which
 * is why an absent row reads as zero rather than as unknown: billing stores a
 * row only once a ceiling has been stated.
 *
 * When billing serves NO per-pair rows at all (an older deploy, before the
 * split), the funnel's whole ceiling is attributed to its FIRST offerable
 * channel, which is what that ceiling has always meant: one channel per funnel.
 * Spreading it across the offerable set instead would invent a split the brand
 * never made.
 *
 * `offerRows` + `offerId` narrow each pair to ONE offer's own ceiling, which is
 * what the card edits: two offers selling the same funnel on the same channel
 * are two campaigns funded separately, and the pair figure is their sum, so
 * showing it under one offer's name would offer to spend the sibling's money.
 * The narrowing is deliberately conservative, and every branch of it lands on
 * today's pair figure for a brand with one offer:
 *
 *   - no offer grain served, or no caller offer → the pair figure, unchanged;
 *   - a row for THIS offer → that row;
 *   - no row for this offer but exactly one for the pair carrying NO offer →
 *     that row, because a ceiling stated before the dimension existed is the
 *     money of the brand's only offer (and equals the pair figure anyway);
 *   - otherwise the pair is funded, for other offers → zero for this one.
 */
export function funnelChannelBudgets(
  funnelKey: SalesFunnelKey,
  offerable: AcquisitionChannelDef[],
  rows: { funnelKey: string; featureSlug: string; dailyBudgetCents: number }[] | undefined,
  funnelTotalCents: number,
  offerRows?: FunnelOfferBudgetRow[],
  offerId?: string,
): FunnelChannelBudget[] {
  if (rows === undefined) {
    return offerable.map((channel, i) => ({
      channel,
      savedCents: i === 0 ? funnelTotalCents : 0,
    }));
  }
  const byChannel = new Map(
    rows
      .filter((r) => namesFunnel(r.funnelKey, funnelKey))
      .map((r) => [r.featureSlug, r.dailyBudgetCents]),
  );
  const mine =
    offerRows === undefined || offerId === undefined
      ? undefined
      : offerRows.filter((r) => namesFunnel(r.funnelKey, funnelKey));
  return offerable.map((channel) => {
    const pairCents = byChannel.get(channel.featureSlug) ?? 0;
    if (mine === undefined) return { channel, savedCents: pairCents };
    const pairRows = mine.filter((r) => r.featureSlug === channel.featureSlug);
    if (pairRows.length === 0) return { channel, savedCents: pairCents };
    const exact = pairRows.find((r) => r.offerId === offerId);
    if (exact) return { channel, savedCents: exact.dailyBudgetCents };
    if (pairRows.length === 1 && pairRows[0].offerId === null) {
      return { channel, savedCents: pairRows[0].dailyBudgetCents };
    }
    return { channel, savedCents: 0 };
  });
}

/**
 * The whole-dollar total a funnel is being funded at, across its channels.
 *
 * This is the number the product minimum binds, because a customer splitting one
 * funded funnel across two offers must not be refused for each half being under
 * a floor the whole clears. It is computed here ONLY to check a form before it
 * is written and to say what a save will add up to; the figure the card DISPLAYS
 * for a funnel is the one billing serves.
 */
export function typedFunnelTotalUsd(usdByChannel: Record<string, number>): number {
  return Object.values(usdByChannel).reduce((sum, usd) => sum + (usd > 0 ? usd : 0), 0);
}
