"use client";

/**
 * The stage hands a finished step to the journal rail through the View Transitions
 * API: the step's card on the stage and its entry in the rail carry the same
 * `view-transition-name`, so the browser morphs one into the other (the card shrinks
 * and flies into the rail). Where the API is missing, or motion is reduced, the
 * change simply happens and the entry rises in with `gs-in`.
 *
 * The page's root does NOT cross-fade (`html.gs-vt` turns it off in keel.css): only
 * the named pieces move, so nothing else on screen blinks.
 */

import { flushSync } from "react-dom";

type Transition = { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> };
type Doc = Document & { startViewTransition?: (cb: () => void) => Transition };

export function withStageTransition(update: () => void): void {
  const doc = typeof document === "undefined" ? null : (document as Doc);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Behind the wall the change just happens: a transition's snapshot would paint above it.
  const walled = doc?.documentElement.classList.contains(WALL_OPEN_CLASS) ?? false;
  if (!doc?.startViewTransition || reduced || walled || doc.visibilityState !== "visible") {
    update();
    return;
  }
  const root = doc.documentElement;
  root.classList.add("gs-vt");
  try {
    const t = doc.startViewTransition(() => flushSync(update));
    const clear = () => root.classList.remove("gs-vt");
    t.finished.then(clear, clear);
    // A newer transition skips this one, which rejects `ready`: that is not an error.
    t.ready.catch(() => {});
    t.updateCallbackDone.catch((e) => console.error("[get-started] stage update failed:", e));
  } catch (e) {
    root.classList.remove("gs-vt");
    console.warn("[get-started] view transition skipped:", e);
    update();
  }
}

/** Set on <html> while the account wall is open; the stage runs no transition then. */
export const WALL_OPEN_CLASS = "gs-wall-open";

/** The shared name of a step's stage card and its rail entry. */
export const stepViewName = (key: string) => `gs-step-${key}`;
