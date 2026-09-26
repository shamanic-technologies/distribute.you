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
 * The stages lead-service ACCEPTS a statement on, spelled exactly as it spells them.
 *
 * Deliberately narrower than `LeadStageKey`. Two stages are not on
 * this list and cannot be: a positive REPLY is a fact about a message, so it is stated
 * on the reply itself (instantly-service owns that vocabulary), and a website VISIT is
 * a click the delivery layer measures, which lead-service's outcome ledger has no entry
 * for. Both still RENDER, from the evidence we already hold, and neither offers a
 * control — a button that cannot write is worse than no button.
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
 * The stages lead-service REFUSES a statement on unless it says what the outcome was
 * worth. Exactly one: the sale.
 *
 * A won deal is the one place where estimating has no excuse. With
 * no amount, every money figure downstream — pipeline, return, cost of acquisition —
 * silently prices the deal at the brand's AVERAGE lifetime revenue, a number that
 * describes no real customer. Every other stage keeps the amount optional, because an
 * unusually large lead is worth flagging long before it closes.
 */
export function stageRequiresValue(key: LeadStageKey): boolean {
  return key === "sale";
}

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
 * What is known about one stage. Spelled exactly as lead-service spells it, so nothing
 * translates at the boundary — a second vocabulary for one concept is a second place
 * for the two to drift.
 *
 * `pending` is the ABSENCE of a statement, and lead-service names it explicitly rather
 * than leaving it to be inferred from an empty count. That is the whole point of the
 * endpoint: an outcome that has not arrived yet and a lead that is DEAD at this stage
 * used to read identically.
 *
 * `never` is terminal and is NOT an outcome. Nothing counts it, no stat moves, and it
 * is what lets a cost per acquisition mean anything while a campaign is still running.
 *
 * Transitions are NOT symmetric, and the producer decides: stating an outcome on a
 * stage already marked `never` supersedes it (the person did the thing after all, and
 * the response says so), while stating `never` on a stage that already happened is
 * refused. There is no write back to `pending` at all — a statement is corrected by
 * making the other one, not by retracting into silence.
 */
export type LeadStageState = "pending" | "outcome" | "never";

export interface LeadStage {
  key: LeadStageKey;
  /**
   * What this panel calls the step. The catalogue's own word by default; overridden
   * only where it reads wrong on a lead (see `STAGE_FOR_TOKEN`).
   */
  label: string;
  /** What the terminal "this will never happen" reads as for THIS stage. */
  wontLabel: string;
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

/** One step of a leg, as the catalogue names it. */
export interface LegStepRef {
  key: string | null;
  label: string | null;
}

/**
 * The stages of the ONE LEG a campaign performs: the step it converts FROM (when it has
 * one) and the step it lands ON. An ABSENT leg returns NOTHING rather than guessed
 * steps: that is the brand- and offer-level case, where several legs run at once.
 */
export function leadLegStages(
  leg: { fromKey: string | null; toKey: string; fromLabel: string | null; toLabel: string } | null | undefined,
): LeadStage[] {
  if (!leg) return [];
  const refs: LegStepRef[] = [
    ...(leg.fromKey ? [{ key: leg.fromKey, label: leg.fromLabel }] : []),
    { key: leg.toKey, label: leg.toLabel },
  ];
  const stages: LeadStage[] = [];
  for (const ref of refs) {
    const stage = ref.key ? STAGE_FOR_TOKEN[ref.key] : undefined;
    if (!stage) continue;
    if (stages.some((s) => s.key === stage.key)) continue;
    stages.push({ key: stage.key, label: stage.label ?? ref.label ?? stage.key, wontLabel: stage.wontLabel });
  }
  return stages;
}

/** Every stage key a step can map onto, in no particular order. */
export const LEAD_STAGE_KEYS: readonly LeadStageKey[] = [
  ...new Set(Object.values(STAGE_FOR_TOKEN).map((s) => s.key)),
];

/**
 * What we ALREADY measured about a lead, by whatever automatic means.
 *
 * Declared structurally rather than importing the producer's row type, so this module
 * stays alias-free and unit-testable, and so a producer reshaping its row does not
 * reach in here. The caller passes the fields off whichever payload it holds.
 *
 * Every field is optional and every one of them means three different things when
 * absent: not measured, not measurable, or a producer that does not serve it yet. All
 * three read the same downstream, which is why an absent field is never turned into
 * `false` below.
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
 * A stage is present in the map ONLY when the evidence says `true`. A `false` and an
 * absent field both mean "we have not seen this", which is not the same statement as
 * "this did not happen" — and the panel must not draw the second from the first.
 *
 * `meeting_attended` has no automatic source anywhere in the fleet today (brand-service
 * prices a booked-to-attended rate that nothing measures), so it will simply never
 * appear here until one exists. That is the honest reading, not a gap to fill in.
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

/**
 * A refusal from lead-service, as a sentence a person can act on.
 *
 * NEVER `err.message`: `apiCall` sets that to the whole downstream body verbatim, so
 * rendering it puts a JSON blob in front of a customer and destroys the `code` every
 * other consumer branches on. lead-service writes its 400 for a person to read (which
 * step already happened, why a value cannot ride a `never`), so that one sentence is
 * forwarded; every other status gets copy written here.
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

/**
 * The same, for a statement being TAKEN BACK.
 *
 * A separate sentence set because the generic one asserts the wrong thing on the way
 * out: "Could not record that" is about a write, and lead-service's 404 on the reply
 * withdrawal ("nothing stands") would otherwise read as "This lead no longer exists",
 * which sends somebody looking for a lead that is right in front of them.
 *
 * Both producers write their refusals as sentences for a person to read, so those pass
 * through verbatim; only the fallbacks are ours.
 */
export function leadStepWithdrawErrorMessage(err: unknown): string {
  const status = (err as { status?: unknown } | null)?.status;
  const body = (err as { body?: unknown } | null)?.body;
  const upstream = body && typeof body === "object" ? (body as Record<string, unknown>).error : null;

  if (
    (status === 400 || status === 404 || status === 409) &&
    typeof upstream === "string" &&
    upstream.trim()
  ) {
    return upstream.trim().slice(0, 400);
  }
  // Nothing stands, on either producer: nobody stated this, or it was already taken
  // back. Both mean the same thing to the person looking at it.
  if (status === 404 || status === 409) return "There is nothing here to take back.";
  if (status === 403) return "This lead is not in your organization.";
  return "Could not take that back. Try again.";
}
