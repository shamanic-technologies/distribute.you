// The tile that stands for ONE STEP, product-wide.
//
// A step is a THING a buyer reaches (a website visit, a signup, a paid client); a leg is
// the move between two of them, and `leg-marks.ts` draws every leg. ONE glyph per step,
// the same wherever a step is named: an outcome a visitor picks, the rows of a lead's
// progress, the outcomes table. The steps an entry leg lands on keep that leg's glyph,
// since reaching a step from nothing IS reaching the step.
//
// The KEY is the producer's own step token (`GET /public/channels` `steps[].key`); the
// lead panel's stage vocabulary spells three of them differently and is mapped below.
//
// Only value imports that carry no "@" alias live here, so this module stays directly
// unit-testable (vitest does not resolve the alias).

export type StepGlyph =
  | "hand-waving"
  | "cursor-click"
  | "calendar-plus"
  | "users-three"
  | "identification-badge"
  | "textbox"
  | "clipboard"
  | "currency-dollar"
  | "shopping-bag-open";

export interface StepMark {
  glyph: StepGlyph;
  tone: { iconBg: string; iconText: string };
}

/** The same secondary tone every LEG wears: a step is a point on the same sequence. */
export const STEP_TONE = { iconBg: "bg-purple-50", iconText: "text-purple-600" } as const;

/**
 * Every step the producer publishes today, in its own order. A step added upstream
 * shows up in `step-marks.test.ts` as a failing test, never as a blank tile.
 */
export const STEP_MARKS: Record<string, StepMark> = {
  conversation: { glyph: "hand-waving", tone: STEP_TONE },
  website_visit: { glyph: "cursor-click", tone: STEP_TONE },
  meeting_booked: { glyph: "calendar-plus", tone: STEP_TONE },
  meeting_attended: { glyph: "users-three", tone: STEP_TONE },
  signup: { glyph: "identification-badge", tone: STEP_TONE },
  form_submitted: { glyph: "clipboard", tone: STEP_TONE },
  paid_client: { glyph: "currency-dollar", tone: STEP_TONE },
  // A BUYER PAYING ON THE WEBSITE: an outcome a visitor can press has to wear a tile.
  purchase: { glyph: "shopping-bag-open", tone: STEP_TONE },
};

/**
 * The lead panel's stage keys (`lead-stages.ts`) in the producer's step vocabulary.
 * Three differ in spelling; `form_submission` is the producer's one form step.
 */
export const STEP_KEY_FOR_LEAD_STAGE: Record<string, string> = {
  positive_reply: "conversation",
  website_visit: "website_visit",
  meeting_booked: "meeting_booked",
  meeting_attended: "meeting_attended",
  signup: "signup",
  form_submission: "form_submitted",
  sale: "paid_client",
};

/** The tile for a step, or null for one this app has not drawn. */
export function stepMarkFor(stepKey: string | null | undefined): StepMark | null {
  if (!stepKey) return null;
  return STEP_MARKS[canonicalStepKey(stepKey)] ?? null;
}

/**
 * The two form steps that existed until 2026-09-18 (`form_filled` on the brand's own
 * site, `lead_form_submitted` on the ad platform) are ONE step now, `form_submitted`.
 * features-service reads both old spellings as the new one; so does this app, so a
 * body written before the merge still draws the tile.
 */
export const RETIRED_FORM_STEP_KEYS: Readonly<Record<string, string>> = {
  form_filled: "form_submitted",
  lead_form_submitted: "form_submitted",
};

export function canonicalStepKey(stepKey: string): string {
  return RETIRED_FORM_STEP_KEYS[stepKey] ?? stepKey;
}

/** The tile for a lead-panel stage, through the vocabulary map above. */
export function stepMarkForLeadStage(stageKey: string | null | undefined): StepMark | null {
  if (!stageKey) return null;
  return stepMarkFor(STEP_KEY_FOR_LEAD_STAGE[stageKey]);
}
