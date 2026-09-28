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
 * Which half of a pair a reader is shown. Every customer reads `mature`; a staff reader
 * can flip to `flash` to see today's raw figure (lib/use-stat-basis.ts). It is a VIEW
 * preference, never a second rule: flash is exactly what the producer served as flash.
 */
export type StatBasis = "mature" | "flash";

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
 * What a MATURE figure is, in one sentence a customer can restate. ONE constant behind
 * every tooltip that explains a mature cost or rate, so two surfaces cannot describe two
 * different rules. No number in it: the duration is the producer's, published per leg.
 */
export const MATURE_COST_NOTE =
  "It only counts outreach sent long enough ago for the answers to have arrived, together with every result those leads produced, so recent emails still waiting for a reply do not skew it.";

/**
 * What the tag says when the campaign that would have produced the outcomes is PAUSED.
 * A paused campaign lands nothing, so `Learning` there would state a process that is not
 * running; the word is the one the status pill already uses.
 */
export const PAUSED_NOTE =
  "This campaign is paused, so no new outcomes are landing and the figure cannot be priced. Restart it to keep measuring.";
