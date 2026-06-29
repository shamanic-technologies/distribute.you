/**
 * Format helpers for investor metrics.
 *
 * Cent values arrive as full-precision decimal strings from billing-service
 * (e.g. "100.4200000000"). Display rounds to the nearest dollar so sub-dollar
 * amounts (e.g. 0.99 cents = $0.0099) render as "$0" rather than being
 * inflated to "$1".
 */

function toNumber(value: string | number): number {
  return typeof value === "string" ? parseFloat(value) : value;
}

export function formatCents(centsStr: string | number): string {
  const cents = toNumber(centsStr);
  if (!Number.isFinite(cents)) {
    console.error("[landing] formatCents received non-numeric value:", centsStr);
  }
  const dollars = Math.round(cents / 100);
  return `$${dollars.toLocaleString("en-US")}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Compound growth rate from oldest period with spend > 0 to newest.
 * Values are in DESCENDING chronological order (newest first).
 * Inputs may be decimal strings or numbers.
 *
 * `periodsFromWindowStart`: count the periods from the FIRST ROW of the window
 * (the oldest period overall, e.g. 2026-03-02) instead of from the oldest
 * NON-ZERO period. The base VALUE is still the oldest non-zero (you can't divide
 * by a $0 start), but the rate is amortized over the whole window. This makes
 * two series that start spending on different weeks report growth "since the
 * same date" — e.g. revenue ($0 until 03-16) and credits ($0.0099 on 03-02)
 * both measured per-week since 03-02. Default false keeps the legacy behavior
 * (periods between the two non-zero anchors).
 */
export function computeCAGR(
  values: Array<string | number>,
  opts: { periodsFromWindowStart?: boolean } = {},
): string | null {
  const nums = values.map(toNumber);
  let newestIdx = -1;
  let oldestIdx = -1;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] > 0) {
      if (newestIdx === -1) newestIdx = i;
      oldestIdx = i;
    }
  }
  if (newestIdx === -1 || oldestIdx === -1 || newestIdx === oldestIdx) return null;
  const lastIdx = opts.periodsFromWindowStart ? nums.length - 1 : oldestIdx;
  const periods = lastIdx - newestIdx;
  if (periods <= 0) return null;
  const cagr = (Math.pow(nums[newestIdx] / nums[oldestIdx], 1 / periods) - 1) * 100;
  return cagr.toFixed(0);
}

/**
 * Round a raw step up to a "nice" number (1, 2, or 5 times a power of 10).
 * Used to pick axis tick intervals that read cleanly.
 */
function niceStep(rawStep: number): number {
  if (rawStep <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

/**
 * Compute round-number Y-axis ticks for a value range. Picks a step from the
 * {1, 2, 5} x 10^k family so ticks read as 0/25/50/75/100, 0/500/1000/1500, etc.
 * Returns ticks in DESCENDING order (max first, suitable for top-to-bottom axis labels).
 */
export function niceTicks(
  rawMin: number,
  rawMax: number,
  targetTicks = 5
): { min: number; max: number; ticks: number[] } {
  if (rawMax === rawMin) {
    return { min: rawMin, max: rawMax + 1, ticks: [rawMax + 1, rawMin] };
  }
  const span = rawMax - rawMin;
  const step = niceStep(span / targetTicks);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  const tol = step * 1e-6;
  for (let v = max; v >= min - tol; v -= step) {
    ticks.push(Math.round(v));
  }
  return { min, max, ticks };
}

/**
 * Per-period compound growth rate from anchor (idx 0) to each subsequent index.
 * Input is in ASCENDING chronological order (oldest first).
 * Returns array of same length as input. Result[0] is always null (baseline).
 * Result[i] = ((v_i / v_0)^(1/i) - 1) * 100, rounded toFixed(0).
 * Null entries when v_0 <= 0 or v_i <= 0.
 */
export function computeCGRSeries(
  values: Array<string | number>
): Array<string | null> {
  if (values.length === 0) return [];
  const nums = values.map(toNumber);
  const anchor = nums[0];
  return nums.map((v, i) => {
    if (i === 0) return null;
    if (anchor <= 0 || v <= 0) return null;
    const cgr = (Math.pow(v / anchor, 1 / i) - 1) * 100;
    return cgr.toFixed(0);
  });
}
