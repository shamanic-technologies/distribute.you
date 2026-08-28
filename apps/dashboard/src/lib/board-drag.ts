// ONE GESTURE for every kanban in the dashboard.
//
// Two boards move cards today — the Leads triage board and the funnel-arrow board — and
// they write different things (a reply kind against a campaign; a step statement against
// a leads_campaigns row). What they must NOT differ on is how a card is picked up, what
// a tap does, and what the reader sees while a card is in the air: a person who learns
// the gesture on one board has learned it on both.
//
// Everything here is the part that is decidable without a DOM. The hook that turns it
// into pointer handlers lives beside it in `components/boards/use-board-drag.ts`; this
// module stays alias-free so it carries real unit tests (vitest does not resolve "@").

/**
 * How long a press has to last before it picks the card up rather than opening it.
 *
 * ONE gesture, two actions, told apart by TIME. A quick press opens the lead; a hold
 * lifts the card. Native HTML5 `draggable` cannot do this — it fires on no touch device
 * at all, and its drag image is a screenshot the browser composites, which is where the
 * square white corners behind a rounded card come from.
 */
export const LONG_PRESS_MS = 350;

/**
 * How far a pointer may wander before the press is a SCROLL rather than a hold.
 *
 * Without it a board cannot be scrolled with a finger at all: every swipe that starts on
 * a card would lift it after 350ms.
 */
export const SLOP_PX = 8;

/** A point on screen. Structural, so nothing here imports a React or DOM type. */
export interface BoardPoint {
  x: number;
  y: number;
}

/**
 * Whether the pointer has moved far enough from where it went down to call the gesture a
 * scroll rather than a press.
 */
export function wandered(from: BoardPoint, to: BoardPoint, slop: number = SLOP_PX): boolean {
  return Math.abs(to.x - from.x) > slop || Math.abs(to.y - from.y) > slop;
}

/**
 * Whether a drop onto `over` is a real move for a card currently in `column`.
 *
 * Dropped back where it started is a CANCELLED drag, not a move — a board that opened its
 * "what happened?" form on a card the person put straight back would be asking about
 * something nobody did.
 */
export function isRealMove(column: string, over: string | null | undefined): boolean {
  return over != null && over !== column;
}

/**
 * Whether a column should show the dashed slot a held card would land in.
 *
 * The slot is what makes a drag legible: the source keeps its space as an outline so the
 * board does not reflow under the finger, and the target opens one so the reader sees
 * where the card is going BEFORE letting go. Same predicate as `isRealMove`, named for
 * the thing on screen so a caller reads it as layout rather than as a rule.
 */
export function showsDropSlot(
  columnKey: string,
  drag: { column: string; over: string | null } | null,
): boolean {
  if (!drag) return false;
  return drag.over === columnKey && isRealMove(drag.column, columnKey);
}

/**
 * How far the rail scrolls itself per frame while a card is held near its edge, and how
 * wide that edge is.
 *
 * Four 256px columns do not fit a phone, so most of the board is off-screen while a card
 * is up — and a target you cannot reach is a target the drag cannot use. A frame loop
 * rather than a scroll-per-move, because a finger parked at the edge emits no further
 * move events.
 */
export const RAIL_EDGE_PX = 56;
export const RAIL_SPEED_PX = 14;

/**
 * How much the rail should scroll this frame: negative to the left, positive to the
 * right, 0 when the pointer is nowhere near an edge.
 */
export function railScrollStep(
  pointerX: number,
  bounds: { left: number; right: number },
  edge: number = RAIL_EDGE_PX,
  speed: number = RAIL_SPEED_PX,
): number {
  if (pointerX > bounds.right - edge) return speed;
  if (pointerX < bounds.left + edge) return -speed;
  return 0;
}
