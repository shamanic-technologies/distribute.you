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

/**
 * Round up to a readable multiple of a power of ten.
 *
 * The steps are deliberately finer than the classic 1/2/5/10 grammar. With only
 * those four, a series topping out at 255 gets a ceiling of 500 — the tallest
 * bar reaches half the plot and the rest are ankle-high for no reason other than
 * the rounding. Allowing 1.5, 2.5, 3 and 4 puts that same series on 300, which
 * is the number a reader expects to see.
 */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 10];

export function niceCeiling(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalised = value / magnitude;
  const step = NICE_STEPS.find((s) => normalised <= s) ?? 10;
  return step * magnitude;
}

/** At most this many labelled ticks, so the axis stays readable. */
const MAX_TICKS = 6;

/**
 * Y-axis ticks that land ON the reference value.
 *
 * Retention's whole question is whether a bar clears 100, so 100 has to be a
 * labelled tick and not a line floating between the automatic 150 and the
 * automatic 50. Ticks therefore step on the reference itself (coarsened to a
 * multiple of it when that would produce too many labels).
 *
 * Returns undefined when there is no reference to anchor to — the caller then
 * leaves the axis on its automatic ticks.
 */
export function referenceTicks(max: number, reference?: number): number[] | undefined {
  if (reference === undefined || !Number.isFinite(reference) || reference <= 0) return undefined;
  if (!Number.isFinite(max) || max <= 0) return undefined;
  // Ticks are ANCHORED on the reference and walk up from there, so coarsening the
  // step can never drop the one tick the axis exists to show.
  const step = reference * Math.max(1, Math.ceil((max - reference) / reference / (MAX_TICKS - 1)));
  const ticks = [0];
  for (let t = reference; t <= max + 1e-9; t += step) ticks.push(Number(t.toFixed(6)));
  return ticks;
}

/**
 * A Y-axis for a LINE chart of a run-rate, bracketing the data instead of
 * starting at zero.
 *
 * A bar chart must start at zero — the bar's LENGTH is the quantity, so a
 * clipped baseline lies about the ratio between bars. A line chart encodes the
 * SHAPE of a series and nothing about its area, and a run-rate that moves from
 * $37k to $47k renders as a flat line across the top third of a zero-based
 * plot: the axis wastes 78% of its height on a range the series never visits.
 * So the axis brackets the data with one step of headroom on each side, which
 * is what every run-rate card in the category does (ChartMogul, Baremetrics,
 * Stripe's own MRR view).
 *
 * The cost is real and worth naming: a non-zero baseline EXAGGERATES movement,
 * so this is only correct where the reader is asked about direction rather than
 * magnitude, and where the magnitude is stated in words beside the chart. Both
 * hold on the run-rate cards, which print the value above the plot.
 *
 * Never floors below zero: a run-rate cannot be negative, and an axis that
 * reaches into negative money invites a reading the data cannot support.
 */
export interface LineDomain {
  min: number;
  max: number;
  ticks: number[];
}

/** Gridlines a reader can count without effort; the screenshot reference uses ~7. */
const LINE_TICKS = 6;

/** Breathing room each side of the data, as a share of its own span. */
const LINE_PAD = 0.12;

/** Tick counts that still read as an axis rather than as a ladder or two marks. */
const MIN_LINE_TICKS = 4;
const MAX_LINE_TICKS = 9;

/** Nice steps around an ideal, one decade either side — the grammar jumps 5 → 10, so
 * rounding the ideal UP can halve the tick count (a 27.7k span asking for 5.5k gets
 * 10k and four gridlines). Candidates are SCORED on the tick count they produce
 * instead, which is the thing the axis is actually judged on. */
function* candidateSteps(ideal: number): Generator<number> {
  const magnitude = Math.pow(10, Math.floor(Math.log10(ideal)));
  for (const m of [magnitude / 10, magnitude, magnitude * 10]) {
    for (const step of NICE_STEPS) yield step * m;
  }
}

export function lineDomain(values: number[]): LineDomain {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: 0, max: 1, ticks: [0, 1] };

  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  // A flat series has no span to step over, so give it a band around its value
  // rather than a degenerate axis every point sits on.
  const span = hi - lo || Math.abs(hi) || 1;
  const pad = span * LINE_PAD;
  // Never below zero: a run-rate cannot go there, and an axis that reaches into
  // negative money invites a reading the data cannot support.
  const lowPadded = Math.max(0, lo - pad);
  const highPadded = hi + pad;
  const ideal = (highPadded - lowPadded) / (LINE_TICKS - 1);

  let best: { min: number; max: number; step: number } | null = null;
  let bestScore = Infinity;
  for (const step of candidateSteps(ideal)) {
    const min = Math.max(0, Math.floor(lowPadded / step) * step);
    const max = Math.ceil(highPadded / step) * step;
    const count = Math.round((max - min) / step) + 1;
    if (count < MIN_LINE_TICKS || count > MAX_LINE_TICKS) continue;
    const score = Math.abs(count - LINE_TICKS);
    if (score < bestScore) {
      bestScore = score;
      best = { min, max, step };
    }
  }
  // No candidate landed in range (a pathological span), so bracket the padded
  // data directly rather than return an axis with no ticks on it.
  if (!best) best = { min: lowPadded, max: highPadded, step: ideal || 1 };

  const ticks: number[] = [];
  for (let t = best.min; t <= best.max + 1e-9; t += best.step) ticks.push(Number(t.toFixed(6)));
  return { min: best.min, max: best.max, ticks };
}
