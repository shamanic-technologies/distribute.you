"use client";

import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { expectedReasonWords, type RoiToShow } from "@/lib/expected-return";

/**
 * The (i) every ROI label carries (owner 2026-10-11: "toutes les fois où on met un ROI sur le
 * label d'une colonne, mettre un (i) pour bien spécifier que c'est expected"). One copy, so a
 * column header, a stat tile and a pipe block say the same thing.
 */
export const ROI_TIP =
  "Expected return on each $1 spent. Worked out from each step's rate and what one client is worth, until enough results are measured.";

/** "ROI" (or the given label) followed by the expected (i). */
export function RoiLabel({ children = "ROI", placement = "bottom" }: { children?: ReactNode; placement?: "top" | "bottom" }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <InfoTooltip tip={ROI_TIP} placement={placement} />
    </span>
  );
}

/**
 * A ROI figure as every v2 surface prints it (owner 2026-10-11: never blank): the measured value,
 * else the served expected one with a small "expected" word, else the producer's reason. Green
 * above break-even (lib/format-roi.ts roiIsGood).
 */
export function RoiValue({ roi, learning }: { roi: RoiToShow; learning?: boolean }) {
  if (roi.value == null) {
    return <span className="k-fg3 text-[12px] font-normal">{learning && roi.reason == null ? "Learning" : expectedReasonWords(roi.reason)}</span>;
  }
  return (
    <span className="whitespace-nowrap">
      <span className={roiIsGood(roi.value) ? "text-[var(--run)]" : ""}>{formatRoi(roi.value)}</span>
      {roi.expected && <span className="k-fg3 ml-1 text-[11px] font-normal">expected</span>}
    </span>
  );
}
