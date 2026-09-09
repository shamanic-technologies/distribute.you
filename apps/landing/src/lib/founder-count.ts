/**
 * How many founders the landing says love us, read rather than remembered.
 *
 * The line shipped as a hardcoded `Loved by 70+ founders` while the real number was
 * 71, and nothing refreshed it — the same freeze the client proof cards carried until
 * they went on the wire. It is a lower bound, so the direction it rots in is the
 * generous one (it can only ever understate us), which is exactly why nobody reports
 * it and why it survives.
 *
 * Alias-free on purpose so it carries real unit tests: its only job is arithmetic and
 * one string, and both are decisions somebody should be able to read back.
 */

/**
 * The floor a stated count is rounded down to.
 *
 * Owner-set ("mets des planchers de 10"). A round ten with a `+` is a claim that
 * cannot become an overclaim between two reads: at 71 people the page says 70+, at 79
 * it still says 70+, and it only moves once 80 have actually signed up. A precise
 * `71 founders` would be truer for an afternoon and wrong for the rest of the week.
 */
export const FOUNDER_COUNT_FLOOR = 10;

/**
 * The floored count, or null when there is nothing honest to state.
 *
 * Below one floor the answer is `0+`, which reads as nobody at all — worse than the
 * figure the page ships with — so it is refused rather than rendered. A non-finite or
 * negative total is refused for the same reason: a count we could not read is not a
 * count of zero.
 */
export function foundersFloor(total: number): number | null {
  if (!Number.isFinite(total) || total < FOUNDER_COUNT_FLOOR) return null;
  const floored = Math.floor(total / FOUNDER_COUNT_FLOOR) * FOUNDER_COUNT_FLOOR;
  return floored > 0 ? floored : null;
}

/** The sentence itself, in one place, because two surfaces state it. */
export function foundersLine(floored: number): string {
  return `Loved by ${floored.toLocaleString("en-US")}+ founders`;
}

/**
 * Restate the trust rows from a count we just read, leaving the page alone when we
 * could not read one.
 *
 * Keyed on `data-founder-count`, not on the sentence: a literal in the markup is a
 * SEED, and matching on it would make the reseed stop working the first time the count
 * crossed a floor. The shipped literal stays inside the element, so a failed read, an
 * unmeasurable total or a page that carries no such element all render exactly what
 * they rendered before — never a blank, never a zero.
 */
export function reseedFounderCount(html: string, total: number): string {
  const floored = foundersFloor(total);
  if (floored === null) return html;
  const line = foundersLine(floored);
  return html.replace(
    /(<span data-founder-count[^>]*>)[\s\S]*?(<\/span>)/g,
    (_match, open: string, close: string) => `${open}${line}${close}`
  );
}
