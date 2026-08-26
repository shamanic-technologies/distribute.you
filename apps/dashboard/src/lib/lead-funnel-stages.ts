/**
 * The stages of ONE campaign's sales funnel, as a person states them about ONE lead.
 *
 * This is the human chain, not the measured one. `goal-steps.ts` answers "which steps
 * carry a stat" — it stops at the funnel's measured outcome, so a reply-led funnel ends
 * at `sales_meetings` and never mentions the meeting being attended or the client
 * paying. Those two are real stages of the chain a person walks a lead through; they
 * simply have no automatic signal, which is exactly why a human has to state them.
 *
 * So the source here is `SALES_FUNNELS[key].steps` — the SAME chain the Sales Funnels
 * settings card renders and the same one brand-service prices leg by leg. One
 * vocabulary: a stage reads the same words on the settings card and on the lead panel,
 * and a funnel added to the catalogue is offered here for free.
 *
 * NOT keyed on the brand goal. `sales_meetings` covers both meeting funnels, so a goal
 * cannot say whether the chain starts at a reply or at a website visit — the exact
 * distinction this panel exists to record. A campaign has stated its `funnelKey` since
 * #3344, so there is nothing to fall back to.
 *
 * Alias-free on purpose (its one runtime import is relative, and `sales-funnels.ts`'s
 * own `@/lib/api` import is type-only, so it erases) — this module carries REAL unit
 * tests rather than source-substring guards. Keep it that way.
 */
import { normalizeSalesFunnelKey, SALES_FUNNELS, type SalesFunnelKeyWire } from "./sales-funnels";

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
 * Deliberately narrower than `LeadStageKey`. Two stages of the human chain are not on
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
 * A won deal is the one place in the whole chain where estimating has no excuse. With
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

export interface LeadFunnelStage {
  key: LeadStageKey;
  /** Verbatim from the funnel catalogue, so the panel and the settings card agree. */
  label: string;
  /** What the terminal "this will never happen" reads as for THIS stage. */
  wontLabel: string;
}

/**
 * Catalogue step label → stage. The mapping is exhaustive over every label the four
 * funnels use; `leadFunnelStages.test.ts` walks the whole catalogue and fails if a
 * step label has no entry, so a new funnel cannot ship a stage this panel silently
 * drops. Matching on the label rather than restating each funnel's chain is what
 * keeps ONE chain: a catalogue edit reaches here without a second list to remember.
 */
const STAGE_FOR_STEP: Record<string, { key: LeadStageKey; wontLabel: string }> = {
  "Positive reply": { key: "positive_reply", wontLabel: "Never replying" },
  "Website visit": { key: "website_visit", wontLabel: "Never visiting" },
  "Meeting booked": { key: "meeting_booked", wontLabel: "Never booking" },
  "Meeting attended": { key: "meeting_attended", wontLabel: "Never attending" },
  Signup: { key: "signup", wontLabel: "Never signing up" },
  "Form filled": { key: "form_submission", wontLabel: "Never filling it" },
  "Paid client": { key: "sale", wontLabel: "Never buying" },
};

/**
 * The ordered stages of the campaign's funnel, base → terminal.
 *
 * An ABSENT funnel returns NOTHING rather than a guessed chain. That is the brand-level
 * case by construction: a brand runs several funnels at once, so there is no single
 * chain to walk a lead through and the panel states nothing instead of picking one.
 *
 * A funnel key the catalogue does NOT carry THROWS, via `normalizeSalesFunnelKey` — the
 * same contract `campaignFunnel` honours. That is deliberate and documented at the
 * catalogue: the column is CHECK-constrained upstream, so an unknown value is a
 * vocabulary drift worth seeing, not one to paper over with a plausible chain. Absent
 * and unknown are different statements and must not collapse onto one another.
 */
export function leadFunnelStages(funnelKey: SalesFunnelKeyWire | null | undefined): LeadFunnelStage[] {
  if (!funnelKey) return [];
  const normalized = normalizeSalesFunnelKey(funnelKey);
  const def = SALES_FUNNELS.find((f) => f.key === normalized)!;
  const stages: LeadFunnelStage[] = [];
  for (const step of def.steps) {
    const stage = STAGE_FOR_STEP[step];
    if (!stage) {
      // Fail loud. A catalogue step with no stage is a gap in THIS file, and the
      // unit test over the whole catalogue is what stops it reaching a customer.
      console.error(`[lead-funnel-stages] no stage for step "${step}" on funnel ${def.key}`);
      continue;
    }
    stages.push({ key: stage.key, label: step, wontLabel: stage.wontLabel });
  }
  return stages;
}

/**
 * Every stage key the catalogue can produce, in no particular order. Used by the guard
 * test and by any consumer that needs to enumerate the space rather than one funnel's
 * slice of it.
 */
export const LEAD_STAGE_KEYS: readonly LeadStageKey[] = Object.values(STAGE_FOR_STEP).map((s) => s.key);

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
