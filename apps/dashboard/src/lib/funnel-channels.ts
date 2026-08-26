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
  acquisitionChannelsFromFeatures,
  type AcquisitionChannelDef,
  type ChannelSource,
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

/**
 * The fields this module reads off a features-service feature.
 *
 * The same shape the channel catalogue builds a channel from, because they read
 * the same rows: WHICH channels exist and WHICH funnels each sells are one
 * statement by the producer, and splitting it into two shapes here is how the
 * two readings would drift.
 */
export type ChannelFeatureRow = ChannelSource;

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
/**
 * The channels a customer may FUND today.
 *
 * A MIRROR of the set campaign-service will provision a campaign for, and it is
 * deliberately narrower than the catalogue. features-service publishes 33
 * channels and marks every one of them bookable, which is a statement about what
 * the agency SELLS; campaign-service provisions a campaign for a closed set of
 * them, which is a statement about what currently RUNS. Offering to fund one
 * outside that set takes a customer's ceiling and produces no campaign at all:
 * nothing errors, nothing is charged, and the channel simply never does
 * anything, which is worse than not offering it.
 *
 * This is NOT the hand-written catalogue this module used to filter. That one
 * decided which channels EXIST, so it went stale the moment the producer
 * published a new one and hid it from every surface. This decides only which are
 * FUNDABLE: a channel outside it still resolves, still carries its name and its
 * mark, and still names a campaign that already runs on it. The two questions
 * were conflated before, which is why one stale list could do so much damage.
 *
 * It is a mirror, so it is temporary by construction: the day campaign-service
 * states which features it can provision, this reads that instead and the list
 * goes. Until then, adding a slug here without adding it there offers a dead
 * channel, and adding it there without adding it here hides a live one.
 *
 * GOOGLE ADS IS DELIBERATELY ABSENT, and the reason is one hop further out than
 * this mirror can see. Everything a Google Ads campaign needs to be created now
 * exists: google-service wraps the Ads API and declares the spend as the org's
 * cost, features-service publishes the channel, billing states its floor, and
 * campaign-service provisions and schedules the campaign. What does not exist is
 * a WORKFLOW for it, and prod holds 553 for cold email against zero here. So a
 * customer funding it would get a campaign that is provisioned, scheduled, and
 * then produces nothing forever, which is the precise failure this whole gate
 * exists to prevent: being able to provision a campaign is not being able to RUN
 * one. Add the slug when a workflow answers for it, not before.
 */
export const PROVISIONABLE_CHANNEL_SLUGS: ReadonlySet<string> = new Set([
  "sales-cold-email-outreach",
  "sales-crm-email-outreach",
  "feedback-request-cold-email-outreach",
]);

export function channelsForFunnel(
  funnelKey: SalesFunnelKey,
  features: ChannelFeatureRow[],
): AcquisitionChannelDef[] {
  return acquisitionChannelsFromFeatures(features).filter((channel) => {
    // Funding one nothing provisions states a ceiling and produces no campaign.
    if (!PROVISIONABLE_CHANNEL_SLUGS.has(channel.featureSlug)) return false;
    const feature = features.find((f) => f.slug === channel.featureSlug);
    // Unreachable by construction, since every channel here was built from one
    // of these rows. Kept so the read below narrows without an assertion.
    if (!feature) return false;
    if (feature.salesFunnels === undefined) return true;
    return feature.salesFunnels.some((key) => namesFunnel(key, funnelKey));
  });
}

/**
 * ONE campaign's own ceiling: what the brand funds (funnel, channel, offer) at.
 *
 * This is the narrowing, and it lives here alone because two surfaces read it —
 * Offer Settings edits every channel of a funnel, Campaign Settings edits the one
 * channel its campaign runs, and a second copy is how they would start disagreeing
 * about the same campaign's money.
 *
 * `pairCents` is billing's per-pair figure, which spans every offer selling that
 * pair. The narrowing is deliberately conservative, and every branch of it lands
 * on that figure for a brand with one offer:
 *
 *   - no offer grain served, or no caller offer → the pair figure, unchanged;
 *   - a row for THIS offer → that row;
 *   - no row for this offer but exactly one for the pair carrying NO offer →
 *     that row, because a ceiling stated before the dimension existed is the
 *     money of the brand's only offer (and equals the pair figure anyway);
 *   - otherwise the pair is funded, for other offers → zero for this one.
 */
export function offerScopedCents(
  funnelKey: SalesFunnelKey,
  featureSlug: string,
  pairCents: number,
  offerRows: FunnelOfferBudgetRow[] | undefined,
  offerId: string | undefined,
): number {
  if (offerRows === undefined || offerId === undefined) return pairCents;
  const pairRows = offerRows.filter(
    (r) => namesFunnel(r.funnelKey, funnelKey) && r.featureSlug === featureSlug,
  );
  if (pairRows.length === 0) return pairCents;
  const exact = pairRows.find((r) => r.offerId === offerId);
  if (exact) return exact.dailyBudgetCents;
  if (pairRows.length === 1 && pairRows[0].offerId === null) {
    return pairRows[0].dailyBudgetCents;
  }
  return 0;
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
 * `offerScopedCents` above holds that narrowing, so Campaign Settings reads the
 * very same rule for the one channel it edits.
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
  return offerable.map((channel) => ({
    channel,
    savedCents: offerScopedCents(
      funnelKey,
      channel.featureSlug,
      byChannel.get(channel.featureSlug) ?? 0,
      offerRows,
      offerId,
    ),
  }));
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

/**
 * What THIS OFFER funds a funnel at, across its channels, in cents.
 *
 * The figure billing serves for a funnel spans every offer selling it, so on a
 * page scoped to one offer it names money the reader cannot see and cannot edit:
 * a card would state a ceiling above fields that add up to less, and both would
 * be correct. This adds up the offer-scoped per-channel figures the card already
 * holds — the ones `funnelChannelBudgets` narrowed — so the tag and the fields
 * under it can only ever say the same thing.
 *
 * The funnel-wide figure is still the right one for the product MINIMUM, which
 * binds what the funnel sums to across offers; that is billing's rule and it is
 * unchanged here.
 */
export function offerFunnelTotalCents(savedCentsByChannel: Record<string, number>): number {
  return Object.values(savedCentsByChannel).reduce(
    (sum, cents) => sum + (cents > 0 ? cents : 0),
    0,
  );
}
