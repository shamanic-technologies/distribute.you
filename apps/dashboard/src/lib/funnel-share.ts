// What share of the leads we contacted showed sales interest.
//
// SERVED, never divided here: features-service walks the funnel rung by rung on the
// same deduped leads and the same committed cents as the money beside it, so a rate
// between two rungs is a rate rather than two scopes divided into each other. A
// browser-computed ratio is the compute-a-stat-in-the-browser bug and would drift from
// the producer the moment either side changed scope.
//
// One home rather than a copy per surface: the campaign Overview and the Leads page
// state the same percentage under the same words, and two derivations of it is how
// they would come to disagree.
//
// Alias-free on purpose (its only import is a type and erases at build) so this module
// carries REAL unit tests. Keep it that way.

import type { FunnelStepBreakdown } from "./revenue-view";

/**
 * The sales-interest share of the contacted base, 0-100, or null when it cannot be
 * stated.
 *
 * Gated on TWO things, and both matter:
 *
 *   - the rung has to be the SALES-INTEREST one (`leadField: "repliedPositive"`),
 *     because a visit-led funnel's first rung is a website visit and its share is a
 *     different sentence;
 *   - it has to convert FROM `Contacted`, which is the producer's own name for the
 *     base every funnel starts from. A rung deeper in the funnel states a share of the
 *     rung BEFORE it, so labelling it "of contacted" would be false.
 *
 * Null is "we could not measure this" — either side unmeasured, or a base of zero, on
 * which the producer returns null rather than a fabricated 0% or 100%. A caller renders
 * nothing for it; a 0% would claim nobody was interested when nobody was asked.
 */
export function salesInterestSharePct(
  funnelSteps: FunnelStepBreakdown | null | undefined,
): number | null {
  return contactedSharePct(funnelSteps, "repliedPositive");
}

/**
 * The same sentence for the funnel whose first rung is a WEBSITE VISIT.
 *
 * The two are mutually exclusive by construction — a funnel begins at one step — so a
 * campaign states one of them and never both. It is a separate wrapper rather than a
 * bare `steps[0]` read for the same reason `salesInterestSharePct` is: a rung deeper in
 * the funnel converts from the rung BEFORE it, so labelling it "of contacted" would be
 * false, and the guard is what stops that.
 */
export function websiteVisitSharePct(
  funnelSteps: FunnelStepBreakdown | null | undefined,
): number | null {
  return contactedSharePct(funnelSteps, "clicked");
}

/**
 * The share of the contacted base that reached the funnel's FIRST rung, when that rung
 * is the one named.
 *
 * One implementation for both callers: the guard is the whole content of the rule, and
 * two copies of it is how one surface comes to state a deeper rung's share under the
 * word "contacted".
 */
function contactedSharePct(
  funnelSteps: FunnelStepBreakdown | null | undefined,
  leadField: string,
): number | null {
  const first = funnelSteps?.steps?.[0];
  if (!first) return null;
  if (first.leadField !== leadField) return null;
  if (first.fromStep !== "Contacted") return null;
  return first.conversionFromPreviousPct;
}
