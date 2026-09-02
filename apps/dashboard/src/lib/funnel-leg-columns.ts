// A funnel laid out as its own ARROWS, with every channel that can perform each one.
//
// The campaigns table walks the same arrows one per ROW and shows, beside each, whoever
// performs it TODAY. That answers "how is this funnel doing"; it cannot answer "what
// else could work this arrow", because a channel nobody has funded has no campaign and
// so no row. This module answers the second question: one column per arrow, and under
// it every channel the catalogue says performs that arrow — funded or not.
//
// The distinction matters for exactly the case that motivated it. A brand that wants
// its interested replies answered automatically has to be able to SEE that channel
// before it can fund it, and until it is funded there is nothing about it anywhere.
//
// Only relative value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

import type { CampaignLeg } from "./campaign-leg";
import type { AcquisitionChannelDef } from "./acquisition-channels";
import { channelIsFundable } from "./funnel-channels";

/**
 * The channels that perform THIS arrow and that funding actually turns on.
 *
 * Matched on BOTH steps, never on the destination alone: two channels routinely reach
 * the same step from different places (a meeting booked out of a reply is not a meeting
 * booked off the website), and a column keyed on the destination would offer a channel
 * that cannot serve the funnel a reader is looking at.
 *
 * `channelIsFundable` is the same gate Offer Settings applies, for the same reason: a
 * card nobody can switch on is a control that lies about what it does. It answers the
 * customer-operated half off the WIRE and the platform half off this app's mirror of
 * what campaign-service provisions, so a channel published upstream with no workflow
 * behind it is absent here rather than present-and-dead.
 *
 * Catalogue order is preserved, which is features-service's own `displayOrder`.
 */
export function channelsForLeg(
  leg: Pick<CampaignLeg, "fromKey" | "toKey">,
  channels: readonly AcquisitionChannelDef[],
): AcquisitionChannelDef[] {
  return channels.filter((channel) => {
    if (!channelIsFundable(channel)) return false;
    return channel.legs.some((l) => l.from === leg.fromKey && l.to === leg.toKey);
  });
}

/** One channel offered under one arrow, with what the brand funds it at. */
export interface LegChannelCard {
  channel: AcquisitionChannelDef;
  /**
   * The ceiling billing holds for this (funnel, channel, offer), in cents.
   *
   * Taken from a map the CALLER resolved through `funnelChannelBudgets`, which already
   * owns the offer-scoped narrowing that Offer Settings and Campaign Settings both read.
   * Re-deriving it here would be a second copy of that rule and the way two surfaces
   * come to state different money for one channel.
   */
  savedCents: number;
  /**
   * Whether the brand funds it at all. Zero is not a missing figure — it is how a
   * channel is turned off, and billing stores the row either way.
   */
  funded: boolean;
}

/** One arrow of the funnel, and everything that can work it. */
export interface LegColumn {
  leg: CampaignLeg;
  cards: LegChannelCard[];
}

/**
 * The funnel as columns, in its own step order.
 *
 * EVERY arrow gets a column, including one nothing can be funded on today. Dropping it
 * would tell a customer their funnel is shorter than it is — the same reason the table
 * this replaces gives a row to the arrows the brand works itself. A column with no
 * cards states why rather than disappearing.
 */
export function buildLegColumns({
  legs,
  channels,
  savedCentsBySlug,
}: {
  legs: readonly CampaignLeg[];
  channels: readonly AcquisitionChannelDef[];
  savedCentsBySlug: Record<string, number>;
}): LegColumn[] {
  return legs.map((leg) => ({
    leg,
    cards: channelsForLeg(leg, channels).map((channel) => {
      const savedCents = savedCentsBySlug[channel.featureSlug] ?? 0;
      return { channel, savedCents, funded: savedCents > 0 };
    }),
  }));
}
