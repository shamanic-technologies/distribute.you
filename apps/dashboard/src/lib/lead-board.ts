// The leads board: FOUR triage columns, each lead in exactly ONE of them.
//
// The tabs this sits beside are NESTED SUBSETS — a lead that replied is also in
// Contacted — which is why the page has to dedupe them to count its own population. A
// board is a PARTITION: every lead appears once. That is a different statement about
// the same data, and it is the one a person working a list actually reads.
//
// It used to be the FUNNEL laid out as columns (Contacted -> Sales interest -> Meeting
// booked -> Meeting attended -> Paid client). It is a TRIAGE now, and the difference is
// the question it answers: not "how far down the funnel is this lead" but "is this one
// still in play, and if not, why not". A funnel rung is stated on the lead's own panel,
// which is where the cost and the value of that rung are asked for.
//
// The four columns come from the sales canon rather than from our own data model, and
// two splits in them are load-bearing:
//
//   - **Opt-out is not an opinion.** It is the prospect's own act and it is legally
//     binding (CAN-SPAM, GDPR), so it can never share a column with a commercial
//     judgement of ours. It is also the only column nobody can move a card into.
//   - **A "no" is not a disqualification.** Salesforce and Forrester both split the
//     negatives into permanent (this person can never buy: it is not their job, they
//     are not the decision maker) and temporary (not now, no budget yet, not
//     interested today) — and Forrester warns that a bucket holding both becomes a
//     dumping ground that quietly loses recyclable pipeline. So `Not interested` stays
//     in Contacted: in sales a no is the beginning of the conversation, and only an
//     OBJECTIVE fact about the person reaches Disqualified.
//
// A BOUNCE stays in Contacted for the same kind of reason: it is a failure of
// DELIVERY, not an opinion. A bad address says nothing about whether the human behind
// it is interested, so it is an address to repair rather than a lead to write off.
//
// Alias-free on purpose (its runtime import is relative and pulls no "@" alias in) so
// this module carries REAL unit tests. Keep it that way.

import { REPLY_KINDS, type ReplyKind } from "./reply-kind";

/** The column key. Four triage states, and every contacted lead is in exactly one. */
export type LeadBoardColumnKey = "contacted" | "sales_interest" | "disqualified" | "opt_out";

export interface LeadBoardColumn {
  key: LeadBoardColumnKey;
  label: string;
  /** One line under the heading saying what lands here. */
  blurb: string;
  /**
   * Whether a person can MOVE a card into this column.
   *
   * A move here states a REPLY KIND — what this person said — so it is writable
   * wherever a human can honestly say it. `opt_out` is the exception and stays false
   * on purpose: unsubscribing is the prospect's act, and fabricating it on their
   * behalf would record a consent decision they never made.
   */
  writable: boolean;
}

export const LEAD_BOARD_COLUMNS: readonly LeadBoardColumn[] = [
  {
    key: "contacted",
    label: "Contacted",
    blurb: "Reached, and still in play. A no and a bounce included.",
    writable: true,
  },
  {
    key: "sales_interest",
    label: "Sales interest",
    blurb: "They answered with real buying interest.",
    writable: true,
  },
  {
    key: "disqualified",
    label: "Disqualified",
    blurb: "This person cannot buy: wrong role, or they have moved on.",
    writable: true,
  },
  {
    key: "opt_out",
    label: "Opt-out",
    blurb: "They asked us to stop. We never contact them again.",
    writable: false,
  },
];

/**
 * The reply kinds that put a lead in Sales interest — the three where the prospect
 * expressed buying interest of their own.
 *
 * `lead_referral` is deliberately NOT here. "Not them, but points us on" is valuable
 * and it is not THIS person's interest, which is exactly the distinction the column
 * exists to make; Outreach's own taxonomy keeps Referral as its own class for the same
 * reason. It reads as Contacted, and the new lead it produces arrives as its own row.
 */
export const INTEREST_REPLY_KINDS: readonly ReplyKind[] = [
  "lead_interested",
  "lead_info_requested",
  "lead_meeting_requested",
];

/**
 * The reply kinds that DISQUALIFY — an objective fact about the person, never a
 * judgement about the moment.
 *
 * Typed as bare strings, and `lead_job_change` is listed BEFORE the producer serves it:
 * instantly-service owns this vocabulary, so the day it ships that value the column
 * fills with no change here. A value this build does not otherwise render resolves to
 * `null` through `replyKindOption`, so listing it early costs nothing and cannot
 * fabricate a label.
 */
export const DISQUALIFYING_REPLY_KINDS: readonly string[] = [
  "lead_wrong_person",
  "lead_job_change",
];

/**
 * The kinds a person may STATE from each column, in catalogue order.
 *
 * Derived from the catalogue rather than re-listed, so a kind the producer adds shows
 * up in the picker of whichever column already claims it. `opt_out` offers none.
 */
export function columnReplyKinds(key: LeadBoardColumnKey): ReplyKind[] {
  return REPLY_KINDS.filter((o) => {
    if (key === "sales_interest") return INTEREST_REPLY_KINDS.includes(o.kind);
    if (key === "disqualified") return DISQUALIFYING_REPLY_KINDS.includes(o.kind);
    if (key === "opt_out") return false;
    // Contacted takes what a person can honestly say and that leaves them in play. The
    // automated kinds are not statements anybody makes, so they are not offered.
    return (
      !INTEREST_REPLY_KINDS.includes(o.kind) &&
      !DISQUALIFYING_REPLY_KINDS.includes(o.kind) &&
      o.tone !== "automated"
    );
  }).map((o) => o.kind);
}

