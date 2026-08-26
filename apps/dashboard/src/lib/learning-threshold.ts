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

/**
 * Whether a SCOPE that is sold by campaigns — an offer, or a brand — is still learning.
 *
 * A scope's money is its campaigns' money combined, so what makes it readable is whether
 * ANY ONE of them has produced enough outcomes to price. One measured campaign is enough:
 * the scope then rests on a real figure, however thin its siblings are. This is
 * deliberately not "does the scope's TOTAL clear the bar" — three campaigns at five
 * outcomes each are three unreliable prices, and adding them does not make one reliable.
 *
 * A scope with NO campaigns is not learning, it is unmeasured: there is nothing to have
 * an opinion about, so the surface reads exactly as it does today.
 */
export function scopeIsLearning(rows: readonly { learning: boolean }[]): boolean {
  if (rows.length === 0) return false;
  return rows.every((row) => row.learning);
}

/**
 * Whether an AUDIENCE is still learning across the campaigns that worked it.
 *
 * Same shape as the scope rule one level up, applied to one audience: it clears the
 * moment ONE campaign has produced enough outcomes FROM THAT AUDIENCE to price it, and
 * stays until then. Counts from different campaigns are deliberately NOT added — an
 * audience at five replies in each of two campaigns has two unreliable prices, and the
 * table states a price per audience, not a pooled one.
 *
 * An audience NO campaign reports on has nothing to clear the bar with, so it is
 * learning. That is the opposite default from `scopeIsLearning` and deliberately so:
 * there, an empty list means the surface has no campaigns at all and nothing to say;
 * here, the campaigns exist and simply have no outcomes from this audience.
 */
export function audienceIsLearning(counts: readonly (number | null | undefined)[]): boolean {
  return counts.every((count) => isLearning(count));
}
