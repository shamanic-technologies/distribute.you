/**
 * What KIND of reply arrived, and nothing about how far the deal got.
 *
 * Mirrors instantly-service's own vocabulary (`src/lib/reply-kind.ts`, v0.74.0) value
 * for value. It owns this list; this file is a rendering of it, so when it widens, this
 * widens — do NOT invent a value here.
 *
 * Why it is separate from the funnel stages next to it: a reply is a fact about a
 * MESSAGE, and a booked meeting or a paid client is a fact about the DEAL. They used to
 * share one statement per lead and only the latest survived, so a lead who replied
 * positively and then booked read as having no reply sentiment at all — stating one
 * fact destroyed the other. Kept apart, neither can overwrite the other.
 *
 * The positive case splits four ways because "positive" alone cannot separate
 * "interested but not the buyer" from "wants to book", which is the distinction the
 * person reading the reply actually acts on.
 *
 * Alias-free so it carries real unit tests. Keep it that way.
 */

export type ReplyKind =
  | "lead_interested"
  | "lead_referral"
  | "lead_info_requested"
  | "lead_meeting_requested"
  | "lead_not_interested"
  | "lead_wrong_person"
  | "lead_changed_job"
  | "lead_neutral"
  | "lead_out_of_office"
  | "auto_reply_received";

export type ReplyTone = "positive" | "negative" | "neutral" | "automated";

export interface ReplyKindOption {
  kind: ReplyKind;
  /** What a customer reads. Written from the PROSPECT's side, not ours. */
  label: string;
  tone: ReplyTone;
}

/**
 * Ordered as a person triages: the reply they want, then the ones they don't, then the
 * ones that are not really replies at all.
 *
 * ⚠️ `lead_meeting_requested` is a REPLY fact — they asked for a call. It is NOT the
 * deal fact "a meeting exists on a calendar", which is the `meeting_booked` funnel
 * stage right below it in the same panel. Two different statements, deliberately, and
 * a reader can truthfully make both.
 *
 * ⚠️ The three NEGATIVE kinds are not equal, and the split is the producer's own:
 * `lead_not_interested` is a judgement about the OFFER at this MOMENT, so the person
 * stays reachable and the lead stays recyclable; `lead_wrong_person` and
 * `lead_changed_job` are objective facts about the PERSON and are permanent. Collapsing
 * a job change into "not interested" is what turns a "no" bucket into a dumping ground
 * and quietly loses recyclable pipeline. The board reads that split (see
 * `DISQUALIFYING_STATEMENT_KINDS` in `lead-board.ts`) and so does lead-service, which
 * is what decides whether a card leaves the Leads column.
 */
export const REPLY_KINDS: readonly ReplyKindOption[] = [
  { kind: "lead_interested", label: "Interested", tone: "positive" },
  { kind: "lead_info_requested", label: "Wants to know more", tone: "positive" },
  { kind: "lead_meeting_requested", label: "Wants to book", tone: "positive" },
  { kind: "lead_referral", label: "Not them, but points us on", tone: "positive" },
  { kind: "lead_not_interested", label: "Not interested", tone: "negative" },
  { kind: "lead_wrong_person", label: "Wrong person", tone: "negative" },
  { kind: "lead_changed_job", label: "Changed job", tone: "negative" },
  { kind: "lead_neutral", label: "Replied, said neither", tone: "neutral" },
  { kind: "lead_out_of_office", label: "Out of office", tone: "automated" },
  { kind: "auto_reply_received", label: "Automatic reply", tone: "automated" },
];

export const REPLY_TONE_ORDER: readonly ReplyTone[] = ["positive", "negative", "neutral", "automated"];

/** The heading a group of kinds sits under. */
export const REPLY_TONE_LABEL: Record<ReplyTone, string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
  automated: "Not a person",
};

/**
 * Pill classes per tone. Every tint is in the `html.dark` remap in globals.css — a
 * colour outside that closed set renders its light-mode near-white on the dark surface,
 * which is invisible in the light default and so ships unnoticed.
 */
export const REPLY_TONE_PILL: Record<ReplyTone, string> = {
  positive: "bg-green-50 text-green-700 border-green-200",
  negative: "bg-red-50 text-red-600 border-red-200",
  neutral: "bg-gray-100 text-gray-600 border-gray-200",
  automated: "bg-gray-100 text-gray-500 border-gray-200",
};

const BY_KIND = new Map(REPLY_KINDS.map((o) => [o.kind, o]));

/**
 * The option for a served value, or null when the producer sends something this build
 * does not carry.
 *
 * Null rather than a fabricated label: instantly-service owns the vocabulary and can
 * widen it before this app ships, so an unknown value means "a kind we do not render
 * yet", and the caller states that instead of inventing a name for it. The legacy
 * deal-progress spellings resolve upstream at WRITE time, so they never arrive here.
 */
export function replyKindOption(kind: string | null | undefined): ReplyKindOption | null {
  if (!kind) return null;
  return BY_KIND.get(kind as ReplyKind) ?? null;
}

/** The kinds of one tone, in catalogue order. */
export function replyKindsByTone(tone: ReplyTone): ReplyKindOption[] {
  return REPLY_KINDS.filter((o) => o.tone === tone);
}
