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
