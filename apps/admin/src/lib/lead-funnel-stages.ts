/**
 * The stages of ONE campaign's sales funnel, as a person states them about ONE lead.
 *
 * Twin of the customer dashboard's `lib/lead-funnel-stages.ts`, with ONE difference: the
 * dashboard derives each step list from `SALES_FUNNELS[key].steps`, its funnel catalogue.
 * This app has no such catalogue (the staff console is a deliberate fork and carries its
 * own settings surfaces), so the funnels are written out below.
 *
 * That literal copy is pinned by a guard in the DASHBOARD's suite — `FUNNEL_STEPS` here
 * must equal `SALES_FUNNELS`'s steps there, funnel for funnel and label for label. The
 * guard lives on that side on purpose: `apps/dashboard`'s tests are a CI merge gate and
 * this app's are not, so a drift caught there blocks a merge instead of rotting quietly.
 *
 * NOT keyed on the brand goal. `sales_meetings` covers both meeting funnels, so a goal
 * cannot say whether the funnel starts at a reply or at a website visit — the exact
 * distinction this panel exists to record.
 *
 * Alias-free on purpose, so it carries real unit tests rather than source-substring
 * guards. Keep it that way.
 */

/** The four funnel keys, in this app's short spelling. */
export type SalesFunnelKey = "reply_meeting" | "visit_meeting" | "visit_signup" | "visit_form";

/** The canonical spellings the wire uses. */
export type CanonicalSalesFunnelKey =
  | "sales_meetings_from_conversation"
  | "sales_meetings_from_website"
  | "website_purchases"
  | "form_magnet";

export type SalesFunnelKeyWire = SalesFunnelKey | CanonicalSalesFunnelKey;

/**
 * Each funnel's steps, base to terminal — the SAME labels the dashboard's catalogue
 * carries. Pinned equal by the dashboard-side guard; edit both or neither.
 */
export const FUNNEL_STEPS: Record<SalesFunnelKey, { name: string; steps: string[] }> = {
  reply_meeting: {
    name: "Sales Meeting from Conversation",
    steps: ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"],
  },
  visit_meeting: {
    name: "Sales Meeting from Website",
    steps: ["Website visit", "Meeting booked", "Meeting attended", "Paid client"],
  },
  visit_signup: {
    name: "Website Purchase",
    steps: ["Website visit", "Signup", "Paid client"],
  },
  visit_form: {
    name: "Form Magnet",
    steps: ["Website visit", "Form filled", "Paid client"],
  },
};

/**
 * Collapse any wire spelling onto the key the funnels are written on.
 *
 * THROWS on anything else rather than guessing a funnel — the column is
 * CHECK-constrained upstream, so a value arriving here that we cannot name is a
 * vocabulary drift worth seeing, not one to paper over with a plausible funnel.
 */
export function normalizeSalesFunnelKey(key: SalesFunnelKeyWire): SalesFunnelKey {
  switch (key) {
    case "reply_meeting":
    case "sales_meetings_from_conversation":
      return "reply_meeting";
    case "visit_meeting":
    case "sales_meetings_from_website":
      return "visit_meeting";
    case "visit_signup":
    case "website_purchases":
      return "visit_signup";
    case "visit_form":
    case "form_magnet":
      return "visit_form";
  }
  throw new Error(`Unmapped sales funnel key: ${key as string}`);
}

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

const STAGE_FOR_STEP: Record<string, { key: LeadStageKey; wontLabel: string; label?: string }> = {
  // `label` overrides what THIS panel calls the step, and exactly one step needs it.
  // The catalogue names the first leg "Positive reply" because a funnel is priced leg
  // by leg and that leg is the positive one; on a lead panel the row already carries
  // the reply's own KIND beside it (Interested, Wants to book, Not interested), so
  // "Positive reply" states as a heading the very thing the control next to it is
  // there to answer. "Replied" is the fact; the picker says what kind.
  "Positive reply": { key: "positive_reply", wontLabel: "Won't reply", label: "Replied" },
  "Website visit": { key: "website_visit", wontLabel: "Won't visit" },
  "Meeting booked": { key: "meeting_booked", wontLabel: "Won't book" },
  "Meeting attended": { key: "meeting_attended", wontLabel: "Won't attend" },
  Signup: { key: "signup", wontLabel: "Won't sign up" },
  "Form filled": { key: "form_submission", wontLabel: "Won't fill it" },
  "Paid client": { key: "sale", wontLabel: "Won't buy" },
};

/** The funnel's display name, for the line under the panel heading. */
export function funnelDisplayName(funnelKey: SalesFunnelKeyWire): string {
  return FUNNEL_STEPS[normalizeSalesFunnelKey(funnelKey)].name;
}

/**
 * The ordered stages of the campaign's funnel, base → terminal.
 *
 * An ABSENT funnel returns NOTHING rather than guessed steps — a campaign that states
 * no funnel has no steps to walk, and inventing one would show a staff member steps the
 * campaign never sold.
 */
export function leadFunnelStages(funnelKey: SalesFunnelKeyWire | null | undefined): LeadFunnelStage[] {
  if (!funnelKey) return [];
  const funnel = FUNNEL_STEPS[normalizeSalesFunnelKey(funnelKey)];
  const stages: LeadFunnelStage[] = [];
  for (const step of funnel.steps) {
    const stage = STAGE_FOR_STEP[step];
    if (!stage) {
      console.error(`[admin] lead-funnel-stages: no stage for step "${step}"`);
      continue;
    }
    stages.push({ key: stage.key, label: stage.label ?? step, wontLabel: stage.wontLabel });
  }
  return stages;
}

export const LEAD_STAGE_KEYS: readonly LeadStageKey[] = Object.values(STAGE_FOR_STEP).map((s) => s.key);

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
