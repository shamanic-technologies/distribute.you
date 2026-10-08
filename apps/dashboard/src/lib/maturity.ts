import { z } from "zod";

/**
 * ONE statistic, served twice, and the producer's verdict on which one may be stated.
 *
 * features-service serves every ratio (a cost per outcome, a return, a CAC) as a PAIR
 * beside the legacy field (features-service#1196, `src/lib/maturity.ts` there):
 *
 * - `flash`  - everything to date, today's numbers.
 * - `mature` - the runs started long enough ago for their outcomes to have arrived (the
 *   per-leg maturity duration it publishes on the channel catalogue), divided by the
 *   outcomes of the leads those runs served, whenever those outcomes land.
 * - `isMature` - whether the mature figure rests on enough outcomes (the per-leg count it
 *   publishes). ONE value per scope, repeated in every pair of that scope.
 *
 * The dashboard DECIDES NOTHING here: no count threshold, no age cut, no fallback onto
 * spend. It reads the mature figure, and it states `Learning` exactly where the producer
 * says `isMature: false`. Two readers deciding "is this thin" on their own is how one
 * campaign came to show four different costs per positive reply on four screens.
 *
 * `isMature: null` is the producer's own "we cannot judge" (a degraded read, nothing in
 * scope, or a leg that counts no outcome): the mature value renders if there is one, "—"
 * otherwise, and no Learning tag, because nothing said it is thin.
 *
 * Alias-free (zod is a package, not an alias) so it carries real unit tests.
 */
export interface MaturityPair<T> {
  flash: T | null;
  mature: T | null;
  isMature: boolean | null;
}

/** The zod reader for a pair over `inner`. Every half is nullable, as served. */
export function maturityPairSchema<S extends z.ZodTypeAny>(inner: S) {
  return z.object({
    flash: inner.nullable(),
    mature: inner.nullable(),
    isMature: z.boolean().nullable(),
  });
}

/**
 * Which half of a pair a reader is shown: the one `autoStatBasis` picks for every customer
 * (the higher return, owner 2026-10-08); a staff reader can pin `mature` or `flash`
 * (lib/use-stat-basis.ts). Flash is exactly what the producer served as flash.
 */
export type StatBasis = "mature" | "flash";

/** What the reader asked for: a fixed half, or `auto` (every customer, and staff by default). */
export type StatBasisChoice = StatBasis | "auto";

/**
 * The `auto` basis (owner 2026-10-08): the whole dashboard reads the half whose RETURN is
 * the higher one, judged on the selected offer's return pair. Mature where it states the
 * higher (or equal) return; Flash where flash is higher. A mature half still Learning has
 * no return to compare, so flash wins only above break-even, the same bar `shownReturn`
 * already uses. No pair yet = mature.
 */
export function autoStatBasis<T extends { roiMultiple: number | null }>(
  pair: MaturityPair<T> | null | undefined,
): StatBasis {
  const flash = pair?.flash?.roiMultiple ?? null;
  if (flash == null || !Number.isFinite(flash)) return "mature";
  const mature = pair?.isMature === false ? null : pair?.mature?.roiMultiple ?? null;
  if (mature == null || !Number.isFinite(mature)) return flash > 1 ? "flash" : "mature";
  return flash > mature ? "flash" : "mature";
}

/** What a surface prints for one ratio: the value on the reader's basis, and whether it is Learning. */
export interface ShownFigure {
  value: number | null;
  /** True only when the producer said this scope is not mature, on the mature basis. */
  learning: boolean;
}

/**
 * The figure a surface states for one field of a served pair.
 *
 * - no pair (the producer did not answer, or the scope has no block) -> no value, no tag.
 * - `flash` basis -> the flash value verbatim; a flash figure is never tagged Learning,
 *   since the staff view exists to see what the tag withholds.
 * - `mature` basis -> `Learning` where `isMature` is false, the mature value otherwise.
 */
export function shownFigure<T>(
  pair: MaturityPair<T> | null | undefined,
  pick: (half: T) => number | null | undefined,
  basis: StatBasis,
): ShownFigure {
  if (!pair) return { value: null, learning: false };
  if (basis === "flash") return { value: pair.flash == null ? null : pick(pair.flash) ?? null, learning: false };
  if (pair.isMature === false) return { value: null, learning: true };
  return { value: pair.mature == null ? null : pick(pair.mature) ?? null, learning: false };
}

/**
 * The RETURN a surface states (owner 2026-10-03): the one exception to "not mature is
 * Learning". A scope still learning whose to-date return is already above break-even
 * shows that return; at or below 1x it stays `Learning`, since a thin figure under 1x
 * would read as a verdict. The to-date (flash) half is the conservative one: spend whose
 * outcomes have not landed yet pulls it down, never up.
 *
 * Every return on a brand page reads this, so one mission never shows `1.8×` on one
 * screen and Learning on another. Costs per outcome keep `shownFigure`.
 */
export function shownReturn<T extends { roiMultiple: number | null }>(
  pair: MaturityPair<T> | null | undefined,
  basis: StatBasis,
): ShownFigure {
  const shown = shownFigure(pair, (h) => h.roiMultiple, basis);
  if (!shown.learning) return shown;
  const toDate = pair?.flash?.roiMultiple ?? null;
  return toDate != null && Number.isFinite(toDate) && toDate > 1 ? { value: toDate, learning: false } : shown;
}

/**
 * Which half of the pair `shownReturn` states: the curve drawn under a return must be the
 * one whose last point IS that return (the mature curve under a flash figure read 1.3x
 * beside 1.6x). Null = no figure is shown (Learning, or no pair).
 */
export function shownReturnHalf<T extends { roiMultiple: number | null }>(
  pair: MaturityPair<T> | null | undefined,
  basis: StatBasis,
): "flash" | "mature" | null {
  if (!pair) return null;
  if (basis === "flash") return "flash";
  if (pair.isMature !== false) return "mature";
  const toDate = pair.flash?.roiMultiple ?? null;
  return toDate != null && Number.isFinite(toDate) && toDate > 1 ? "flash" : null;
}

/** Whether the producer said this scope is not mature. Null ("cannot judge") is not Learning. */
export function pairIsLearning(pair: { isMature: boolean | null } | null | undefined): boolean {
  return pair?.isMature === false;
}

/**
 * What a Learning tag says when a reader asks why there is no figure. No number is
 * written into it: the duration and the counts are the producer's, published per leg,
 * and a copy of them here would be a second rule waiting to drift from the first.
 */
export const MATURITY_LEARNING_NOTE =
  "Still learning: a price here only counts the runs old enough for their results to have arrived, and those runs have not produced enough results yet to state one. It appears as soon as they have.";

/**
 * What the tag says when the campaign that would have produced the outcomes is PAUSED.
 * A paused campaign lands nothing, so `Learning` there would state a process that is not
 * running; the word is the one the status pill already uses.
 */
export const PAUSED_NOTE =
  "This campaign is paused, so no new outcomes are landing and the figure cannot be priced. Restart it to keep measuring.";
