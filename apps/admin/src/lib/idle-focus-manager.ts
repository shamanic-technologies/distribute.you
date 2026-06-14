import { focusManager } from "@tanstack/react-query";

// User AFK longer than this → treat the tab as unfocused so React Query pauses
// every refetchInterval. 2 min is conservative: long enough that a reading user
// isn't interrupted, short enough that an abandoned tab stops churning quickly.
export const IDLE_MS = 2 * 60_000;

// Interactions that count as "the user is here". `scroll`/`wheel`/`mousemove`
// are passive listeners so they never block the main thread.
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "wheel",
] as const;

/**
 * Pure focus decision: the app is "focused" only when the tab is visible AND the
 * user is not idle. Extracted so the transition logic is unit-testable without a DOM.
 */
export function computeFocused(
  visibilityState: DocumentVisibilityState,
  isIdle: boolean,
): boolean {
  return visibilityState === "visible" && !isIdle;
}

/**
 * Drive React Query's global `focusManager` from BOTH document visibility AND user
 * idleness — not visibility alone (the library default).
 *
 * Why: a dashboard tab left foreground-but-AFK keeps polling (`refetchInterval`,
 * 5s) forever. Each poll re-renders lists/charts/badges, mutating the DOM, which
 * feeds PostHog's rrweb recorder an unbounded mutation stream → Chrome renderer OOM
 * on long-lived tabs ("Aw Snap"). Reporting an idle user as unfocused pauses every
 * `refetchInterval` (our `refetchIntervalInBackground` is the v5 default `false`),
 * stopping the churn; any interaction or tab re-focus restores focus and
 * `refetchOnWindowFocus: true` refreshes immediately. Session recording stays fully
 * on — there is simply nothing happening on screen to record while idle.
 *
 * Call once globally. No-op on the server. Returns a teardown fn.
 */
export function installIdleFocusManager(idleMs: number = IDLE_MS): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }
  // Capture the globals now so the cleanup closure never does a bare lookup
  // (which could throw if it runs after teardown in some environments).
  const win = window;
  const doc = document;

  let cleanup: (() => void) | undefined;

  focusManager.setEventListener((handleFocus) => {
    let isIdle = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let done = false;

    const sync = () => handleFocus(computeFocused(doc.visibilityState, isIdle));

    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isIdle = true;
        sync();
      }, idleMs);
    };

    const markActive = () => {
      if (isIdle) {
        isIdle = false;
        sync();
      }
      armIdleTimer();
    };

    for (const event of ACTIVITY_EVENTS) {
      win.addEventListener(event, markActive, { passive: true });
    }
    doc.addEventListener("visibilitychange", sync);
    win.addEventListener("focus", markActive);

    // Establish the initial state + start the idle countdown.
    markActive();

    cleanup = () => {
      if (done) return;
      done = true;
      if (idleTimer) clearTimeout(idleTimer);
      for (const event of ACTIVITY_EVENTS) {
        win.removeEventListener(event, markActive);
      }
      doc.removeEventListener("visibilitychange", sync);
      win.removeEventListener("focus", markActive);
    };
    return cleanup;
  });

  return () => cleanup?.();
}
