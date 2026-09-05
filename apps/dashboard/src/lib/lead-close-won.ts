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
 * Alias-free on purpose (its two imports are relative, and `sales-funnels.ts`'s own
 * `@/lib/api` import is type-only, so it erases) — this module carries REAL unit tests
 * rather than source-substring guards. Keep it that way.
 */

import { leadFunnelStages } from "./lead-funnel-stages";
import { normalizeSalesFunnelKey, type SalesFunnelKey, type SalesFunnelKeyWire } from "./sales-funnels";

/**
 * The four things the column can say about one lead.
 *
 * `won`         — the deal closed, and the customer said whether we caused it.
 * `won-unstated`— the deal closed and NOBODY WAS ASKED whose win it was. Its own state,
 *                 never folded into either answer: it is what every deal stated before
 *                 the question existed carries, and what every tracker-reported one
 *                 carries, because a page-load tag cannot know why somebody bought.
 * `open`        — this lead's funnel ends in a sale and no deal has been stated, so the
 *                 column offers the control that states one.
 * `unavailable` — there is no sale on this lead's funnel to state, or we cannot tell
 *                 which funnel it is on. The cell holds its shape and states nothing: a
 *                 blank that reads as "not won" would assert something nobody knows,
 *                 and a control lead-service would refuse is worse than no control.
 */
export type LeadCloseWonState = "won" | "won-unstated" | "open" | "unavailable";

/** Who the customer said caused the deal. `null` is "nobody was asked", never "not us". */
export type DealCause = "outreach" | "other" | null;

/** The shape this module reads. A structural subset of `Lead` — never the whole type. */
export interface CloseWonLead {
  standing?: { funnelKey: string | null } | null;
  closedDeal?: { causedByOutreach: boolean | null } | null;
}

/**
 * The funnel key the CATALOGUE carries, or null.
 *
 * `normalizeSalesFunnelKey` THROWS on a key it does not map, which is right where an
 * unknown key is a vocabulary drift worth seeing and fatal where it is not. Here it is
 * not: lead-service's funnel vocabulary is legitimately WIDER than this app's catalogue
 * (the ads-led funnels it serves have no entry here), and a throw inside a table cell
 * takes the whole table down for every row of a campaign selling one of them. So an
 * unmapped key reads as "we cannot place this lead's funnel", which is exactly what the
 * `unavailable` state is for.
 */
export function closeWonFunnelKey(lead: CloseWonLead): SalesFunnelKey | null {
  const raw = lead.standing?.funnelKey ?? null;
  if (!raw) return null;
  try {
    return normalizeSalesFunnelKey(raw as SalesFunnelKeyWire);
  } catch {
    return null;
  }
}

/**
 * Whether a funnel ends in a sale somebody can state.
 *
 * Read off the SAME walk the lead panel renders (`leadFunnelStages`), never a second
 * list of which funnels sell: two lists is how a column comes to offer a control on a
 * funnel the panel says has no such step.
 */
export function funnelSellsSale(funnelKey: SalesFunnelKey | null): boolean {
  if (!funnelKey) return false;
  return leadFunnelStages(funnelKey).some((stage) => stage.key === "sale");
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
  if (!funnelSellsSale(closeWonFunnelKey(lead))) return "unavailable";
  if (!lead.closedDeal) return "open";
  return dealCause(lead) === null ? "won-unstated" : "won";
}

/**
 * What to put in the deal-value field before anybody types, in whole dollars.
 *
 * The brand's own stated lifetime revenue FOR THE FUNNEL THIS LEAD IS ON — not the
 * brand's blended figure and not a number this app invents. A funnel the brand never
 * priced returns null and the field opens EMPTY, which is the honest reading: an absent
 * lifetime revenue and a stated one are different facts, and seeding a guess is what
 * every money figure downstream would then be built on.
 *
 * It is a PREFILL, not a default: the person confirms or replaces it, and what is sent
 * is whatever the field holds. lead-service still refuses a sale with no value, so a
 * brand that priced nothing meets exactly the question it should.
 */
export function saleValuePrefillUsd(
  funnels: readonly { funnelKey: string; lifetimeRevenueUsd: number | null }[] | undefined,
  funnelKey: SalesFunnelKey | null,
): number | null {
  if (!funnelKey || !funnels) return null;
  const match = funnels.find((f) => f.funnelKey === funnelKey);
  const ltr = match?.lifetimeRevenueUsd ?? null;
  // Zero is not a prefill worth offering: it would submit as a deal worth nothing, which
  // is the one reading a person confirming a prefilled field is least likely to check.
  return ltr != null && ltr > 0 ? ltr : null;
}
