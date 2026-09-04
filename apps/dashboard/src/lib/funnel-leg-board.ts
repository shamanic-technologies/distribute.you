// ONE ARROW of a funnel, laid out as two columns of leads.
//
// The Leads page's board is a TRIAGE — is this lead still in play, and if not why not —
// and it deliberately stopped being the funnel laid out as columns (#3677). This is the
// other question, asked one arrow at a time: WHO reached the step before, and who has
// crossed into this one. Moving a card across states that the lead crossed that arrow,
// which is the whole point of a leg the brand works itself: nothing measures a meeting
// somebody attended except the person who ran it.
//
// It is a different board rather than a mode of that one because the WRITE is different.
// The triage board states a REPLY KIND against a campaign; crossing a funnel arrow states
// a STEP STATEMENT, which lead-service refuses without a cost. The two cannot share a
// move handler, and the triage board's own comment says so.
//
// Only value imports that carry no "@" alias live here, so this module stays directly
// unit-testable (vitest does not resolve the alias).

import type { LeadStageKey } from "./lead-funnel-stages";

/**
 * A column of the arrow board.
 *
 * `stage` is null for the base of the FIRST arrow: a lead that has been contacted is on
 * no funnel step yet, and "Contacted" is the base every funnel converts from rather than
 * a rung of any of them. Everything else is one of the funnel's own stages.
 */
export interface LegBoardColumn {
  stage: LeadStageKey | null;
  label: string;
}

/** What the board needs of a lead. Structural, so nothing here imports a wire type. */
export interface LegBoardLead {
  /** The leads_campaigns row id — what a step statement is written against. */
  id: string;
  name: string;
  orgName: string | null;
  orgDomain: string | null;
  /** Whether this lead was contacted at all. The base column's own test. */
  contacted: boolean;
  /** The steps we already know this lead reached, however we came to know it. */
  reached: Partial<Record<LeadStageKey, boolean>>;
}

export interface LegBoardCard extends LegBoardLead {
  /** `from` = reached the step before and not this one. `to` = crossed the arrow. */
  side: "from" | "to";
}

/**
 * The most cards a column draws.
 *
 * A funnel's base column is every lead the brand ever contacted — 9,166 on the brand
 * this was built against — and a board of nine thousand cards is not a board. The cap is
 * STATED by the caller beside the column rather than applied quietly: a silent truncation
 * reads as "this is everybody", which is the one thing it is not.
 */
export const LEG_BOARD_COLUMN_CAP = 60;

/**
 * The two columns of an arrow: the step it moves a lead OUT of, and the step it moves it
 * TO.
 *
 * `stages` is the funnel's own stage list in order (`leadFunnelStages`), and `toIndex`
 * indexes it — the same index `funnelLegs` gives the arrow, so the two cannot drift.
 * Returns null for an index the funnel does not have, which is a URL naming an arrow of
 * some other funnel rather than an error to render.
 */
export function legBoardColumns(
  stages: readonly { key: LeadStageKey; label: string }[],
  toIndex: number,
): { from: LegBoardColumn; to: LegBoardColumn } | null {
  const to = stages[toIndex];
  if (!to) return null;
  const from =
    toIndex === 0
      ? { stage: null, label: "Contacted" }
      : { stage: stages[toIndex - 1].key, label: stages[toIndex - 1].label };
  return { from, to: { stage: to.key, label: to.label } };
}

/**
 * How many people each column HOLDS, as opposed to how many cards it draws.
 *
 * The board reads one bounded page per column now, so counting the rows in hand would
 * report the cap — "60 of 60" on an arrow that 9,166 people are standing at. These are
 * the producer's own bucket totals instead, which come back on the same two reads and
 * cost nothing extra.
 *
 * The `to` column is exact: it IS the to-bucket. The `from` column is the people at that
 * step who have NOT crossed, so it subtracts — and that rests on the funnel's own claim
 * that crossing an arrow means having been at the step before it. Where that claim does
 * not hold (a crossing recorded with the earlier evidence lost, which `legBoardSideFor`
 * deliberately allows) the subtraction understates, so it is floored at the number of
 * cards actually drawn: a column may never claim to hold fewer people than it is showing.
 *
 * A total the producer did not state falls back to the counted cards — "we were not told"
 * is not zero, and the honest reading is then just what is on screen.
 */
export function legBoardTotals({
  fromBucketTotal,
  toBucketTotal,
  counted,
}: {
  fromBucketTotal: number | null;
  toBucketTotal: number | null;
  counted: { from: number; to: number };
}): { from: number; to: number } {
  const to = toBucketTotal ?? counted.to;
  const from =
    fromBucketTotal == null
      ? counted.from
      : Math.max(counted.from, fromBucketTotal - (toBucketTotal ?? 0));
  return { from, to };
}

/**
 * Which side of the arrow a lead is on, or null when it is on neither.
 *
 * A lead that crossed is on the `to` side even if the step before was never recorded:
 * the crossing is the stronger statement, and a funnel that lost the earlier evidence
 * does not un-attend a meeting. A lead on neither side is not on this arrow at all and
 * draws no card — a board is a partition of the people it is about, not of everybody.
 */
export function legBoardSideFor(
  lead: LegBoardLead,
  columns: { from: LegBoardColumn; to: LegBoardColumn },
): "from" | "to" | null {
  if (lead.reached[columns.to.stage as LeadStageKey] === true) return "to";
  const fromReached =
    columns.from.stage === null
      ? lead.contacted
      : lead.reached[columns.from.stage] === true;
  return fromReached ? "from" : null;
}

/**
 * The cards of one arrow, capped per column.
 *
 * Order is the caller's — it hands the leads in whatever order it holds them, and the cap
 * takes the first of each side. Returns the counts BEFORE the cap so the board can say
 * how many it is not drawing: a column that shows 60 of 9,166 and does not say so is
 * claiming the funnel is smaller than it is.
 */
export function buildLegBoardCards({
  leads,
  columns,
  cap = LEG_BOARD_COLUMN_CAP,
}: {
  leads: readonly LegBoardLead[];
  columns: { from: LegBoardColumn; to: LegBoardColumn };
  cap?: number;
}): {
  from: LegBoardCard[];
  to: LegBoardCard[];
  totals: { from: number; to: number };
} {
  const from: LegBoardCard[] = [];
  const to: LegBoardCard[] = [];
  const totals = { from: 0, to: 0 };

  for (const lead of leads) {
    const side = legBoardSideFor(lead, columns);
    if (!side) continue;
    totals[side] += 1;
    const bucket = side === "from" ? from : to;
    if (bucket.length < cap) bucket.push({ ...lead, side });
  }

  return { from, to, totals };
}
