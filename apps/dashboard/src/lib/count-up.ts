/**
 * The arithmetic behind the reward pill's count-up, kept apart from React so it
 * carries real unit tests.
 *
 * Two decisions live here rather than in the component, because both are rules
 * about what an animation MEANS rather than about how it is wired:
 *
 * 1. **A count-up says something just happened.** The first value a surface
 *    ever sees is not an event — it is the page loading — so it lands
 *    instantly. Animating it would fire on every session, every reload, every
 *    restore from the on-disk cache, and a signal that fires when nothing
 *    happened teaches the reader to ignore it. `shouldAnimate` therefore needs
 *    a PREVIOUS value, and it refuses a first paint.
 *
 * 2. **Only an INCREASE is worth celebrating.** A total that goes down is not a
 *    thing this ledger does (grants are append-only), so a decrease is a
 *    correction or a re-read of a different org, and neither deserves confetti.
 *    It lands instantly too.
 *
 * Alias-free so it carries real unit tests. Do NOT add an `@/…` import.
 */

/** How long a count-up runs. Long enough to read as motion, short enough that
 *  a reader who glanced away has not missed it. */
export const COUNT_UP_MS = 900;

/**
 * Should a change from `previous` to `next` animate?
 *
 * `previous === null` is the first value this surface has seen — see (1) above.
 * Reduced motion is honoured by the caller rather than here, so this function
 * stays a pure statement about the VALUES.
 */
export function shouldAnimate(previous: number | null, next: number): boolean {
  if (previous === null) return false;
  return next > previous;
}

/**
 * Ease-out cubic: fast first, settling slowly onto the final figure.
 *
 * The settle is the point — a linear count-up reads as a spinner, while an
 * ease-out reads as a number arriving. `t` is clamped, so a caller that
 * overshoots the duration by a frame gets the final value rather than a figure
 * past the target.
 */
export function easeOutCubic(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - Math.pow(1 - clamped, 3);
}

/**
 * The value to display `elapsed` ms into a count-up from `from` to `to`.
 *
 * Rounded, because the pill renders whole dollars and a fractional cent count
 * would jitter the last digit for the whole animation. The final frame is
 * EXACTLY `to` — an animation that lands one cent short of the real total is a
 * wrong number on screen, however briefly, and the reader's eye stops on the
 * last frame.
 */
export function countUpValue(from: number, to: number, elapsed: number, durationMs = COUNT_UP_MS): number {
  if (durationMs <= 0 || elapsed >= durationMs) return to;
  const progress = easeOutCubic(elapsed / durationMs);
  return Math.round(from + (to - from) * progress);
}
