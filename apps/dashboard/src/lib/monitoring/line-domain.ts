/**
 * The fitted Y-axis of a run-rate LINE chart, ported byte-for-byte in behaviour from the admin
 * Revenue tab's `lineDomain` (apps/admin/src/lib/chart-domain.ts) when the tab moved to Monitoring
 * (owner 2026-11-21: a move keeps the approved look). Alias-free, unit-tested.
 */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 10];

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
