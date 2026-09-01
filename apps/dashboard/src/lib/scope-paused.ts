import { rollupStatus, type ControlRow } from "./campaign-controls";

/**
 * Is this SCOPE stopped — brand, offer or funnel.
 *
 * A `Learning` tag says a figure is withheld because too few outcomes have landed. On a
 * scope where NOTHING is running, no outcome can land, so the tag promises a number that
 * cannot arrive until the customer restarts something. The honest word there is `Paused`,
 * which is exactly what the pill on that scope's own header already says: a page whose
 * header reads `Paused` while every figure under it reads `Learning` is one screen
 * contradicting itself.
 *
 * So the verdict is `rollupStatus`'s and nothing else — one campaign running makes the
 * scope active, and there is deliberately no third word for a scope where some run and
 * others do not (see the note on `ControlRollup`). Restating that rule here as
 * `rows.every(r => !r.running)` would be a second source for one answer, and the two
 * would drift the day the rollup gains a state.
 *
 * `none` is NOT paused. A scope with no campaign at all is UNMEASURED: there is nothing
 * to have an opinion about, so it keeps whatever it read before. "There is nothing here"
 * and "everything is stopped" are different statements.
 *
 * ⚠️ This REVERSES a note this repo carried since #3716, which said brand and offer grain
 * were deliberately untouched because "several campaigns sit under one heading and no
 * single status answers for them". `rollupStatus` answered that question afterwards, and
 * it is the answer the headers at those grains already render.
 */
export function scopeIsPaused(rows: readonly { running: boolean }[]): boolean {
  return rollupStatus(rows) === "paused";
}

/**
 * The same verdict per OFFER, for a table that lists several at once.
 *
 * Hooks are not loopable, so a row cannot ask for its own scope — the map is built once
 * from the brand's rows and read per row, the same shape `useOfferLearning` uses for the
 * learning half of the same cell.
 *
 * A campaign carrying no offer belongs to none and is left out rather than folded into
 * whichever offer the reader happens to be looking at — the rule `buildControlRows`
 * already applies to its own offer filter.
 */
export function pausedByOffer(rows: readonly ControlRow[]): Map<string, boolean> {
  return groupPaused(rows, (row) => row.offerId);
}

/**
 * The same verdict per SALES FUNNEL, keyed on the funnel the campaign's money is keyed
 * on (`scope.def.key`) rather than on the raw wire spelling — the wire carries two
 * spellings of every funnel, and matching the raw string would silently read empty for
 * whichever half the producer happens to be emitting.
 *
 * A campaign that predates the funnels names none, so it belongs to no funnel's verdict
 * rather than to whichever one the reader is looking at.
 */
export function pausedByFunnel(rows: readonly ControlRow[]): Map<string, boolean> {
  return groupPaused(rows, (row) => row.scope?.def.key ?? null);
}

function groupPaused(
  rows: readonly ControlRow[],
  keyOf: (row: ControlRow) => string | null,
): Map<string, boolean> {
  const byKey = new Map<string, { running: boolean }[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const held = byKey.get(key) ?? [];
    held.push({ running: row.running });
    byKey.set(key, held);
  }
  const map = new Map<string, boolean>();
  for (const [key, group] of byKey) map.set(key, scopeIsPaused(group));
  return map;
}

/**
 * Read one entry out of either map.
 *
 * Absent means the scope has NO campaigns, which is unmeasured rather than stopped — the
 * `none` case above, one grain down. An UNSETTLED read is likewise "we cannot tell", and
 * both fall back to `false`, i.e. to exactly what the surface read before this existed.
 * Claiming `Paused` on a read still in flight would flash the wrong word on every load.
 */
export function scopePausedFor(
  map: Map<string, boolean>,
  key: string | null | undefined,
  settled: boolean,
): boolean {
  if (!settled || !key) return false;
  return map.get(key) ?? false;
}
