/**
 * The steps of ONE campaign's LEG, as a person states them about ONE lead.
 *
 * This is the human side, not the measured one. `goal-steps.ts` answers "which steps
 * carry a stat"; here are the steps a person walks a lead through, including the ones
 * with no automatic signal (an attended meeting, a paid client), which is exactly why a
 * human has to state them.
 *
 * A campaign is (offer x leg x channel) and performs ONE leg, so the panel states that
 * leg's steps: an entry leg its one step, an internal leg the step it converts FROM and
 * the one it converts TO. Steps are keyed on the producer's own step TOKENS and named
 * with the catalogue's own words, so a step reads the same here as everywhere else.
 *
 * Alias-free on purpose (no runtime import), so this module carries REAL unit tests.
 */
/** Stable id for a stage. Never a label — labels are copy and copy changes. */
export type LeadStageKey =
  | "positive_reply"
  | "website_visit"
  | "meeting_booked"
  | "meeting_attended"
  | "signup"
  | "form_submission"
  | "sale";

/**
 * What the person typed, as the cents lead-service takes — or null when it is not an
 * amount at all.
 *
 * Null is a REFUSAL to submit, never a zero: a deal worth nothing and a deal nobody
 * priced are exactly the two things this change exists to keep apart. A blank field, a
 * negative, a word and a number that rounds to no cents all return null. Currency
 * decoration the person pastes in ($, thousands separators, surrounding spaces) is
 * accepted, because rejecting "$4,900" for its punctuation teaches nothing.
 */
export function saleValueCentsFrom(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned.length === 0) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  return cents > 0 ? cents : null;
}

/**
 * What the person typed about what a step COST THEM, as the cents lead-service takes,
 * or null when it is not an amount at all.
 *
 * ZERO IS A REAL ANSWER here, which is the whole difference from the value parser above:
 * a step that cost nothing and a step nobody priced are exactly the two things the
 * producer's refusal exists to keep apart, so `"0"` returns 0 and a BLANK field returns
 * null. Null is a refusal to submit, never a zero standing in for silence. A negative,
 * a word, and anything that is not a number all return null too.
 *
 * Currency decoration the person pastes in ($, thousands separators, surrounding
 * spaces) is accepted, because rejecting "$1,200" for its punctuation teaches nothing.
 */
export function stepCostCentsFrom(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned.length === 0) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  return cents >= 0 ? cents : null;
}

/**
 * Producer step token → stage. A token with no entry has no stage lead-service accepts a
 * statement on or renders (a direct purchase today), and is skipped rather than drawn.
 */
const STAGE_FOR_TOKEN: Record<string, { key: LeadStageKey; wontLabel: string; label?: string }> = {
  // `label` overrides what THIS panel calls the step, and exactly one step needs it: on
  // a lead panel the row already carries the answer's own KIND beside it (Interested,
  // Wants to book, Not interested), so a heading naming the interest states the very
  // thing the control next to it is there to answer. "Replied" is the fact.
  conversation: { key: "positive_reply", wontLabel: "Won't reply", label: "Replied" },
  website_visit: { key: "website_visit", wontLabel: "Won't visit" },
  meeting_booked: { key: "meeting_booked", wontLabel: "Won't book" },
  meeting_attended: { key: "meeting_attended", wontLabel: "Won't attend" },
  signup: { key: "signup", wontLabel: "Won't sign up" },
  form_submitted: { key: "form_submission", wontLabel: "Won't fill it" },
  // The two pre-2026-09-18 spellings, read as the one form step.
  form_filled: { key: "form_submission", wontLabel: "Won't fill it" },
  lead_form_submitted: { key: "form_submission", wontLabel: "Won't fill it" },
  paid_client: { key: "sale", wontLabel: "Won't buy" },
};

/** Every stage key a step can map onto, in no particular order. */
export const LEAD_STAGE_KEYS: readonly LeadStageKey[] = [
  ...new Set(Object.values(STAGE_FOR_TOKEN).map((s) => s.key)),
];

