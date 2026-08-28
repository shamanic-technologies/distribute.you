// WHICH LEG of a sales funnel a campaign actually performs.
//
// A campaign is (offer x funnel x channel), and until now it was NAMED by its
// funnel. That overstates almost every campaign and outright misdescribes some: a
// funnel is sold LEG BY LEG, so a channel that only takes a lead from "Meeting
// attended" to "Paid client" was reading as "Sales Meeting from Conversation" — the
// name of the whole funnel it closes the last arrow of.
//
// The legs come off the wire: features-service states them on the channel's own
// feature row as bare step tokens, which the acquisition-channel catalogue already
// reads. The WORDS come from the funnel's own `steps`, so this module introduces no
// vocabulary of its own — "Sales interest" is what the customer already reads for
// that step on the Sales Funnels settings card, and it stays that everywhere.
//
// Alias-free on purpose (both imports are type-only and erase at build) so this
// module carries REAL unit tests. Keep it that way.

import type { ChannelLeg } from "./acquisition-channels";
import type { SalesFunnelDef } from "./sales-funnels";

/**
 * One leg, resolved against a funnel: where it sits in the funnel's step order, and
 * what to call it.
 *
 * `fromIndex` is null for the leg that puts a lead ON the funnel — the producer's
 * `from: null`, which it calls "from nothing" and which is what every entry channel
 * does. That is not the same as index 0, and collapsing the two would make an entry
 * leg indistinguishable from one converting the first step into the second.
 */
export interface CampaignLeg {
  /** Where the step this leg moves a lead OUT of sits in `steps`, or null. */
  fromIndex: number | null;
  /** Where the step this leg moves a lead TO sits in `steps`. */
  toIndex: number;
  /**
   * The SAME two steps under the producer's own tokens — the key a leg's MARK is
   * looked up on (`funnel-leg-marks.ts`). Carried here rather than re-derived at the
   * render site because the indices alone cannot say WHICH funnel they index into,
   * and a mark keyed on the wrong funnel's steps is a tile for a different arrow.
   */
  fromKey: string | null;
  toKey: string;
  /** What to call it, in the funnel's own words. */
  label: string;
}

/**
 * The leg this channel performs WITHIN this funnel, or null when it performs none.
 *
 * A channel routinely states several legs — cold email produces a conversation AND a
 * website visit; an in-house closing team converts a signup AND a filled form — and
 * at most one of them ever belongs to a given funnel. So the funnel is what
 * disambiguates, and matching is by TOKEN against `stepKeys`, never by the words: the
 * producer calls the first step of the reply funnel `conversation` while the customer
 * reads "Sales interest", so a match on labels would silently find nothing.
 *
 * Two shapes count as a leg of this funnel and nothing else does:
 *
 *   - an ENTRY leg (`from: null`) whose `to` is the funnel's FIRST step. A channel
 *     that produces a step from nothing is only on this funnel when that step is
 *     where the funnel begins;
 *   - an INTERNAL leg whose `from` and `to` are ADJACENT in `steps`, in that order.
 *     Adjacency is what makes it one of this funnel's own arrows rather than a
 *     shortcut past a step, which no funnel prices and none of us sells.
 *
 * A channel matching several legs of one funnel takes the EARLIEST, so the answer is
 * deterministic rather than dependent on the order the producer listed them in.
 */
export function campaignLegFor(
  funnel: SalesFunnelDef | null | undefined,
  legs: readonly ChannelLeg[] | null | undefined,
): CampaignLeg | null {
  if (!funnel || !legs || legs.length === 0) return null;
  const stepKeys = funnel.stepKeys;

  let best: CampaignLeg | null = null;
  for (const leg of legs) {
    const toIndex = stepKeys.indexOf(leg.to);
    if (toIndex < 0) continue;

    let resolved: CampaignLeg | null = null;
    if (leg.from === null) {
      // Onto the funnel from nothing — a leg of this funnel only when it lands on
      // the step the funnel starts at.
      if (toIndex === 0) {
        resolved = {
          fromIndex: null,
          toIndex,
          fromKey: null,
          toKey: stepKeys[0],
          label: funnel.steps[0],
        };
      }
    } else {
      const fromIndex = stepKeys.indexOf(leg.from);
      if (fromIndex >= 0 && fromIndex === toIndex - 1) {
        resolved = {
          fromIndex,
          toIndex,
          fromKey: stepKeys[fromIndex],
          toKey: stepKeys[toIndex],
          label: `${funnel.steps[fromIndex]} → ${funnel.steps[toIndex]}`,
        };
      }
    }

    if (resolved && (best === null || resolved.toIndex < best.toIndex)) best = resolved;
  }
  return best;
}

/**
 * What to CALL a campaign, in one line.
 *
 * The leg when the channel states one for this funnel, and the funnel's own name when
 * it does not. That fallback is deliberate rather than a dash: a channel whose feature
 * row predates the legs field, or one whose legs we cannot place among this funnel's
 * steps, is still a campaign selling this funnel — which is the sentence this surface
 * read before legs existed, so falling back to it loses nothing and invents nothing.
 */
export function campaignLegLabel(
  funnel: SalesFunnelDef | null | undefined,
  legs: readonly ChannelLeg[] | null | undefined,
): string | null {
  const leg = campaignLegFor(funnel, legs);
  if (leg) return leg.label;
  return funnel ? funnel.name : null;
}

/**
 * EVERY arrow of a funnel, in the funnel's own order — whether or not any channel
 * performs it.
 *
 * `campaignLegFor` above answers "which leg does this channel do"; this answers "which
 * legs does this funnel HAVE". A funnel is sold leg by leg and the legs we do not
 * automate are worked at the brand's side, so a surface that walks a funnel has to list
 * every arrow and then say who performs each — listing only the ones we run tells a
 * customer their funnel is shorter than it is.
 *
 * Index i is the arrow LANDING on `steps[i]`: the first is the entry leg (onto the
 * funnel from nothing) and every later one converts the step before it.
 */
export function funnelLegs(funnel: SalesFunnelDef | null | undefined): CampaignLeg[] {
  if (!funnel) return [];
  return funnel.steps.map((step, i) =>
    i === 0
      ? { fromIndex: null, toIndex: 0, fromKey: null, toKey: funnel.stepKeys[0], label: step }
      : {
          fromIndex: i - 1,
          toIndex: i,
          fromKey: funnel.stepKeys[i - 1],
          toKey: funnel.stepKeys[i],
          label: `${funnel.steps[i - 1]} → ${step}`,
        },
  );
}
