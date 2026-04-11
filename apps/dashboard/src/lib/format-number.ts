/**
 * Centralized number formatting with thousand separators.
 * All numbers displayed to users should go through these functions.
 */

/** Format a USD dollar amount with thousand separators. */
export function formatUsd(usd: number, decimals = 2): string {
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** Format cents as USD with thousand separators. */
export function formatCentsAsUsd(cents: number | string, decimals = 2): string {
  const usd = (typeof cents === "string" ? parseFloat(cents) : cents) / 100;
  return formatUsd(usd, decimals);
}

/** Format cents as USD, returning null for null/undefined/zero/NaN. */
export function formatCentsAsUsdOrNull(cents: string | number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null;
  const n = typeof cents === "string" ? parseFloat(cents) : cents;
  if (isNaN(n) || n === 0) return null;
  return formatCentsAsUsd(n);
}

/** Format an integer with thousand separators. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