/** What the board needs to know about one lead to place it. */
export interface LeadTriage {
  /** We handed this lead to the sending provider. */
  contacted: boolean;
  /** They asked us to stop. Terminal, and it outranks everything else. */
  unsubscribed: boolean;
  /**
   * The FINE reply kind a person stated (instantly-service manual qualifications), or
   * null when nobody has. It OUTRANKS the coarse classification below: a machine
   * guessed that one and a human wrote this one.
   */
  replyKind: string | null;
  /** The coarse classification the delivery layer inferred, when nobody has stated one. */
  replyClassification: "positive" | "negative" | "neutral" | null;
}

/**
 * Which column a lead sits in.
 *
 * Precedence is opt-out, then disqualified, then interest, then contacted — each one
 * a stronger statement about the person than the one under it. Opt-out leads because
 * it is the only one that binds us: a lead who said they were interested and then
 * unsubscribed must not read as in play.
 *
 * A lead we have NOT contacted lands nowhere (`null`) and is left off the board
 * entirely: there is nothing to show about what happened to it, and inventing a column
 * would make the board disagree with the page's own count of the population.
 */
export function leadBoardColumnFor(lead: LeadTriage): LeadBoardColumnKey | null {
  if (lead.unsubscribed) return "opt_out";
  if (lead.replyKind && DISQUALIFYING_REPLY_KINDS.includes(lead.replyKind)) {
    return "disqualified";
  }
  if (lead.replyKind) {
    // A stated kind is the whole answer: it decides interest AND its absence, so a
    // human saying "not interested" is never overridden by a machine reading the same
    // message as positive.
    if (INTEREST_REPLY_KINDS.includes(lead.replyKind as ReplyKind)) return "sales_interest";
    return lead.contacted ? "contacted" : null;
  }
  if (lead.replyClassification === "positive") return "sales_interest";
  return lead.contacted ? "contacted" : null;
}

/**
 * Which columns a card in `from` may be MOVED to.
 *
 * Deliberately not "forward only": these are triage states, not funnel rungs, so
 * correcting one a person got wrong is a statement like any other and the producer
 * supersedes the earlier one.
 *
 * Opt-out is the exception, and it is the one that matters: a card cannot be moved OUT
 * of it either. `writable: false` only stops a card arriving; without this a lead who
 * asked us to stop could be dragged back into play, which is the same consent decision
 * we refuse to fabricate, made in the more dangerous direction. Somebody who opts back
 * in does it themselves, and it reaches us the same way the opt-out did.
 */
export function movableColumnsFrom(from: LeadBoardColumnKey | null): LeadBoardColumn[] {
  if (from === "opt_out") return [];
  return LEAD_BOARD_COLUMNS.filter((c) => c.writable && c.key !== from);
}

/**
 * Why a card cannot land in `to`, or null when it can.
 *
 * A drop is accepted EVERYWHERE now — a target that silently refuses a drag reads as
 * a broken board rather than as a rule, so the drop lands, the move form opens, and
 * the form says what is missing. This is the sentence it says.
 *
 * Opt-out is the only column with one, and the reason is not a preference: there is no
 * unsubscribe value in the reply-kind vocabulary instantly-service owns, so
 * `columnReplyKinds("opt_out")` is empty and there is literally nothing to write. A
 * picker that offered one would be fabricating a consent decision the prospect never
 * made.
 */
export function columnMoveRefusal(to: LeadBoardColumnKey): string | null {
  if (to === "opt_out") {
    return "Only the prospect can opt out. It reaches us the way their reply does, and we never record it for them.";
  }
  return null;
}

/**
 * How many cards a column draws before it asks.
 *
 * Contacted holds everybody the campaign ever reached — thousands on a live brand —
 * so a column that draws all of them is a page nobody can scroll past and a DOM
 * nothing needs. Twenty is roughly one column-height at 1280px, so the reveal costs a
 * press exactly when the reader has run out of cards rather than on arrival.
 */
export const LEAD_BOARD_PAGE_SIZE = 20;

/**
 * How many cards to draw in a column, and how many that leaves.
 *
 * A "Show more" button rather than infinite scroll, which is the convergent answer
 * across the pattern writing (Smashing, LogRocket, UX Collective) and across the
 * boards themselves (Trello loads a list twenty at a time behind a press): a board is
 * a set somebody is WORKING, not a feed they are grazing, so the reader decides when
 * to grow a column and the page never moves under them.
 *
 * The header count stays the WHOLE column, deliberately. It answers "how many are
 * here", which is the question the board is read for; the number this returns answers
 * "how many are on screen", which is a fact about the viewport. Collapsing the two
 * would make a column of 400 read as a column of 20.
 */
export function columnPage(total: number, shown: number): { visible: number; remaining: number } {
  const visible = Math.max(0, Math.min(total, shown));
  return { visible, remaining: Math.max(0, total - visible) };
}
