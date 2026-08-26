/**
 * When a cost per outcome is too thin to state as a number.
 *
 * A cost per outcome is spend divided by a count, so at one or two outcomes it is
 * dominated by whichever one happened to land: the figure moves by tens of dollars
 * on the next reply and reads to a customer as a price we are quoting. Below the bar
 * the surface says so — a `Learning` tag — instead of printing a number that will not
 * hold. Above it, features-service's own figure is rendered verbatim as always.
 *
 * Alias-free on purpose so it carries real unit tests rather than source-substring
 * guards; keep it that way (a runtime `@/…` import turns those into resolution failures).
 */

/** Outcomes a cost per outcome needs before it is stated as a number. */
export const LEARNING_MIN_OUTCOMES = 10;

/**
 * Whether the cost keyed on this outcome count is still learning.
 *
 * An ABSENT count (the producer does not measure this outcome, or the payload is cold)
 * counts as learning: we cannot show that a number is backed by enough outcomes, and
 * "we have no count" is not evidence that we have enough of them.
 */
export function isLearning(count: number | null | undefined): boolean {
  if (count == null) return true;
  return count < LEARNING_MIN_OUTCOMES;
}

/** What the tag says when a reader asks why there is no figure. */
export const LEARNING_NOTE = `Still learning: fewer than ${LEARNING_MIN_OUTCOMES} of these have landed, so any cost we printed would swing on the next one. The figure appears once there is enough to stand on.`;
