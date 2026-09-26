// What share of the leads we contacted reached a campaign's first step.
//
// SERVED, never divided here: features-service walks the steps on the same deduped
// leads and the same committed cents as the money beside it, so a rate between two
// steps is a rate rather than two scopes divided into each other. A browser-computed
// ratio is the compute-a-stat-in-the-browser bug.
//
// One home rather than a copy per surface: the campaign Overview and the Leads page
// state the same percentage under the same words.
//
// Alias-free on purpose (its only import is a type and erases at build) so this module
// carries REAL unit tests. Keep it that way.

import type { StepWalk } from "./revenue-view";

/**
 * The positive-reply share of the contacted base, 0-100, or null when it cannot be
 * stated.
 *
 * Gated on TWO things: the first step has to be the POSITIVE-REPLY one, and it has to
 * convert FROM `Contacted` (the producer's own name for the base). A deeper step states
 * a share of the step BEFORE it, so labelling it "of contacted" would be false.
 *
 * Null is "we could not measure this"; a caller renders nothing for it.
 */
export function positiveReplySharePct(walk: StepWalk | null | undefined): number | null {
  return contactedSharePct(walk, "repliedPositive");
}

/** The same sentence for a campaign whose first step is a WEBSITE VISIT. */
export function websiteVisitSharePct(walk: StepWalk | null | undefined): number | null {
  return contactedSharePct(walk, "clicked");
}

function contactedSharePct(walk: StepWalk | null | undefined, leadField: string): number | null {
  const first = walk?.steps?.[0];
  if (!first) return null;
  if (first.leadField !== leadField) return null;
  if (first.fromStep !== "Contacted") return null;
  return first.conversionFromPreviousPct;
}
