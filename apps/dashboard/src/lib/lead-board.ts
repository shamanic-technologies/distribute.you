// The leads board: SIX triage columns, each lead in exactly ONE of them.
//
// The tabs this sits beside are NESTED SUBSETS — a lead that replied is also in
// Contacted — which is why the page has to dedupe them to count its own population. A
// board is a PARTITION: every lead appears once. That is a different statement about
// the same data, and it is the one a person working a list actually reads.
//
// It is a TRIAGE, and the question it answers is not "how far along is this lead" but
// "is this one still in play, and if not, why not". A step is stated on the lead's own
// panel, which is where the cost and the value of that step are asked for.
//
// WHERE A LEAD STANDS IS NOT DECIDED HERE ANY MORE. It is `standing.state`, served per
// (lead, campaign) by lead-service, and this module renders it. What used to live here
// — which reply kinds mean interest, what disqualifies, whether an unsubscribe outranks
// a stated kind — was commercial policy held in three places at once (here,
// features-service's aggregate count, instantly-service's write-time classification),
// and that split had already put two different answers about one person on two
// surfaces. The producer also knows which step each campaign sells, which this could
// never know from a reply signal alone: on a campaign whose leg lands on a website visit,
// 67 leads who clicked through stood at `sales_interest` while this file, reading
// replies, showed the column empty.
//
// Two things stayed OURS, because they are about this board and not about the person:
//
//   - **The columns.** Their labels, their order, their copy, and the fact that
//     Opt-out is one at all. lead-service folds an opt-out into `disqualified` (with
//     `signal: "unsubscribed"`), which is right for it — both are out of play. It is
//     not right HERE: an opt-out is the prospect's own act and legally binding
//     (CAN-SPAM, GDPR), so it can never share a column with a commercial judgement of
//     ours. Splitting the producer's one state by the producer's OWN evidence field is
//     a rendering decision about our columns, not a second opinion about the lead.
//   - **The move picker.** What a person may STATE from each column. Every column
//     states a reply KIND (`columnReplyKinds`) except Opt-out, which states the
//     CHANNEL somebody told us through — a different write to a different producer,
//     scoped to the person rather than to the campaign.
//
// A CARD MOVES BETWEEN ANY TWO COLUMNS, Opt-out included, in both directions. It used
// to be a dead end on the reasoning that unsubscribing is the prospect's own act and we
// must not fabricate one. The premise was wrong in both directions. Inbound: a prospect
// rarely clicks the link — they send an SMS, they call, they say it in person — and
// refusing to RECORD what they said is not protecting their consent, it is ignoring it
// while continuing to email them. Outbound: an opt-out gets recorded on the wrong
// person, and a prospect can come back, so a locked column left a database write as the
// only fix. What protects the person is not a locked column: it is that nothing INFERS
// an opt-out (a record exists because a named person stated it through a named
// channel), that leaving is an appended WITHDRAWAL rather than an erasure, and that a
// withdrawal resumes nothing that was stopped. The board says so before it does it.
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

import type { LeadStanding, LeadStandingState } from "./lead-standing";

