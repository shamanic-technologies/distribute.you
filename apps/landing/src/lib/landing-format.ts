/**
 * How the landing writes a return and a price.
 *
 * Both live here rather than beside their callers because each figure appears on
 * more than one surface — a return in the hero row, in the comparison band and on
 * a client's proof card; a price in the hero row and on a card — and two spellings
 * of one number on one page is the surface contradicting itself in miniature.
 */

/**
 * A return, in the units `main.js` counts up to.
 *
 * One decimal under 10x, a whole number from 10x up: under ten the decimal changes
 * how the figure reads (2.1 and 2.9 are different answers about a client), and at
 * thirty it is false precision on a number that moves several points a day. The
 * caller renders `decimals` beside the text because the count-up animation needs to
 * know how to format every frame, not just the last one.
 */
export function formatReturnMultiple(value: number): { text: string; decimals: number } {
  return value < 10
    ? { text: value.toFixed(1), decimals: 1 }
    : { text: String(Math.round(value)), decimals: 0 };
}

/**
 * A price a client paid for one outcome.
 *
 * Same shape as the return and for the same reason: at $4 the decimal is the
 * difference between two answers, at $1,224 it is noise on a figure that moves with
 * every outcome. It matches what the page shipped by hand on all three cards
 * ($1,159, $3.4, $95), so the reseed changes the number and never the way it reads.
 */
export function formatCostUsd(value: number): string {
  const rendered =
    value < 10
      ? value.toFixed(1)
      : Math.round(value).toLocaleString("en-US");
  return `$${rendered}`;
}
