"use client";

import { useCostBasis } from "@/lib/v2/use-cost-basis";
import { formatUsdAdaptive } from "@/lib/format-number";

/**
 * The staff switch between what clients are billed (User cost, the default) and what the
 * vendors charged us before our markup (Actual cost). It sits in the top bar of every page that
 * states costs and it is ONE setting: flipping it here flips it on every such page and tab.
 * Renders nothing outside staff mode.
 */
export function CostBasisSwitch() {
  const { isStaff, basis, setBasis } = useCostBasis();
  if (!isStaff) return null;
  return (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label="Cost basis">
      {(["user", "actual"] as const).map((b) => (
        <button
          key={b}
          type="button"
          aria-pressed={basis === b}
          onClick={() => setBasis(b)}
          className={basis === b ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}
        >
          {b === "user" ? "User cost" : "Actual cost"}
        </button>
      ))}
    </span>
  );
}

/**
 * The one line a page prints on the Actual cost basis: what the figures are, and how much billed
 * spend has no vendor cost on record (a figure resting on it is left blank, never the billed amount).
 */
export function ActualCostNote({ unpricedUsd }: { unpricedUsd: number | null | undefined }) {
  return (
    <p className="k-card mt-4 px-4 py-2.5 text-[12px] k-fg2">
      Actual cost: what the vendors charged us, before our margin.
      {unpricedUsd != null && unpricedUsd > 0 &&
        ` ${formatUsdAdaptive(unpricedUsd)} of billed spend here has no vendor cost on record yet, so a figure resting on it is left blank rather than showing the billed amount.`}
    </p>
  );
}
