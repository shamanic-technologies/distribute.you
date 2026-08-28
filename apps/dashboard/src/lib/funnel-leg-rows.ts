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
 * Build the rows of the walked funnel.
 *
 * `campaigns` are handed in ALREADY resolved to the leg each performs, because resolving
 * a campaign's leg needs the channel catalogue and this module holds no catalogue. A
 * campaign whose leg cannot be placed on this funnel (`toIndex` null) is handed back in
 * `extra` rather than filed under an arrow it does not perform: naming the wrong arrow is
 * worse than showing the arrow as unclaimed.
 *
 * EVERY arrow gets a row. An arrow with several campaigns gets one row EACH — a brand can
 * fund two channels onto the same step, and the earlier shape gave the arrow to the first
 * and dumped the rest at the bottom of the table, which reads as campaigns the funnel has
 * no place for. An arrow with none gets its row anyway: that is the leg the brand works
 * itself, and it is the whole reason this walks arrows rather than listing campaigns.
 *
 * ORDER: the funnel's own step order first, then cheapest per outcome. The step order is
 * what makes the table a funnel — a reader follows it top to bottom the way a lead moves
 * through it — and the price only ever breaks a tie WITHIN one step, where two campaigns
 * buy the same thing and the cheaper one is the better answer. A row whose cost is
 * unstated sorts last of its step rather than first: an absent figure is not a low one.
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
  const rows: FunnelLegRow<C>[] = [];

  for (const leg of legs) {
    const wanted = LEAD_FIELD_BY_STEP_KEY[leg.toKey];
    const step = steps?.find((s) => s.leadField === wanted) ?? null;
    const onThisLeg = campaigns.filter((c) => c.toIndex === leg.toIndex);
    if (onThisLeg.length === 0) {
      rows.push({ leg, step, campaign: null });
      continue;
    }
    for (const c of onThisLeg) rows.push({ leg, step, campaign: c.campaign });
  }

  // Step asc, then cost per outcome asc. The loop above already emits the legs in the
  // funnel's order, so this only ever reorders the campaigns sharing one arrow — which
  // is the case the price exists to settle.
  rows.sort((a, b) => {
    const byStep = a.leg.toIndex - b.leg.toIndex;
    if (byStep !== 0) return byStep;
    const ca = a.step?.costPerReachCents;
    const cb = b.step?.costPerReachCents;
    if (ca == null && cb == null) return 0;
    // Unstated sorts LAST: "we have no figure" is not the cheapest answer.
    if (ca == null) return 1;
    if (cb == null) return -1;
    return ca - cb;
  });

  // Every campaign this funnel has no arrow for. Still this brand's campaigns, so they
  // are handed back rather than dropped.
  const extra = campaigns.filter((c) => c.toIndex == null).map((c) => c.campaign);

  return { rows, extra };
}
