/**
 * How fresh a Research figure is, as features-service states it (RESEARCH-STALE-1024): the file
 * is rebuilt on a clock and every read carries `freshness`, computed at read time. The page READS
 * `stale` and `rebuilding`; it never re-derives staleness from `computedAt` (owner 2026-10-24: 8-hour-old
 * figures read as current under "Live, updated <time>"). Alias-free so it carries a real unit test.
 */
export interface ResearchFreshness {
  /** ISO, the build's own `computedAt`. */
  computedAt: string;
  /** The build cadence: 15 on the billed basis, 360 on the vendor-cost basis. */
  refreshEveryMinutes: number;
  /** Twice the cadence. */
  staleAfterMinutes: number;
  /** Whole minutes since `computedAt`, at this read. */
  ageMinutes: number;
  /** `ageMinutes > staleAfterMinutes`, judged by features-service. */
  stale: boolean;
  /** A rebuild of this basis and view is running now. */
  rebuilding: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "8 hours ago" off the served age in whole minutes. */
export function ageWords(ageMinutes: number): string {
  if (ageMinutes < 60) return ageMinutes === 1 ? "1 minute ago" : `${ageMinutes} minutes ago`;
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 48) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/** "Oct 23, 20:30 UTC" off a served ISO instant. */
function instantWords(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(11, 16)} UTC`;
}

/**
 * The out-of-date line, or null when the figures are fresh or the build serves no `freshness`
 * yet (the page then keeps its usual "Live, updated" line).
 */
export function staleText(freshness: ResearchFreshness | null | undefined): string | null {
  if (!freshness?.stale) return null;
  const line = `Out of date: figures from ${ageWords(freshness.ageMinutes)} (${instantWords(freshness.computedAt)}).`;
  return freshness.rebuilding ? `${line} Rebuilding now.` : line;
}
