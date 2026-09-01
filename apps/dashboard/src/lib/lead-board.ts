// The leads board: FIVE triage columns, each lead in exactly ONE of them.
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
// WHERE A LEAD STANDS IS NOT DECIDED HERE ANY MORE. It is `standing.state`, served per
// (lead, campaign) by lead-service, and this module renders it. What used to live here
// — which reply kinds mean interest, what disqualifies, whether an unsubscribe outranks
// a stated kind — was commercial policy held in three places at once (here,
// features-service's aggregate count, instantly-service's write-time classification),
// and that split had already put two different answers about one person on two
// surfaces. The producer is also FUNNEL-AWARE, which this could never be from a reply
// signal alone: on a campaign selling `form_magnet` the step being sold is a website
// visit, so 67 leads who clicked through stood at `sales_interest` while this file,
// reading replies, showed the column empty.
//
// Two things stayed OURS, because they are about this board and not about the person:
//
//   - **The columns.** Their labels, their order, their copy, and the fact that
//     Opt-out is one at all. lead-service folds an opt-out into `disqualified` (with
//     `signal: "unsubscribed"`), which is right for it — both are out of play. It is
//     not right HERE: an opt-out is the prospect's own act and legally binding
//     (CAN-SPAM, GDPR), so it can never share a column with a commercial judgement of
//     ours, and nothing of ours may record one on their behalf. Splitting the
//     producer's one state by the producer's OWN evidence field is a rendering
//     decision about our columns, not a second opinion about the lead.
//   - **The move picker.** Which kinds a person may STATE from each column. The write
//     is unchanged and still goes to instantly-service; see `columnReplyKinds`.
//
// A BOUNCE is NOT a disqualification, and that rule now lives at the producer where
// the rest of the policy does. A bad address says nothing about whether the human
// behind it would buy — it is a failure of DELIVERY, so the card stays in Leads and
// wears "Bounced" as its own tag, which is the thing worth acting on. lead-service
// v0.65.0 stopped reading a bounce as `disqualified` for exactly that reason
// (sales-lead-service#478). Note where the fix went: overriding it HERE would have
// re-created the three-way split this file exists to have closed.
//
// A plain "no" STAYS IN LEADS, and this is the rule the whole column exists for.
// Disqualified means one thing only: we realised this is not our target — the wrong
// contact, somebody who has left the role, a company that is not who we sell to. It is
// the ordinary sales qualification, and the owner's analogy for it is exact: we sell
// pears to supermarkets and we emailed somebody who works in construction. "Not
// interested" and "cannot buy right now" are judgements about the OFFER at this MOMENT,
// so those people are still reachable and the lead is still recyclable; folding them in
// here is what turns the column into a dumping ground and loses that pipeline silently.
// An opt-out has its own column and never sits here.
//
// That split is instantly-service's own — its vocabulary already separates the
// recyclable `lead_not_interested` from the permanent `lead_wrong_person` /
// `lead_changed_job` — and it is enforced by lead-service, which owns placement. This
// file states the columns and the picker; it does NOT re-decide who is out of play.
// The one thing to know if a plain "no" ever shows up here again: the fault is upstream
// (the fine kind not reaching lead-service), and overriding it here would re-create the
// three-way policy split this file exists to have closed.
//
// Alias-free on purpose (its runtime import is relative and pulls no "@" alias in) so
// this module carries REAL unit tests. Keep it that way.

import { REPLY_KINDS, type ReplyKind } from "./reply-kind";
import type { LeadStanding } from "./lead-standing";

/** The column key. Every lead the producer can place is in exactly one. */
export type LeadBoardColumnKey =
  | "contacted"
  | "sales_interest"
  | "disqualified"
  | "opt_out"
  | "unresolved";

export interface LeadBoardColumn {
  key: LeadBoardColumnKey;
  label: string;
  /** One line under the heading saying what lands here. */
  blurb: string;
  /**
   * Whether a person can MOVE a card into this column.
   *
   * A move here states a REPLY KIND — what this person said — so it is writable
   * wherever a human can honestly say it. Two are false and for different reasons:
   * `opt_out` because unsubscribing is the prospect's act and fabricating it on their
   * behalf would record a consent decision they never made, and `unresolved` because
   * it is the producer saying it could not answer, which is not a thing anybody can
   * assert their way into.
   */
  writable: boolean;
  /**
   * Whether the column is dropped from the rail when it holds nothing.
   *
   * Only `unresolved` is: it exists to report that the producer could not place some
   * leads, so drawing it on a healthy campaign advertises a problem that is not there.
   * The other four are the shape of the board and stay whether or not they have cards.
   */
  hideWhenEmpty: boolean;
}

