// A funnel, walked ARROW BY ARROW, with whoever performs each arrow beside it.
//
// The campaigns table used to be one line per campaign, which shows a customer only the
// legs WE run. A funnel is sold leg by leg and the legs we do not automate are worked at
// the brand's side, so a table that lists two rows for a four-arrow funnel tells them
// their funnel is two steps long. Every arrow gets a row; a row we run names its
// campaign, and a row the brand does itself says so.
//
// Every FIGURE on a row is a served rung of `funnelSteps` (features-service#854): how
// many reached that step, what reaching it cost, and what share of the step before
// converted. Nothing here divides — a browser computing a user-facing ratio is the
// compute-a-stat-in-the-browser bug, and it would drift from the producer the moment
// either side changed scope.
//
// Only value imports that carry no "@" alias live here (both imports below are
// type-only and erase at build), so this module stays directly unit-testable.

import type { CampaignLeg } from "./campaign-leg";
import type { FunnelStepRow } from "./revenue-view";

/**
 * Which `leads[]` boolean the producer counts for each step of a funnel.
 *
 * The join between a funnel's own step tokens and the rungs on the wire. Matching by
 * INDEX would work today — the producer states its rungs "in the funnel's own order" —
 * but it is silently wrong the day a funnel gains a step on one side only, and the
 * failure would read as every row shifted by one rather than as an error. `leadField` is
 * an enum the producer documents, so the join is on a stated value.
 */
export const LEAD_FIELD_BY_STEP_KEY: Record<string, string> = {
  conversation: "repliedPositive",
  website_visit: "clicked",
  meeting_booked: "meetingBooked",
  meeting_attended: "meetingAttended",
  signup: "signup",
  form_filled: "formSubmission",
  paid_client: "purchased",
};

/**
 * One row of the walked funnel: the arrow, the rung it lands on, and who does it.
 *
 * Generic in the campaign so this module needs no view type: the table hands it whatever
 * row shape it already holds, and gets it back attached to the leg that row performs.
 */
export interface FunnelLegRow<C> {
  /** The arrow itself, in the funnel's own words and the producer's own tokens. */
  leg: CampaignLeg;
  /** The served rung landing on this leg's step, or null when the producer states none. */
  step: FunnelStepRow | null;
  /**
   * The campaign performing this leg, or null when nobody here does. Null is the
   * customer-operated case — the brand works that arrow itself — and it is a row like
   * any other rather than an omission.
   */
  campaign: C | null;
}

/**
 * Build one row per arrow of the funnel.
 *
 * `campaigns` are handed in ALREADY resolved to the leg each performs, because resolving
 * a campaign's leg needs the channel catalogue and this module holds no catalogue. A
 * campaign whose leg cannot be placed on this funnel (`toIndex` null) is dropped rather
 * than filed under an arrow it does not perform: naming the wrong arrow is worse than
 * showing the arrow as unclaimed.
 *
 * Two campaigns claiming ONE arrow is real — a brand can fund two channels onto the same
 * step — and the FIRST wins the row, the rest are returned in `extra` so the caller
 * renders them rather than hiding them.
 */
export function buildFunnelLegRows<C>({
  legs,
  steps,
  campaigns,
}: {
  legs: readonly CampaignLeg[];
  /** `funnelSteps.steps` off the funnel-scoped revenue read, or null when it states none. */
  steps: readonly FunnelStepRow[] | null | undefined;
  campaigns: readonly { toIndex: number | null; campaign: C }[];
}): { rows: FunnelLegRow<C>[]; extra: C[] } {
  const extra: C[] = [];

  const rows = legs.map((leg) => {
    const wanted = LEAD_FIELD_BY_STEP_KEY[leg.toKey];
    const step = steps?.find((s) => s.leadField === wanted) ?? null;
    const match = campaigns.find((c) => c.toIndex === leg.toIndex);
    return { leg, step, campaign: match ? match.campaign : null };
  });

  // A second campaign on an arrow already taken, and any campaign this funnel has no
  // arrow for: both are still this brand's campaigns and both are handed back.
  const seen = new Set<C>();
  for (const row of rows) if (row.campaign) seen.add(row.campaign);
  for (const c of campaigns) if (!seen.has(c.campaign)) extra.push(c.campaign);

  return { rows, extra };
}
