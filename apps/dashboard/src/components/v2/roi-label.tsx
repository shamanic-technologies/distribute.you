"use client";

import type { ReactNode } from "react";
import { InfoTooltip } from "@/components/visibility/metric-info";

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
