/**
 * Whether one lead's deal is WON, and whose win it was, read off the row the leads
 * table already holds.
 *
 * The leads table renders a column per lead over pages of rows at four grains, so the
 * answer has to come off the row itself: a second request per lead to learn one fact is
 * the fan-out the paged read exists to avoid. lead-service derives `closedDeal` in the
 * same pass as the standing, off the statement reads it already ran (v0.76.0), so a
 * page of leads costs it one extra read in total — and the row and the lead panel
 * cannot disagree about whether somebody bought.
 *
 * Nothing here decides an outcome. This module reads what the row states and says
 * whether the column can offer a control.
 *
 * Alias-free on purpose (no runtime import), so this module carries REAL unit tests
 * rather than source-substring guards. Keep it that way.
 */

/**
 * The four things the column can say about one lead.
 *
 * `won`         — the deal closed, and the customer said whether we caused it.
 * `won-unstated`— the deal closed and NOBODY WAS ASKED whose win it was. Its own state,
 *                 never folded into either answer: it is what every deal stated before
 *                 the question existed carries, and what every tracker-reported one
 *                 carries, because a page-load tag cannot know why somebody bought.
 * `open`        — the lead is on a campaign and no deal has been stated, so the column
 *                 offers the control that states one.
 * `unavailable` — the lead carries no standing, so there is no campaign to state a deal
 *                 against. The cell holds its shape and states nothing: a blank that
 *                 reads as "not won" would assert something nobody knows.
 */
export type LeadCloseWonState = "won" | "won-unstated" | "open" | "unavailable";

/** Who the customer said caused the deal. `null` is "nobody was asked", never "not us". */
export type DealCause = "outreach" | "other" | null;

/** The shape this module reads. A structural subset of `Lead` — never the whole type. */
export interface CloseWonLead {
  standing?: object | null;
  closedDeal?: { causedByOutreach: boolean | null } | null;
}

/** Whose win the customer said it was. Absent deal and unasked deal both read null. */
export function dealCause(lead: CloseWonLead): DealCause {
  const caused = lead.closedDeal?.causedByOutreach ?? null;
  if (caused === true) return "outreach";
  if (caused === false) return "other";
  return null;
}

/**
 * What the column says about this lead.
 *
 * `closedDeal` IS the producer's answer to whether a deal was stated — present means
 * one was, whoever stated it and whenever. Nothing here infers a close from a reply, a
 * click, a standing word or an amount.
 */
export function leadCloseWonState(lead: CloseWonLead): LeadCloseWonState {
  if (!lead.standing) return "unavailable";
  if (!lead.closedDeal) return "open";
  return dealCause(lead) === null ? "won-unstated" : "won";
}

/**
 * What to put in the deal-value field before anybody types, in whole dollars.
 *
 * The OFFER's own stated lifetime revenue — not a blended figure and not a number this
 * app invents. An offer that states none returns null and the field opens EMPTY: an
 * absent lifetime revenue and a stated one are different facts. It is a PREFILL: the
 * person confirms or replaces it, and lead-service still refuses a sale with no value.
 */
export function saleValuePrefillUsd(lifetimeRevenueUsd: number | null | undefined): number | null {
  // Zero is not a prefill worth offering: it would submit as a deal worth nothing, which
  // is the one reading a person confirming a prefilled field is least likely to check.
  return lifetimeRevenueUsd != null && lifetimeRevenueUsd > 0 ? lifetimeRevenueUsd : null;
}