/** The column key. Every lead the producer can place is in exactly one. */
export type LeadBoardColumnKey =
  | "contacted"
  | "sales_interest"
  | "won"
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
   * Only `unresolved` is false, and it is not a preference: that column is lead-service
   * reporting it could not answer, which is not a thing anybody can assert their way
   * into. Every other column is a statement somebody can honestly make.
   *
   * `opt_out` used to be false too, on the reasoning that unsubscribing is the
   * prospect's own act and we must not fabricate a consent decision on their behalf.
   * The premise was wrong: a prospect rarely clicks the link. They send an SMS, they
   * call, they say it in person — and refusing to RECORD what they said is not
   * protecting their consent, it is ignoring it while continuing to email them. What we
   * must never do is INFER one, and nothing does: a record exists because a named person
   * stated that a named prospect asked to stop, through a named channel.
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
    blurb: "Individuals we have identified as potential clients.",
    writable: true,
    hideWhenEmpty: false,
  },
  {
    key: "sales_interest",
    label: "Positive reply",
    blurb: "Leads who replied with interest.",
    writable: true,
    hideWhenEmpty: false,
  },
  {
    // The deal closed. It is the producer's `customer` standing, which used to fold into
    // Positive reply — right while the board was four buckets of "still in play or not",
    // and wrong the moment somebody wants to see what they actually WON. A won deal is
    // not a strong positive reply, it is the outcome every campaign exists to produce, and
    // burying it in the column above states one fact under another's name.
    key: "won",
    label: "Close won",
    blurb: "Leads who bought. Say what the deal was worth and whether our outreach caused it.",
    writable: true,
    hideWhenEmpty: false,
  },
  {
    key: "disqualified",
    label: "Disqualified",
    // The scope is what the reader is standing in, so the sentence names it rather
    // than assuming a campaign: this board renders at brand, offer and
    // campaign grain, and "not our target" is a judgement about ONE of those.
    blurb: "Individuals disqualified as leads for this {scope}.",
    writable: true,
    hideWhenEmpty: false,
  },
  {
    key: "opt_out",
    label: "Opt-out",
    blurb: "Leads who requested to be unsubscribed.",
    writable: true,
    hideWhenEmpty: false,
  },
  {
    key: "unresolved",
    label: "Not placed",
    blurb: "We cannot say yet: we could not tell what this campaign sells, or a signal could not be read.",
    writable: false,
    hideWhenEmpty: true,
  },
];

/** What the board needs to know about one lead to place it. Structural on purpose. */
export type LeadBoardStanding = Pick<LeadStanding, "state" | "signal">;

/**
 * Which column a lead sits in — a render of two served fields and nothing else.
 *
 * There is no ladder here, no reply kind and no second opinion: `state` is
 * lead-service's answer and the whole of it. An opt-out is its OWN state upstream now
 * (`opted_out`), so telling it apart from the other ways of being out of play is a
 * render of that word rather than a rule of ours over the deciding evidence — which is
 * what it used to be, and which quietly misfiled every opt-out into "Not placed" the
 * moment the producer split the state. `customer` has its OWN column (`won`): it used
 * to fold into Positive reply, which read a closed deal as a warm one.
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
      return "sales_interest";
    case "customer":
      // The last step is reached — the deal closed. Its own column since the
      // board grew one: folding it into Positive reply made a won deal read as a warm
      // one, which is the fact a person triaging a list most wants told apart.
      return "won";
    case "opted_out":
      return "opt_out";
    case "disqualified":
      // A person who asked us to stop reads `opted_out` upstream, so this is only ever
      // a judgement of ours. The pre-split spelling is still honoured below: a
      // `disqualified` row whose deciding evidence is an unsubscribe is an opt-out
      // however it is spelled, and reading it as an ordinary disqualification would
      // offer a move that puts somebody back in play who asked to be left alone.
      return standing.signal === "unsubscribed" ? "opt_out" : "disqualified";
    case "unresolved":
      return "unresolved";
    default:
      return "unresolved";
  }
}

/**
 * Which standings a column HOLDS — the inverse of `leadBoardColumnFor`, and the thing a
 * consumer asks the producer for when it draws one column at a time.
 *
 * There are seven standings and six columns, so ONE column holds two: a person nobody
 * has heard from and a person who did something this campaign does not sell are both
 * still in play. That is a decision about what somebody triaging a list needs to see
 * side by side, so it lives here rather than upstream.
 *
 * `not_contacted` is in NO column, deliberately: there is nothing to show about what
 * happened to a lead nobody wrote to, and giving it a column would make the board
 * disagree with the page's own count of the population.
 *
 * Kept in lockstep with `leadBoardColumnFor` by a guard that walks every standing
 * through both — a second table that could drift is exactly what this file exists to
 * avoid, so the two must be one statement read two ways.
 */
export const STANDINGS_BY_COLUMN: Record<LeadBoardColumnKey, readonly LeadStandingState[]> = {
  contacted: ["contacted", "engaged"],
  sales_interest: ["sales_interest"],
  won: ["customer"],
  disqualified: ["disqualified"],
  opt_out: ["opted_out"],
  unresolved: ["unresolved"],
};

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
