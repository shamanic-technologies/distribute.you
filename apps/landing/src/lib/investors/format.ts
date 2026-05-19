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
 */
export function computeCAGR(values: Array<string | number>): string | null {
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
  const periods = oldestIdx - newestIdx;
  const cagr = (Math.pow(nums[newestIdx] / nums[oldestIdx], 1 / periods) - 1) * 100;
  return cagr.toFixed(0);
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
