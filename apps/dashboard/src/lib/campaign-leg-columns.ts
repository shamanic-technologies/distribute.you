// WHICH per-audience columns a CAMPAIGN's own leg earns.
//
// A campaign is (offer x funnel x channel) and it performs ONE arrow of that funnel —
// cold email puts a lead onto the visit-led funnel and does nothing else; a human fills
// the form. So a campaign-scoped surface that renders the whole FUNNEL's columns states
// arrows this campaign never runs, each of which has its own page worked by whoever
// performs it. That is the same mistake the lead panel's Funnel-progress section made
// before it moved onto the leg, one surface over: the funnel is the campaign's context,
// the leg is its job.
//
// This module is the map from the step a leg LANDS ON to the column pair that prices it,
// and to the cost column a ranking surface should lead with. It introduces no vocabulary
// of its own — the tokens are the funnel catalogue's `stepKeys` (the producer's spelling,
// which is what `CampaignLeg` carries) and the metrics are `strategy-model`'s.
//
// Alias-free on purpose (both imports are type-only and erase at build) so this module
// carries REAL unit tests. Keep it that way.

import type { CampaignLeg } from "./campaign-leg";
import type { AudienceRankMetric } from "./strategy-model";

/**
 * The per-audience column PAIR a step is priced by — a count and its cost.
 *
 * One per pair the Audiences table renders. A step absent from this map is one
 * features-service serves no per-audience price for (both meeting steps today), and the
 * answer there is null rather than a nearest neighbour: lending a campaign the columns of
 * the arrow before it is exactly what this module exists to stop.
 */
export type LegColumnPair = "reply" | "visit" | "signup" | "formSubmission" | "sale";

const PAIR_BY_STEP_KEY: Readonly<Record<string, LegColumnPair>> = {
  // The producer calls the reply funnel's first step `conversation`; the customer reads
  // "Sales interest". Matching is by TOKEN for that reason — the words differ.
  conversation: "reply",
  website_visit: "visit",
  signup: "signup",
  form_filled: "formSubmission",
  paid_client: "sale",
  // meeting_booked / meeting_attended: features-service serves no per-audience meeting
  // count or cost, so there is no pair to render. Deliberately absent, not forgotten.
};

/** The cost column that prices each pair. Byte-equal to the table's own sort keys. */
const METRIC_BY_PAIR: Readonly<Record<LegColumnPair, AudienceRankMetric>> = {
  reply: "cppr",
  visit: "cpc",
  signup: "cps",
  formSubmission: "cpfs",
  sale: "cpsale",
};

/**
 * The column pair this leg earns, or null when it earns none.
 *
 * Keyed on `toKey` — the step the arrow LANDS ON — because that is what the campaign
 * buys. An entry leg buys the funnel's first step; an internal one buys the step it
 * converts into.
 */
export function legColumnPair(leg: CampaignLeg | null | undefined): LegColumnPair | null {
  if (!leg) return null;
  return PAIR_BY_STEP_KEY[leg.toKey] ?? null;
}

/**
 * The cost column a campaign-scoped ranking surface leads with, or null when this leg
 * has no per-audience price.
 *
 * Null is what makes this safe to hand to every caller unconditionally: the caller falls
 * back to `audienceRankMetric`, the goal-keyed answer these surfaces read before legs
 * existed — so a campaign whose leg we cannot price reads exactly as it did before.
 */
export function legRankMetric(leg: CampaignLeg | null | undefined): AudienceRankMetric | null {
  const pair = legColumnPair(leg);
  return pair ? METRIC_BY_PAIR[pair] : null;
}

/**
 * Whether a pair's columns can actually carry a number for this brand.
 *
 * The three tracked outcomes (signup, form submission, sale) are attributed by the
 * brand's own conversion tracker, so with no tracker installed their columns would only
 * ever print "-". A leg whose pair is unavailable falls the caller back to the
 * funnel-wide gating rather than leaving the table with no outcome column at all.
 * Replies come from the email gateway and visits from the delivery layer, so neither
 * depends on the tracker.
 */
export function legPairIsAvailable(pair: LegColumnPair | null, trackerSetUp: boolean): boolean {
  if (pair === null) return false;
  if (pair === "reply" || pair === "visit") return true;
  return trackerSetUp;
}
