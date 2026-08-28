// The leads board: one column per step of the funnel, each lead in exactly ONE of them.
//
// The tabs this sits beside are NESTED SUBSETS — a lead that replied is also in
// Outreach — which is why the page has to dedupe them to count its own population. A
// board is a PARTITION: every lead appears once, in the furthest step it reached. That
// is a different statement about the same data, and it is the one a person moving work
// along actually reads.
//
// The columns are the funnel's own steps, through `leadFunnelStages`, so the board, the
// lead panel and the Sales Funnels settings card say the same words for the same step.
// Nothing here restates the funnel.
//
// Alias-free on purpose (its runtime import is relative and pulls no "@" alias in) so
// this module carries REAL unit tests. Keep it that way.

import { isWritableStage, leadFunnelStages, type LeadStageKey } from "./lead-funnel-stages";
import type { SalesFunnelKeyWire } from "./sales-funnels";

/**
 * WHERE a step's evidence comes from — the half of this the customer asked to see.
 *
 * A board that draws a human's statement and a machine's measurement identically
 * cannot answer "which of these did we update ourselves", which is the question
 * somebody working the board has about every card on it.
 *
 *   - `measured`  the delivery layer saw it happen (a reply arrived, a link was
 *                 clicked). Nobody typed it and nobody can.
 *   - `tracked`   the brand's own conversion tracker attributed it. Also automatic,
 *                 but it depends on the customer having wired the tracker, so it is
 *                 not the same promise as a delivery event.
 *   - `stated`    a person said so. These are the steps nothing can observe — a
 *                 meeting being attended has no signal anywhere in the fleet — and
 *                 they are exactly the ones a person moves a card into.
 *
 * A property of the STEP, not of the row: every lead's booked meeting is stated and
 * every lead's click is measured, so putting it on the column rather than on each card
 * says it once instead of N times.
 */
export type LeadStageSource = "measured" | "tracked" | "stated";

const SOURCE_FOR_STAGE: Record<LeadStageKey, LeadStageSource> = {
  positive_reply: "measured",
  website_visit: "measured",
  signup: "tracked",
  form_submission: "tracked",
  meeting_booked: "stated",
  meeting_attended: "stated",
  sale: "stated",
};

export function stageSource(key: LeadStageKey): LeadStageSource {
  return SOURCE_FOR_STAGE[key];
}

/** What a column is called on the board's own legend, per source. */
export const SOURCE_LABEL: Record<LeadStageSource, string> = {
  measured: "We measured it",
  tracked: "Your tracker reported it",
  stated: "Somebody said so",
};

/**
 * The column key. Every funnel step, plus the one column that is not a step.
 *
 * `outreach` holds the leads we contacted that have not reached the funnel's first
 * step yet. Without it they would be on no column at all, and the board would quietly
 * describe a smaller population than the page's own header counts — the same gap the
 * tabs already had to fix with `coveredLeads`.
 */
export type LeadBoardColumnKey = "outreach" | LeadStageKey;

export interface LeadBoardColumn {
  key: LeadBoardColumnKey;
  label: string;
  /** Null on `outreach`, which no step statement addresses. */
  source: LeadStageSource | null;
  /**
   * Whether a person can MOVE a card into this column.
   *
   * False for everything the machine owns: lead-service accepts a statement on five
   * of the seven steps, and a reply and a click are not among them (a reply's kind is
   * a fact about a message, a click is measured by the delivery layer). A column that
   * cannot take a card says so rather than accepting a drop and then failing.
   */
  writable: boolean;
}

/**
 * The board's columns for one funnel, left to right, or NOTHING when there is no single
 * funnel to walk.
 *
 * An absent funnel returns an empty list, exactly as `leadFunnelStages` does and for the
 * same reason: a brand runs several funnels at once, so there is no one order to lay a
 * board out in, and picking one would show every lead under a step half of them are not
 * even being sold through.
 */
export function leadBoardColumns(
  funnelKey: SalesFunnelKeyWire | null | undefined,
): LeadBoardColumn[] {
  const stages = leadFunnelStages(funnelKey);
  if (stages.length === 0) return [];
  return [
    { key: "outreach", label: "Contacted", source: null, writable: false },
    ...stages.map((stage) => ({
      key: stage.key,
      label: stage.label,
      source: stageSource(stage.key),
      writable: isWritableStage(stage.key),
    })),
  ];
}

/**
 * Which column a lead sits in: the FURTHEST step of this funnel it has reached.
 *
 * Furthest rather than most-recent, because a funnel is ordered and reaching a later
 * step means the earlier ones happened — that is the producer's own rule for an
 * implied step, and a board that put a lead back one column because the later signal
 * arrived first would contradict it.
 *
 * A lead reaching NO step of the funnel lands on `outreach` when we contacted it, and
 * is left OUT entirely when we have not: a lead served but never contacted has nothing
 * to show on a board about what happened to it, and inventing a column for it would
 * make the board disagree with the page's own count of the population.
 */
export function leadBoardColumnFor(
  columns: readonly LeadBoardColumn[],
  reached: Partial<Record<LeadStageKey, boolean>>,
  contacted: boolean,
): LeadBoardColumnKey | null {
  let furthest: LeadBoardColumnKey | null = null;
  for (const column of columns) {
    if (column.key === "outreach") continue;
    if (reached[column.key] === true) furthest = column.key;
  }
  if (furthest) return furthest;
  return contacted ? "outreach" : null;
}

/**
 * Which columns a card in `from` may be MOVED to.
 *
 * Every writable step of the funnel except the one it is already in. Deliberately not
 * "forward only": lead-service supersedes an earlier statement and decides for itself
 * what a later one implies, so a person correcting a step they got wrong is making a
 * statement like any other. Refusing it here would be this app deciding a rule the
 * producer owns — and the producer's 400 is what answers when a move really is
 * impossible.
 */
export function movableColumnsFrom(
  columns: readonly LeadBoardColumn[],
  from: LeadBoardColumnKey | null,
): LeadBoardColumn[] {
  return columns.filter((c) => c.writable && c.key !== from);
}
