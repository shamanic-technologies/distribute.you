/**
 * Choosing a Y-axis ceiling when one bar dwarfs the rest.
 *
 * Alias-free on purpose (no `@/…` imports) so vitest can resolve it and these
 * helpers get REAL unit tests rather than source-substring guards.
 *
 * Weekly net revenue retention starts with an enormous first bar: the first week
 * that has a prior cohort at all retains against a tiny base, so it lands in the
 * hundreds or thousands of percent. Scaling the axis to fit it squashes every
 * subsequent week into a strip near the floor, and the chart stops answering the
 * only question it exists for, which is whether the line sits above or below
 * 100.
 *
 * So the first bar is excluded from the ceiling and allowed to run off the top,
 * marked as clipped. That is honest as long as the reader can SEE it is clipped
 * and can still read the true value, which is why the mark is drawn and the
 * tooltip keeps the real number. Silently truncating a bar would be a lie.
 */

/** Headroom above the tallest included bar, so it does not touch the top edge. */
const HEADROOM = 1.15;

export interface ChartDomain {
  /** Axis ceiling. */
  max: number;
  /** Indices whose value exceeds `max` and therefore render clipped. */
  clippedIndices: number[];
}

/**
 * @param values every bar's value, in plot order
 * @param opts.excludeFirst leave the first bar out of the ceiling calculation
 * @param opts.floor a value the ceiling must always clear, e.g. the 100% line,
 *   so the reference stays on screen even when every bar sits below it
 */
export function chartDomain(
  values: number[],
  opts: { excludeFirst?: boolean; floor?: number } = {}
): ChartDomain {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { max: opts.floor ?? 1, clippedIndices: [] };

  // Excluding the first bar only makes sense when something remains to scale to.
  const considered =
    opts.excludeFirst && finite.length > 1 ? values.slice(1).filter((v) => Number.isFinite(v)) : finite;

  const tallest = Math.max(...considered, opts.floor ?? 0);
  // Round up to something a human reads as a tick rather than 1,247.
  const max = niceCeiling(tallest * HEADROOM);

  const clippedIndices = values
    .map((v, i) => (Number.isFinite(v) && v > max ? i : -1))
    .filter((i) => i >= 0);

  return { max, clippedIndices };
}

/** Round up to 1, 2 or 5 times a power of ten, the usual axis-tick grammar. */
export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}
