// The tile that stands for ONE STEP of a sales funnel, product-wide.
//
// A step is a THING a buyer reaches (a website visit, a signup, a paid client); a leg is
// the ARROW between two of them, and `funnel-leg-marks.ts` already draws every arrow.
// What had no mark was the step itself, and it is named on its own all over the product:
// the outcome a visitor picks on /start, each rung of a funnel's path, the rows of a
// lead's funnel progress, the two columns of a leg board. Half of those steps drew
// nothing, because the only tile available was the ENTRY leg's (`null -> step`), which
// exists for four of the eight.
//
// ONE glyph per step, the same wherever a step is named. The four steps that already had
// an entry leg keep that leg's glyph, deliberately: reaching a step from nothing IS
// reaching the step, and the outcome screen wore those four tiles before this catalogue
// existed. The other four are new and collide with no leg, no channel and no funnel.
//
// The KEY is the producer's own step token (`GET /public/channels` `steps[].key`); the
// lead panel's stage vocabulary spells three of them differently and is mapped below.
//
// Only value imports that carry no "@" alias live here, so this module stays directly
// unit-testable (vitest does not resolve the alias).

export type FunnelStepGlyph =
  | "hand-waving"
  | "cursor-click"
  | "calendar-plus"
  | "users-three"
  | "identification-badge"
  | "textbox"
  | "clipboard"
  | "currency-dollar";

export interface FunnelStepMark {
  glyph: FunnelStepGlyph;
  tone: { iconBg: string; iconText: string };
}

/** The same secondary tone every LEG wears: a step is a point on the same sequence. */
export const FUNNEL_STEP_TONE = { iconBg: "bg-purple-50", iconText: "text-purple-600" } as const;

/**
 * Every step the producer publishes today, in its own order. A step added upstream
 * shows up in `funnel-step-marks.test.ts` as a failing test, never as a blank tile.
 */
export const FUNNEL_STEP_MARKS: Record<string, FunnelStepMark> = {
  conversation: { glyph: "hand-waving", tone: FUNNEL_STEP_TONE },
  website_visit: { glyph: "cursor-click", tone: FUNNEL_STEP_TONE },
  meeting_booked: { glyph: "calendar-plus", tone: FUNNEL_STEP_TONE },
  meeting_attended: { glyph: "users-three", tone: FUNNEL_STEP_TONE },
  signup: { glyph: "identification-badge", tone: FUNNEL_STEP_TONE },
  form_submitted: { glyph: "clipboard", tone: FUNNEL_STEP_TONE },
  paid_client: { glyph: "currency-dollar", tone: FUNNEL_STEP_TONE },
};

/**
 * The lead panel's stage keys (`lead-funnel-stages.ts`) in the producer's step vocabulary.
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
export function funnelStepMarkFor(stepKey: string | null | undefined): FunnelStepMark | null {
  if (!stepKey) return null;
  return FUNNEL_STEP_MARKS[canonicalFunnelStepKey(stepKey)] ?? null;
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

export function canonicalFunnelStepKey(stepKey: string): string {
  return RETIRED_FORM_STEP_KEYS[stepKey] ?? stepKey;
}

/** The tile for a lead-panel stage, through the vocabulary map above. */
export function funnelStepMarkForLeadStage(stageKey: string | null | undefined): FunnelStepMark | null {
  if (!stageKey) return null;
  return funnelStepMarkFor(STEP_KEY_FOR_LEAD_STAGE[stageKey]);
}
