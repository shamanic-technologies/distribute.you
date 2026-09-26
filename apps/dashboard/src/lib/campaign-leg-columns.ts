// WHICH per-audience columns a CAMPAIGN's own leg earns.
//
// A campaign is (offer x leg x channel) and it performs ONE leg, so a campaign-scoped
// surface renders the columns of the step that leg LANDS ON and nothing else: cold email
// puts a lead on a positive reply or a website visit and does nothing after it.
//
// This module is the map from that step to the column pair that prices it, and to the
// cost column a ranking surface should lead with. The step tokens are the producer's.
//
// Alias-free on purpose (the import is type-only and erases at build) so this module
// carries REAL unit tests. Keep it that way.

import type { AudienceRankMetric } from "./strategy-model";

/** The one fact about a leg this module reads: the step it lands on. */
export type LandingLeg = { toKey: string };

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
  // The producer calls this step `conversation`; the customer reads "Positive reply".
  // Matching is by TOKEN for that reason — a key is not a sentence.
  conversation: "reply",
  website_visit: "visit",
  signup: "signup",
  // ONE form step since 2026-09-18 (a form is a form, on the site or in the ad).
  // The two spellings it replaced are read as it, so a leg off a body written
  // before the merge still prices; this module imports nothing at runtime, so
  // the alias is inlined rather than read off `step-marks`.
  form_submitted: "formSubmission",
  form_filled: "formSubmission",
  lead_form_submitted: "formSubmission",
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
 * The column pair this leg earns, or null when it earns none. Keyed on `toKey`, the
 * step the leg LANDS ON, because that is what the campaign buys.
 */
export function legColumnPair(leg: LandingLeg | null | undefined): LegColumnPair | null {
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
export function legRankMetric(leg: LandingLeg | null | undefined): AudienceRankMetric | null {
  const pair = legColumnPair(leg);
  return pair ? METRIC_BY_PAIR[pair] : null;
}

/**
 * Whether a pair's columns can actually carry a number for this brand.
 *
 * The three tracked outcomes (signup, form submission, sale) are attributed by the
 * brand's own conversion tracker, so with no tracker installed their columns would only
 * ever print "-". A leg whose pair is unavailable falls the caller back to the
 * goal-wide gating rather than leaving the table with no outcome column at all.
 * Replies come from the email gateway and visits from the delivery layer, so neither
 * depends on the tracker.
 */
export function legPairIsAvailable(pair: LegColumnPair | null, trackerSetUp: boolean): boolean {
  if (pair === null) return false;
  if (pair === "reply" || pair === "visit") return true;
  return trackerSetUp;
}
