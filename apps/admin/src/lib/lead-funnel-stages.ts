/**
 * The stages of the ONE LEG a campaign is bought for, as a person states them about ONE
 * lead: the step the leg converts FROM (when it has one) and the step it lands ON.
 *
 * Twin of the customer dashboard's `lib/lead-stages.ts` `leadLegStages`. The sales
 * funnel this used to walk is retired fleet-wide (campaign-service dropped
 * `funnel_key`); a campaign is (offer x leg x channel), so the panel walks its leg.
 * Steps are keyed on the producer's step TOKEN, never on a label (labels are copy).
 *
 * Alias-free on purpose, so it carries real unit tests rather than source-substring
 * guards. Keep it that way.
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
 * The stages lead-service ACCEPTS a statement on, spelled exactly as it spells them.
 *
 * Deliberately narrower than `LeadStageKey`. A positive REPLY is a fact about a message,
 * stated on the reply itself (instantly-service owns that vocabulary), and it gets its
 * own control on the reply row. A website VISIT is a click the delivery layer measures.
 */
export const WRITABLE_STAGE_KEYS = [
  "signup",
  "meeting_booked",
  "meeting_attended",
  "form_submission",
  "sale",
] as const;

export type WritableStageKey = (typeof WRITABLE_STAGE_KEYS)[number];

export function isWritableStage(key: LeadStageKey): key is WritableStageKey {
  return (WRITABLE_STAGE_KEYS as readonly string[]).includes(key);
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
 * What is known about one stage. Spelled exactly as lead-service spells it, so nothing
 * translates at the boundary.
 *
 * `pending` is the ABSENCE of a statement, named explicitly by the producer rather than
 * inferred from an empty count: an outcome that has not arrived and a lead that is DEAD
 * at this stage used to read identically.
 *
 * `never` is terminal and is NOT an outcome. Nothing counts it, no stat moves.
 *
 * Transitions are NOT symmetric and the producer decides: an outcome on a stage marked
 * `never` supersedes it, while `never` on a stage that already happened is refused.
 * There is no write back to `pending` — a statement is corrected by making the other one.
 */
export type LeadStageState = "pending" | "outcome" | "never";

export interface LeadFunnelStage {
  key: LeadStageKey;
  label: string;
  wontLabel: string;
}

/**
 * Producer step token → stage. A token with no entry has no stage lead-service accepts a
 * statement on or renders (a direct purchase today), and is skipped rather than drawn.
 */
const STAGE_FOR_TOKEN: Record<string, { key: LeadStageKey; wontLabel: string; label?: string }> = {
  // `label` overrides what THIS panel calls the step, and exactly one step needs it: the
  // row already carries the reply's own KIND beside it, so "Replied" is the fact.
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

/**
 * The stages of the ONE leg a campaign performs, from → to. An ABSENT leg returns
 * NOTHING rather than guessed steps: a campaign that states no leg has no steps to walk.
 */
export function leadLegStages(
  leg: { fromKey: string | null; toKey: string; fromLabel: string | null; toLabel: string } | null | undefined,
): LeadFunnelStage[] {
  if (!leg) return [];
  const refs = [
    ...(leg.fromKey ? [{ key: leg.fromKey, label: leg.fromLabel }] : []),
    { key: leg.toKey, label: leg.toLabel as string | null },
  ];
  const stages: LeadFunnelStage[] = [];
  for (const ref of refs) {
    const stage = STAGE_FOR_TOKEN[ref.key];
    if (!stage) continue;
    if (stages.some((s) => s.key === stage.key)) continue;
    stages.push({ key: stage.key, label: stage.label ?? ref.label ?? stage.key, wontLabel: stage.wontLabel });
  }
  return stages;
}

export const LEAD_STAGE_KEYS: readonly LeadStageKey[] = [
  ...new Set(Object.values(STAGE_FOR_TOKEN).map((s) => s.key)),
];

/**
 * What we ALREADY measured about a lead. Declared structurally rather than importing a
 * producer's row type, so this module stays alias-free and a producer reshaping its row
 * does not reach in here.
 */
export interface LeadStageEvidence {
  repliedPositive?: boolean;
  clicked?: boolean;
  meetingBooked?: boolean;
  meetingAttended?: boolean;
  signup?: boolean;
  formSubmission?: boolean;
  purchased?: boolean;
}

/**
 * Which stages we can already see happened, without anyone stating them.
 *
 * Present ONLY when the evidence says `true`. A `false` and an absent field both mean
 * "we have not seen this", which is not "this did not happen".
 */
export function trackedStages(
  evidence: LeadStageEvidence | null | undefined,
): Partial<Record<LeadStageKey, boolean>> {
  if (!evidence) return {};
  const out: Partial<Record<LeadStageKey, boolean>> = {};
  if (evidence.repliedPositive === true) out.positive_reply = true;
  if (evidence.clicked === true) out.website_visit = true;
  if (evidence.meetingBooked === true) out.meeting_booked = true;
  if (evidence.meetingAttended === true) out.meeting_attended = true;
  if (evidence.signup === true) out.signup = true;
  if (evidence.formSubmission === true) out.form_submission = true;
  if (evidence.purchased === true) out.sale = true;
  return out;
}

/** Exactly one stage the producer refuses without an amount: the sale. */
export function stageRequiresValue(key: LeadStageKey): boolean {
  return key === "sale";
}

/**
 * What the person typed, as the cents lead-service takes — or null when it is not an
 * amount. Null is a REFUSAL to submit, never a zero: a deal worth nothing and a deal
 * nobody priced are the two things that must stay apart.
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
 * A refusal from lead-service, as a sentence a person can act on. NEVER the thrown
 * Error's own message field — `apiCall` sets that to the whole downstream body.
 */
export function leadStepErrorMessage(err: unknown): string {
  const status = (err as { status?: unknown } | null)?.status;
  const body = (err as { body?: unknown } | null)?.body;
  const upstream = body && typeof body === "object" ? (body as Record<string, unknown>).error : null;

  if ((status === 400 || status === 409) && typeof upstream === "string" && upstream.trim()) {
    return upstream.trim().slice(0, 400);
  }
  if (status === 409) return "That contradicts something already recorded for this step.";
  if (status === 403) return "This lead is not in your organization.";
  if (status === 404) return "This lead no longer exists.";
  return "Could not record that. Try again.";
}
