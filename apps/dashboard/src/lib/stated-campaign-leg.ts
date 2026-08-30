// THE LEG A CAMPAIGN SAYS IT IS BOUGHT FOR, as opposed to one derived from its funnel.
//
// A campaign is (brand x offer x channel x LEG), and campaign-service now carries that
// leg on the row itself: `legKey`, the single canonical identifier features-service
// mints and publishes for every leg of every funnel. Before it existed, the leg had to
// be DERIVED — intersect the campaign's funnel with the arrows its channel can perform
// (`campaignLegFor`) — and that derivation is only correct while a campaign names a
// funnel. It is on its way out: two arrows of different funnels can land on the same
// step, so once the funnel leaves the campaign's identity nothing downstream can tell
// them apart.
//
// So this module is the READ side of that statement, and the derivation stays as the
// fallback for every campaign that predates the column.
//
// ── THE TOKEN IS OPAQUE ───────────────────────────────────────────────────────────
//
// `legKey` is minted by features-service and is a published contract, never a shape to
// take apart. It is readable (`conversation_to_meeting_booked`, `start_to_conversation`)
// precisely so a human can recognise it in a log, and that readability is the trap: a
// consumer that splits it on a separator re-couples itself to a spelling the producer
// owns and is free to change. So this module LOOKS IT UP in what the producer serves
// alongside it, and there is a guard asserting nothing in `src/` parses it.
//
// Alias-free on purpose (every import is type-only and erases at build) so it carries
// REAL unit tests. Keep it that way.

import { campaignLegFor, type CampaignLeg } from "./campaign-leg";
import type { SalesFunnelDef } from "./sales-funnels";

/** The two steps a leg connects, under the producer's own tokens. `fromKey` is null for
 *  a leg that puts a lead ON a funnel — what the producer calls "from nothing". */
export interface FunnelLegSteps {
  fromKey: string | null;
  toKey: string;
}

/** legKey -> the steps it connects. Built from what the producer serves, never minted. */
export type FunnelLegIndex = ReadonlyMap<string, FunnelLegSteps>;

/** One channel as `GET /public/channels` states it, read structurally: every field this
 *  module does not use is left undeclared rather than mirrored, and a row missing the
 *  parts it does use is skipped rather than throwing — the index is a lookup table, and
 *  a channel we cannot read simply contributes no entries to it. */
export interface PublicChannelLegsWire {
  /** The channel's feature slug — a campaign states its channel this way, so it is what
   *  narrows the catalogue to the legs THIS campaign could possibly be bought for. */
  slug?: unknown;
  stepTransitions?: Array<{
    legKey?: unknown;
    from?: { key?: unknown } | null;
    to?: { key?: unknown } | null;
  }> | null;
}

/**
 * Build the lookup from the published catalogue.
 *
 * Every channel states the legs it performs and each leg carries its own key, so the
 * union over channels is every leg the platform can name. A leg appears under several
 * channels (two channels book a meeting from a conversation); they agree by
 * construction, since the key is minted from the steps, so the first wins and the rest
 * are consistent repeats.
 */
export function funnelLegIndexFromWire(
  channels: readonly PublicChannelLegsWire[] | null | undefined,
): FunnelLegIndex {
  const index = new Map<string, FunnelLegSteps>();
  for (const channel of channels ?? []) {
    for (const leg of channel?.stepTransitions ?? []) {
      const legKey = leg?.legKey;
      const toKey = leg?.to?.key;
      if (typeof legKey !== "string" || legKey.length === 0) continue;
      if (typeof toKey !== "string" || toKey.length === 0) continue;
      const rawFrom = leg?.from?.key;
      const fromKey = typeof rawFrom === "string" && rawFrom.length > 0 ? rawFrom : null;
      if (!index.has(legKey)) index.set(legKey, { fromKey, toKey });
    }
  }
  return index;
}

/**
 * The leg a campaign STATES, placed in a funnel — or null when it states none, when the
 * catalogue does not know the key, or when the key names an arrow this funnel does not
 * have.
 *
 * Null is what makes this safe to hand to `CampaignIdentity` unconditionally: its `leg`
 * prop falls through to the derivation on null, so a campaign that states nothing reads
 * exactly as it did before this existed.
 *
 * Placement REUSES `campaignLegFor` rather than re-deriving it. The rules for what
 * counts as a leg OF a funnel — an entry leg only where the funnel begins, an internal
 * leg only between adjacent steps in order — live in one place, so a stated leg and a
 * derived one can never be placed by two different rules.
 */
export function statedCampaignLeg(
  funnel: SalesFunnelDef | null | undefined,
  legKey: string | null | undefined,
  index: FunnelLegIndex | null | undefined,
): CampaignLeg | null {
  if (!funnel || !legKey || !index) return null;
  const steps = index.get(legKey);
  if (!steps) return null;
  return campaignLegFor(funnel, [{ from: steps.fromKey, to: steps.toKey }]);
}

/**
 * The identifier for a leg, looked up by the two steps it connects.
 *
 * The inverse of the index above, and it exists for the WRITE side: a surface creating a
 * campaign knows which arrow it is buying (it resolved it from the funnel it just funded
 * and the channel it is launching on) and has to state that arrow the way the fleet keys
 * it. Minting the token from the two steps would be exactly the coupling this module
 * exists to avoid, so the answer is read out of the same served catalogue.
 */
export function legKeyForSteps(
  index: FunnelLegIndex | null | undefined,
  fromKey: string | null,
  toKey: string,
): string | null {
  if (!index) return null;
  for (const [legKey, steps] of index) {
    if (steps.toKey === toKey && steps.fromKey === fromKey) return legKey;
  }
  return null;
}

/**
 * The leg a campaign launching on this channel, for this funnel, is bought for — stated
 * as the identifier campaign-service and billing key on.
 *
 * Resolved entirely out of `GET /public/channels`: the channel states the legs it
 * performs and each carries its own key, so one payload answers both halves. Placement
 * REUSES `campaignLegFor`, so the leg a launch STATES and the leg every surface later
 * DERIVES for the same campaign are decided by one rule — they cannot disagree.
 *
 * Null when the catalogue is unreadable, when it carries no such channel, or when the
 * channel performs no leg of this funnel. A launch then states no leg and campaign-service
 * treats it exactly as it treats every campaign created before the column existed: null
 * is a legitimate answer here and inventing one would file the campaign under an arrow
 * nobody bought.
 */
export function launchLegKey(
  channels: readonly PublicChannelLegsWire[] | null | undefined,
  featureSlug: string | null | undefined,
  funnel: SalesFunnelDef | null | undefined,
): string | null {
  if (!channels || !featureSlug || !funnel) return null;
  const channel = channels.find((c) => c?.slug === featureSlug);
  if (!channel) return null;

  const index = funnelLegIndexFromWire([channel]);
  const legs = [...index.values()].map((steps) => ({ from: steps.fromKey, to: steps.toKey }));
  const leg = campaignLegFor(funnel, legs);
  if (!leg) return null;
  return legKeyForSteps(index, leg.fromKey, leg.toKey);
}
