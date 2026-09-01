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
 */
export const REPLY_KINDS: readonly ReplyKindOption[] = [
  { kind: "lead_interested", label: "Interested", tone: "positive" },
  { kind: "lead_info_requested", label: "Wants to know more", tone: "positive" },
  { kind: "lead_meeting_requested", label: "Wants to book", tone: "positive" },
  { kind: "lead_referral", label: "Not them, but points us on", tone: "positive" },
  { kind: "lead_not_interested", label: "Not interested", tone: "negative" },
  { kind: "lead_wrong_person", label: "Wrong person", tone: "negative" },
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

/**
 * The pill each KIND wears — one colour per kind, not one per tone.
 *
 * The four-tone grouping is still what ORDERS the picker, but it cannot colour it: a
 * reader scanning a board sees four greens that mean four different things, and the
 * whole reason this vocabulary split four ways on the positive side is that "positive"
 * alone cannot separate "interested but not the buyer" from "wants to book".
 *
 * The hue tracks BUYING INTENT, warm-to-green as it deepens, and the ramp is the point:
 *
 *   emerald  wants to book        — asked for a time. The strongest thing a reply says.
 *   green    interested           — personally in.
 *   lime     wants to know more   — warm, not committed.
 *   violet   points us on         — real value, and NOT this person's intent, so it sits
 *                                   off the intent ramp entirely rather than at the
 *                                   bottom of it. instantly-service projects it to
 *                                   `neutral` for the same reason.
 *   slate    said neither         — they answered and it carried no signal.
 *   amber    not interested       — a no about the MOMENT. The lead is recyclable, so it
 *                                   is warned, not condemned.
 *   rose     wrong person         — a no about the PERSON. Permanent, hence the red end.
 *   stone    out of office / automatic reply — not a person at all, so the dimmest pair
 *                                   on the page and the only two that share a colour.
 *
 * Deliberately DISJOINT from the delivery-status palette (`leadStatusPill` in
 * `lib/lead-status.ts`), which is cool the whole way: that family is what we did and
 * what the machine measured, this one is what a person said. On a board card one
 * replaces the other, so a reader must never have to wonder which they are looking at.
 *
 * Every tint is answered by the `html.dark` layer — `tests/dark-accent-coverage.test.ts`
 * fails on one that is not.
 */
export const REPLY_KIND_PILL: Record<ReplyKind, string> = {
  lead_meeting_requested: "bg-emerald-100 text-emerald-700 border-emerald-200",
  lead_interested: "bg-green-100 text-green-700 border-green-200",
  lead_info_requested: "bg-lime-100 text-lime-700 border-lime-200",
  lead_referral: "bg-violet-100 text-violet-700 border-violet-200",
  lead_neutral: "bg-slate-100 text-slate-700 border-slate-200",
  lead_not_interested: "bg-amber-100 text-amber-700 border-amber-200",
  lead_wrong_person: "bg-rose-100 text-rose-700 border-rose-200",
  lead_out_of_office: "bg-stone-100 text-stone-600 border-stone-200",
  auto_reply_received: "bg-stone-100 text-stone-600 border-stone-200",
};

/**
 * The pill for a served value, falling back to the kind's TONE when this build does not
 * name it.
 *
 * The producer owns the vocabulary and can widen it, so a kind we cannot colour is not a
 * reason to draw nothing — the caller still has a label for it from `replyKindOption`,
 * or its own word for "stated, not shown here yet".
 */
export function replyKindPill(kind: string | null | undefined): string {
  const option = replyKindOption(kind);
  if (!option) return REPLY_TONE_PILL.neutral;
  return REPLY_KIND_PILL[option.kind] ?? REPLY_TONE_PILL[option.tone];
}

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
