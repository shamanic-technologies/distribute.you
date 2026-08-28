"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LONG_PRESS_MS,
  isRealMove,
  railScrollStep,
  showsDropSlot,
  wandered,
} from "@/lib/board-drag";

/** A drag in flight: the card, and where the pointer is on screen. */
export interface BoardDragState<T> {
  card: T;
  x: number;
  y: number;
  /** The column key under the pointer, read off the document rather than tracked. */
  over: string | null;
}

/**
 * The pointer gesture EVERY kanban in the dashboard shares.
 *
 * The two boards write different things — the Leads board states a reply kind, the funnel
 * board states a step statement — so they keep their own move handlers and their own
 * cards. What they must not each own is the GESTURE: a person who learns hold-to-lift and
 * tap-to-open on one board has learned it on the other, and two copies of a pointer state
 * machine drift the first time either is touched.
 *
 * Four things it holds and no caller should re-derive:
 *
 *   - **ONE gesture, two actions, told apart by TIME.** A quick press that did not wander
 *     opens the card; a hold lifts it. Native `draggable` fires on no touch device and
 *     paints its ghost as a screenshot with square corners, which is why it is not used.
 *   - **Once a card is UP, the gesture belongs to the WINDOW, not to the card.** The card
 *     is replaced by its own outline the moment it lifts, so the element the press started
 *     on is gone and pointer capture with it; a `pointerup` handler living on a card then
 *     fires only if the pointer happens to come to rest on ANOTHER card, and a drop onto a
 *     column header — or onto the gap under the last card, which is most of a short
 *     column — is silently swallowed and the board stays stuck holding the card. Verified
 *     by reproduction, not by reading: a drop onto a column's header left the ghost up and
 *     wrote nothing.
 *   - **The column under the pointer is READ off the document** (`elementFromPoint` over a
 *     `data-board-column` attribute) rather than tracked per column, so a board can lay
 *     its columns out however it likes — a scrolling rail, a two-up grid — with no change
 *     here.
 *   - **The rail scrolls itself under a card held at its edge**, in a frame loop, because
 *     a finger parked at the edge emits no further move events. Boards whose columns all
 *     fit simply never attach the ref.
 */
export function useBoardDrag<T>({
  idOf,
  columnOf,
  canDrag,
  onDrop,
  onTap,
}: {
  idOf: (card: T) => string;
  columnOf: (card: T) => string;
  /** Whether this card can be picked up at all. A card that cannot is still tappable. */
  canDrag: (card: T) => boolean;
  /** A real move — the caller decides what to ask before writing anything. */
  onDrop: (card: T, columnKey: string) => void;
  onTap: (card: T) => void;
}) {
  const [drag, setDrag] = useState<BoardDragState<T> | null>(null);
  // The press being timed. A ref rather than state: it changes on every pointermove and
  // nothing on screen reads it until the hold actually fires.
  const press = useRef<{ card: T; x: number; y: number; timer: number } | null>(null);
  // The scrolling rail, and the live pointer position, for the edge auto-scroll. The
  // position is a ref because the loop reads it every frame and a state read there would
  // be one render behind.
  const rail = useRef<HTMLDivElement | null>(null);
  const at = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // The live drag, for the window listeners below: they are registered once per drag and
  // would otherwise close over the state of the render that registered them.
  const live = useRef<BoardDragState<T> | null>(null);
  live.current = drag;
  // Same reason for the callbacks: a listener registered on lift must call the CURRENT
  // handlers, not the ones that existed at lift time.
  const handlers = useRef({ onDrop, onTap, columnOf });
  handlers.current = { onDrop, onTap, columnOf };

  const clearPress = useCallback(() => {
    if (press.current) {
      window.clearTimeout(press.current.timer);
      press.current = null;
    }
  }, []);

  useEffect(() => clearPress, [clearPress]);

  const columnUnder = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    const section = el?.closest<HTMLElement>("[data-board-column]");
    return section?.dataset.boardColumn ?? null;
  };

  const dragging = drag != null;

  // While a card is up the whole gesture is the window's: the element it started on has
  // been replaced by its outline, so nothing on the board is guaranteed to see the
  // pointer again.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      at.current = { x: e.clientX, y: e.clientY };
      const current = live.current;
      if (!current) return;
      setDrag({ ...current, x: e.clientX, y: e.clientY, over: columnUnder(e.clientX, e.clientY) });
    };
    const up = () => {
      const current = live.current;
      setDrag(null);
      if (!current) return;
      const from = handlers.current.columnOf(current.card);
      if (isRealMove(from, current.over)) {
        handlers.current.onDrop(current.card, current.over as string);
      }
    };
    const cancel = () => setDrag(null);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    let raf = 0;
    const step = () => {
      const el = rail.current;
      if (el) {
        const box = el.getBoundingClientRect();
        el.scrollLeft += railScrollStep(at.current.x, { left: box.left, right: box.right });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dragging]);

  const onPointerDown = (card: T, e: React.PointerEvent) => {
    // Only the primary button picks a card up; a right-click is a context menu.
    if (e.button !== 0) return;
    const draggable = canDrag(card);
    const { clientX: x, clientY: y } = e;
    at.current = { x, y };
    const timer = window.setTimeout(() => {
      if (!draggable) return;
      press.current = null;
      setDrag({ card, x, y, over: columnOf(card) });
    }, LONG_PRESS_MS);
    press.current = { card, x, y, timer };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (live.current) return; // the window owns the gesture once the card is up
    at.current = { x: e.clientX, y: e.clientY };
    const p = press.current;
    if (!p) return;
    if (wandered({ x: p.x, y: p.y }, { x: e.clientX, y: e.clientY })) clearPress();
  };

  const onPointerUp = (card: T, e: React.PointerEvent) => {
    if (live.current) return; // the window's own handler resolves the drop
    const p = press.current;
    clearPress();
    if (p && !wandered({ x: p.x, y: p.y }, { x: e.clientX, y: e.clientY })) onTap(card);
  };

  const onPointerCancel = () => clearPress();

  return {
    drag,
    railRef: rail,
    /** True while THIS card is the one in the air — its slot renders as an outline. */
    isLifted: (card: T) => drag != null && idOf(drag.card) === idOf(card),
    /** True while this column should open the dashed slot the card would land in. */
    showsSlot: (columnKey: string) =>
      showsDropSlot(columnKey, drag ? { column: columnOf(drag.card), over: drag.over } : null),
    cardHandlers: (card: T) => ({
      onPointerDown: (e: React.PointerEvent) => onPointerDown(card, e),
      onPointerMove,
      onPointerUp: (e: React.PointerEvent) => onPointerUp(card, e),
      onPointerCancel,
    }),
  };
}
