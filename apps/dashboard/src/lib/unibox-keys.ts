/**
 * The Unibox keyboard (owner 2026-10-10): two panes, the people list on the left and
 * the open thread on the right.
 *
 * - In the list, Up/Down (and K/J) OPEN the previous/next person, starting from the
 *   person already open (never a separate cursor parked at the top).
 * - Right (L) moves to the thread, Left (H) back to the list.
 * - In the thread, Up/Down (K/J) scroll the conversation.
 * - `/` focuses the search; Down from the search opens the first person.
 *
 * Pure (no React, no DOM) so it carries real unit tests; the component applies the action.
 */
export type UniboxPane = "list" | "thread";

export type UniboxKeyAction =
  | { type: "open"; index: number }
  | { type: "pane"; pane: UniboxPane }
  | { type: "scroll"; direction: 1 | -1 }
  | { type: "search" };

export type UniboxKeyInput = {
  key: string;
  /** Focus is in a text field (the search, a message box). */
  typing: boolean;
  /** Focus is in the Unibox search field itself. */
  inSearch: boolean;
  /** A modifier is held (meta, ctrl, alt): never ours. */
  modified: boolean;
  pane: UniboxPane;
  /** A person is open in the thread (they may sit beyond the pages loaded so far). */
  hasOpen: boolean;
  /** Index of the open person in the loaded list, -1 when none is open or not loaded yet. */
  openIndex: number;
  count: number;
};

export function uniboxKeyAction(i: UniboxKeyInput): UniboxKeyAction | null {
  if (i.modified) return null;
  if (i.inSearch && i.key === "ArrowDown") return i.count > 0 ? { type: "open", index: 0 } : null;
  if (i.typing) return null;
  if (i.key === "/") return { type: "search" };
  const down = i.key === "ArrowDown" || i.key === "j";
  const up = i.key === "ArrowUp" || i.key === "k";
  if (i.pane === "thread") {
    if (down) return { type: "scroll", direction: 1 };
    if (up) return { type: "scroll", direction: -1 };
    if (i.key === "ArrowLeft" || i.key === "h") return { type: "pane", pane: "list" };
    return null;
  }
  if (i.key === "ArrowRight" || i.key === "l") return i.hasOpen ? { type: "pane", pane: "thread" } : null;
  if (i.count === 0) return null;
  if (down) {
    const next = i.openIndex < 0 ? 0 : Math.min(i.count - 1, i.openIndex + 1);
    return next === i.openIndex ? null : { type: "open", index: next };
  }
  if (up) {
    const prev = i.openIndex < 0 ? 0 : Math.max(0, i.openIndex - 1);
    return prev === i.openIndex ? null : { type: "open", index: prev };
  }
  return null;
}

/** How far one Up/Down press scrolls the thread, in pixels (about three lines of a message). */
export const THREAD_SCROLL_STEP = 80;