export const LEAD_BOARD_COLUMNS: readonly LeadBoardColumn[] = [
  {
    // Keyed `contacted` and LABELLED "Leads": "Contacted" is one of the delivery
    // statuses a CARD can wear (beside Sent, Delivered, Bounced, Queued), so spending
    // the column's name on it made the heading and the cards under it argue about
    // what the word means. The column is simply everybody still in play.
    key: "contacted",
    label: "Leads",
    blurb: "Still in play, a no for now included. Nothing has happened yet, or nothing this campaign sells.",
    writable: true,
    hideWhenEmpty: false,
  },
  {
    key: "sales_interest",
    label: "Sales interest",
    blurb: "They reached the step this campaign sells, or bought.",
    writable: true,
    hideWhenEmpty: false,
  },
  {
    key: "disqualified",
    label: "Disqualified",
    blurb: "Not our target: wrong contact, they left the role, or the company is not who we sell to.",
    writable: true,
    hideWhenEmpty: false,
  },
  {
    key: "opt_out",
    label: "Opt-out",
    blurb: "They asked us to stop. We never contact them again.",
    writable: false,
    hideWhenEmpty: false,
  },
  {
    key: "unresolved",
    label: "Not placed",
    blurb: "We cannot say yet: this campaign states no sales funnel, or a signal could not be read.",
    writable: false,
    hideWhenEmpty: true,
  },
];

/**
 * The kinds a person may state to put a card in Sales interest.
 *
 * ⚠️ This is the WRITE picker, NOT how a card is placed. Placement is the producer's
 * (`leadBoardColumnFor`), and the producer decides where the card lands AFTER the
 * write — which is why a move can visibly not take: on a campaign whose funnel is
 * entered by a website visit, stating "Interested" is a positive reply, and a positive
 * reply is not the step that campaign sells, so lead-service answers `engaged` and the
 * card comes back to Contacted. That is the correct answer, not a bug to override.
 *
 * `lead_referral` is deliberately absent. "Not them, but points us on" is valuable and
 * it is not THIS person's interest; instantly-service projects it to `neutral` for the
 * same reason, so offering it here would offer a move nothing could honour.
 */
export const INTEREST_STATEMENT_KINDS: readonly ReplyKind[] = [
  "lead_interested",
  "lead_info_requested",
  "lead_meeting_requested",
];

/**
 * The kinds a person may state to put a card in Disqualified — an objective fact about
 * the person, never a judgement about the moment.
 *
 * BOTH are offered now. `lead_changed_job` sat here unrendered for a while — listed
 * ahead of this app's own catalogue, which is what the bare-string type is for — so the
 * picker offered "Wrong person" alone and somebody who had simply left the role could
 * not be stated at all. `columnReplyKinds` filters against the catalogue, so a kind
 * listed early still cannot reach a picker until there is a label for it; keep that
 * filter, and when a kind is added upstream give it a label here in the same pass.
 *
 * What is NOT here, deliberately: `lead_not_interested`. A decline today is about the
 * offer at this moment, the person stays reachable, and stating it must leave the card
 * in Leads.
 */
export const DISQUALIFYING_STATEMENT_KINDS: readonly string[] = [
  "lead_wrong_person",
  "lead_changed_job",
];

/**
 * The kinds a person may STATE from each column, in catalogue order.
 *
 * Derived from the catalogue rather than re-listed, so a kind the producer adds shows
 * up in the picker of whichever column already claims it. `opt_out` and `unresolved`
 * offer none.
 */
export function columnReplyKinds(key: LeadBoardColumnKey): ReplyKind[] {
  if (key === "opt_out" || key === "unresolved") return [];
  return REPLY_KINDS.filter((o) => {
    if (key === "sales_interest") return INTEREST_STATEMENT_KINDS.includes(o.kind);
    if (key === "disqualified") return DISQUALIFYING_STATEMENT_KINDS.includes(o.kind);
    // Contacted takes what a person can honestly say and that leaves them in play. The
    // automated kinds are not statements anybody makes, so they are not offered.
    return (
      !INTEREST_STATEMENT_KINDS.includes(o.kind) &&
      !DISQUALIFYING_STATEMENT_KINDS.includes(o.kind) &&
      o.tone !== "automated"
    );
  }).map((o) => o.kind);
}

