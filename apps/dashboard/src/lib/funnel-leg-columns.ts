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
import { channelRunState } from "./channel-start";

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
  /** What the channel is actually DOING. See `LegChannelState`. */
  state: LegChannelState;
}

/**
 * What a channel card says about itself.
 *
 * Money and STATUS are two independent facts about one channel — billing holds the
 * ceiling, campaign-service holds the word — so a card derived from the ceiling alone
 * says `Running` about a campaign that has been stopped for weeks, while the modal it
 * opens shows that channel's toggle OFF. Two facts that cannot both be true of one
 * channel on one screen is a bug, not a wording preference.
 *
 * `not_funded` is a real state and must survive: a channel nobody has bought is
 * not "paused", and telling a customer it is invites them to look for a switch that
 * was never flipped.
 *
 * `not_started` is the SAME argument one step along, and it is the state money used
 * to hide. A channel the brand funds and nobody has launched is neither running nor
 * paused: campaign-service has stopped provisioning a campaign for a funded pair
 * (2026-09-06, "money starts nothing"), so it has no campaign and never will until a
 * person starts it on Offer Settings. It read `running` here for as long as the
 * ceiling stood in for the verdict.
 *
 * `unknown` is the honest reading while the campaigns read is still in flight. Falling
 * back to `running` there would be a guess dressed as a verdict.
 */
export type LegChannelState = "running" | "paused" | "not_started" | "not_funded" | "unknown";

/**
 * The card's verdict, from the SAME running answer the controls modal writes through.
 *
 * `running` and `hasCampaign` are both `buildControlRows`' own words, not a second copy
 * of the rule — it already resolves, per (funnel, channel, offer): at least one member
 * campaign reporting a running status, and whether the channel has a campaign at all.
 * Re-deriving either here is how the two surfaces drift again within a release, which
 * is exactly what happened while this file read the CEILING as the verdict.
 *
 * `channelRunState` is shared with Offer Settings' own per-channel switch, so a channel
 * cannot read one word on the board and another on the card that starts it.
 *
 * The ceiling is read for ONE thing: separating a channel nobody has bought from one
 * that is bought and unstarted. It never decides whether something runs.
 */
export function legChannelState({
  savedCents,
  running,
  hasCampaign,
}: {
  savedCents: number;
  /** The resolver's verdict, or undefined while the campaigns read is unsettled. */
  running: boolean | undefined;
  /**
   * Whether campaign-service holds a campaign for this (funnel, channel, offer) at
   * all — `buildControlRows`' `campaignId !== null`. Undefined while unsettled.
   */
  hasCampaign: boolean | undefined;
}): LegChannelState {
  if (running === undefined || hasCampaign === undefined) return "unknown";
  const state = channelRunState({
    settled: true,
    campaignId: hasCampaign ? "present" : null,
    running,
  });
  // A channel nobody has bought reads as such rather than as one waiting to be
  // started: there is nothing to start until it is funded.
  if (state === "not_started" && savedCents <= 0) return "not_funded";
  return state;
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
  runningBySlug,
  hasCampaignBySlug,
}: {
  legs: readonly CampaignLeg[];
  channels: readonly AcquisitionChannelDef[];
  savedCentsBySlug: Record<string, number>;
  /**
   * Which channels campaign-service reports as running, resolved by the CALLER through
   * `buildControlRows` — the same rows the controls modal edits.
   *
   * `undefined` (the whole map) means the campaigns read has not settled, so every card
   * reads `unknown` rather than guessing. A slug ABSENT from a settled map is a channel
   * no row covers, which is `not running`, never `running`.
   */
  runningBySlug: Record<string, boolean> | undefined;
  /**
   * Which channels campaign-service holds a campaign for at all, from the SAME
   * `buildControlRows` pass as `runningBySlug`.
   *
   * Separate from "is it running" because the two answer different questions and the
   * difference is the whole point: a funded channel with no campaign is NOT running
   * and is not paused either. Undefined while the read is in flight; a slug absent
   * from a settled map has no campaign.
   */
  hasCampaignBySlug: Record<string, boolean> | undefined;
}): LegColumn[] {
  return legs.map((leg) => ({
    leg,
    cards: channelsForLeg(leg, channels).map((channel) => {
      const savedCents = savedCentsBySlug[channel.featureSlug] ?? 0;
      const running = runningBySlug ? (runningBySlug[channel.featureSlug] ?? false) : undefined;
      const hasCampaign = hasCampaignBySlug
        ? (hasCampaignBySlug[channel.featureSlug] ?? false)
        : undefined;
      return {
        channel,
        savedCents,
        funded: savedCents > 0,
        state: legChannelState({ savedCents, running, hasCampaign }),
      };
    }),
  }));
}
