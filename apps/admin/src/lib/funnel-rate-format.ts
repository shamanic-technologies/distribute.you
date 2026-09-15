import { formatPctAdaptive } from "@/lib/format-number";

/**
 * The two ways a /metrics funnel tab states a percentage, in one place because
 * the Signups tab and the Paid-users tab state the same two kinds of figure and
 * a second copy is how one page comes to round a rate differently from its
 * neighbour.
 */

/** A ratio of two counts, adaptively formatted. A zero denominator is nobody measured, so it reads 0% rather than dividing. */
export function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "0%";
  return formatPctAdaptive((numerator / denominator) * 100);
}

/** A rate bar's own value, already a percentage. One decimal: 0.4% and 0.9% are different answers about a funnel and both round to 0%. */
export function formatRatePct(value: number): string {
  return `${value.toFixed(1)}%`;
}