/** What the board needs to know about one lead to place it. Structural on purpose. */
export type LeadBoardStanding = Pick<LeadStanding, "state" | "signal">;

/**
 * Which column a lead sits in — a render of two served fields and nothing else.
 *
 * There is no ladder here and no reply kind: `state` is lead-service's answer, and
 * `signal` is read for exactly one thing, telling an opt-out apart from the other ways
 * of being out of play (see `LEAD_BOARD_COLUMNS`). `customer` folds into Sales interest
 * because a customer reached the step this campaign sells and then some — four triage
 * buckets have no room for a fifth verdict, and the blurb says so.
 *
 * `not_contacted` lands nowhere (`null`) and the lead is left off the board entirely:
 * there is nothing to show about what happened to it, and inventing a column would make
 * the board disagree with the page's own count of the population.
 *
 * An ABSENT standing (`null`/`undefined`) is a payload written before lead-service
 * v0.64.0 — a snapshot restored from disk, in practice, for the second before the poll
 * lands. It reads as `unresolved`, which states what is true: we cannot place this yet.
 * It deliberately does NOT fall back to a reply-signal rule of our own; a second
 * implementation kept alive for old payloads is the split this change exists to close.
 *
 * A state this build does not name reads as `unresolved` too. lead-service owns the
 * vocabulary and can widen it before this app ships, so the honest render for a word we
 * do not know is "we cannot place this", never the nearest column we happen to have.
 */
export function leadBoardColumnFor(
  standing: LeadBoardStanding | null | undefined,
): LeadBoardColumnKey | null {
  if (!standing) return "unresolved";
  switch (standing.state) {
    case "not_contacted":
      return null;
    case "contacted":
    case "engaged":
      return "contacted";
    case "sales_interest":
    case "customer":
      return "sales_interest";
    case "disqualified":
      // The producer's own evidence field, not a second opinion about the lead: an
      // opt-out is the prospect's act and gets its own column here.
      return standing.signal === "unsubscribed" ? "opt_out" : "disqualified";
    case "unresolved":
      return "unresolved";
    default:
      return "unresolved";
  }
}

/**
 * Which columns a card in `from` may be MOVED to.
 *
 * Deliberately not "forward only": these are triage states, not funnel rungs, so
 * correcting one a person got wrong is a statement like any other and the producer
 * supersedes the earlier one.
 *
 * Two columns let nothing out, and `writable: false` does not cover it — that only
 * stops a card ARRIVING:
 *
 *   - `opt_out`, because a lead who asked us to stop could otherwise be dragged back
 *     into play, which is the same consent decision we refuse to fabricate, made in
 *     the more dangerous direction.
 *   - `unresolved`, because a card is there when lead-service could not resolve the
 *     campaign's funnel — and without the funnel nothing anybody states moves it (its
 *     own ladder answers `unresolved` before it ever looks at a statement). Offering
 *     the move would offer a control that cannot take.
 */
export function movableColumnsFrom(from: LeadBoardColumnKey | null): LeadBoardColumn[] {
  if (from === "opt_out" || from === "unresolved") return [];
  return LEAD_BOARD_COLUMNS.filter((c) => c.writable && c.key !== from);
}

/**
 * Why a card cannot land in `to`, or null when it can.
 *
 * A drop is accepted EVERYWHERE — a target that silently refuses a drag reads as a
 * broken board rather than as a rule, so the drop lands, the move form opens, and the
 * form says what is missing. This is the sentence it says.
 *
 * Neither refusal is a preference. There is no unsubscribe value in the reply-kind
 * vocabulary instantly-service owns, so `columnReplyKinds("opt_out")` is empty and
 * there is literally nothing to write; and `unresolved` is lead-service reporting that
 * it could not answer, which no statement of ours makes it able to.
 */
export function columnMoveRefusal(to: LeadBoardColumnKey): string | null {
  if (to === "opt_out") {
    return "Only the prospect can opt out. It reaches us the way their reply does, and we never record it for them.";
  }
  if (to === "unresolved") {
    return "Nothing to state here. These leads are unplaced because this campaign states no sales funnel, which no answer about the person can settle.";
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
