"use client";

import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import { expectedReasonWords, type ExpectedReturn } from "@/lib/expected-return";
import { expectedBasisWord, paidClientsWords, type RealizedReturn } from "@/lib/realized-return";

/**
 * The ONLY two returns a screen shows (owner 2026-11-03, ROI-CONSISTENCY-1103): a campaign's
 * EXPECTED return (what its Target is worth over what one costs to make from Start) and the
 * REALIZED return (Paid clients our outreach caused over money actually spent). Both are
 * served by features-service; nothing is divided here. Every pipeline-based ROI is retired.
 */

/** "18x" with "Expected (Learning)" beside it, or the producer's reason when none is served. */
export function ExpectedReturnValue({ expected, compact = false }: { expected: ExpectedReturn | null | undefined; compact?: boolean }) {
  const roi = expected?.roiMultiple ?? null;
  if (roi == null) return <span className="k-fg3 text-[12px] font-normal">{expectedReasonWords(expected?.unavailableReason ?? null)}</span>;
  const word = expectedBasisWord(expected?.basis);
  return (
    <span className="whitespace-nowrap">
      <span className={word === "measured" && roiIsGood(roi) ? "text-[var(--run)]" : ""}>{formatRoi(roi)}</span>
      <span className="k-fg3 ml-1 text-[11px] font-normal">{compact ? "expected" : `Expected (${word})`}</span>
    </span>
  );
}

/** "Expected 18x (Learning)" as one plain string, for a sub line. */
export function expectedReturnWords(expected: ExpectedReturn | null | undefined): string {
  const roi = expected?.roiMultiple ?? null;
  if (roi == null) return `Expected: ${expectedReasonWords(expected?.unavailableReason ?? null)}`;
  return `Expected ${formatRoi(roi)} (${expectedBasisWord(expected?.basis)})`;
}

/**
 * "0 paid clients · $94 spent", led by "Realized 2x" once a Paid client landed. The served
 * multiple is printed only when there is revenue to divide (a 0x before any client says
 * nothing the count does not).
 */
export function realizedReturnWords(realized: RealizedReturn | null | undefined): string | null {
  if (!realized) return null;
  const parts: string[] = [];
  if (realized.closedWonCount > 0 && realized.roiMultiple != null) parts.push(`Realized ${formatRoi(realized.roiMultiple)}`);
  parts.push(paidClientsWords(realized.closedWonCount));
  if (realized.spentUsd != null) parts.push(`${formatUsdAdaptive(realized.spentUsd)} spent`);
  return parts.join(" · ");
}

/** The realized line as a muted sub line under a figure. */
export function RealizedReturnLine({ realized, className = "" }: { realized: RealizedReturn | null | undefined; className?: string }) {
  const words = realizedReturnWords(realized);
  if (words == null) return null;
  return <p className={`k-fg3 truncate text-[11px] tabular-nums ${className}`}>{words}</p>;
}
