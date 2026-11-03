import { paidClientsWords, type RealizedReturn } from "./realized-return";

/**
 * How admin prints the REALIZED return (ROI-CONSISTENCY-1103): the served multiple and the
 * served counts, never a ratio of ours. Pure formatting, alias-free so it carries unit tests.
 */

/** A multiple the dashboard's way: one decimal under 10x, whole from 10x. */
export function formatMultiple(multiple: number): string {
  return multiple >= 10 ? `${Math.round(multiple)}x` : `${multiple.toFixed(1)}x`;
}

/** "Realized 2.1x", or "—" when nothing was spent yet / the read served none. */
export function realizedMultipleText(realized: RealizedReturn | null | undefined): string {
  if (!realized || realized.roiMultiple == null) return "—";
  return formatMultiple(realized.roiMultiple);
}

/** "0 paid clients · $94 spent" (the spend only once features-service serves it). */
export function realizedLineText(realized: RealizedReturn | null | undefined): string | null {
  if (!realized) return null;
  const parts = [paidClientsWords(realized.closedWonCount)];
  if (realized.spentUsd != null) {
    const usd = realized.spentUsd;
    parts.push(`$${usd < 10 ? usd.toFixed(2) : Math.round(usd).toLocaleString("en-US")} spent`);
  }
  return parts.join(" · ");
}
