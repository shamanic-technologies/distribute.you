/**
 * Formatting + derivation shared by every `/feature-stats/<slug>` sub-page.
 *
 * The feature-stats surface is now THREE pages (Economics / Cost details /
 * Workflow) that all print the same money in the same table chrome, so every
 * helper lives here once. A second copy is how one page ends up reading `$12`
 * where its sibling reads `$11.70` for the same figure.
 *
 * Alias-free on purpose (type-only import of the api types, erased at build), so
 * this module carries REAL unit tests rather than source-substring guards.
 */
import type { CrossOrgTrendPoint } from "./api";

export const FEATURE_SLUG = "sales-cold-email-outreach";

/** Trailing display days for the moving-average series. */
export const TREND_DAYS = 90;
/** The stock-style weekly change window. */
export const GROWTH_DAYS = 7;

/**
 * The ONE currency format for the whole feature-stats surface: 2 decimals under
 * $10 ($5.78), rounded whole dollars at/above $10 ($12).
 */
export const usd2 = (n: number): string =>
  n < 10
    ? n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const num = (n: number): string => Math.round(n).toLocaleString("en-US");

/** USD from a backend USD number; "—" when null (never a false $0). */
export function fmtUsd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return usd2(value);
}

/** Whole count from a backend number; "—" when null (never a false 0). */
export function fmtCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return num(value);
}

export type SortDir = "asc" | "desc";
export type Sort = { key: string; dir: SortDir };

/** Comparator that always sinks null/undefined to the bottom, then orders by dir. */
export function cmpValues(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
  dir: SortDir,
): number {
  const an = a === null || a === undefined;
  const bn = b === null || b === undefined;
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  const d =
    typeof a === "string" || typeof b === "string"
      ? String(a).localeCompare(String(b))
      : (a as number) - (b as number);
  return dir === "asc" ? d : -d;
}

/** Click-a-header toggle: same key flips direction, a new key starts ascending. */
export function nextSort(current: Sort | null, key: string): Sort {
  return current && current.key === key
    ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
    : { key, dir: "asc" };
}

export function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The most recent backed window value = the current cross-org moving average (100-avg). */
export function latestCost(points: CrossOrgTrendPoint[] | undefined): number | null {
  if (!points) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].costPerOutcomeUsd !== null) return points[i].costPerOutcomeUsd;
  }
  return null;
}

/**
 * Stock-style weekly change: latest backed point vs the closest backed point
 * ~GROWTH_DAYS before it, as a signed fraction. Null when either side is
 * missing. This is a display delta over the two points the sparkline already
 * draws — no hidden metric derived from raw events.
 */
export function growth7d(points: CrossOrgTrendPoint[] | undefined): number | null {
  if (!points || points.length === 0) return null;
  let latestIdx = -1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].costPerOutcomeUsd !== null) {
      latestIdx = i;
      break;
    }
  }
  if (latestIdx < 0) return null;
  const latest = points[latestIdx];
  const latestMs = new Date(`${latest.date}T00:00:00.000Z`).getTime();
  const targetMs = latestMs - GROWTH_DAYS * 24 * 60 * 60 * 1000;
  // Walk back from the latest point to the first backed point at/before the target day.
  let prev: CrossOrgTrendPoint | null = null;
  for (let i = latestIdx - 1; i >= 0; i--) {
    if (points[i].costPerOutcomeUsd === null) continue;
    prev = points[i];
    if (new Date(`${points[i].date}T00:00:00.000Z`).getTime() <= targetMs) break;
  }
  if (!prev || prev.costPerOutcomeUsd === null || prev.costPerOutcomeUsd === 0) return null;
  const a = latest.costPerOutcomeUsd as number;
  const b = prev.costPerOutcomeUsd as number;
  return (a - b) / b;
}
