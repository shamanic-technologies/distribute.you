"use client";

import { MaturityBadge } from "@/components/maturity-badge";
import { useCostBasis } from "@/lib/v2/use-cost-basis";

/**
 * The staff switch between what clients are billed (User cost, the default) and what the
 * vendors charged us before our markup (Actual cost). It sits in the top bar of every page that
 * states costs and it is ONE setting: flipping it here flips it on every such page and tab.
 * Renders nothing for a non-staff reader.
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
      <MaturityBadge level="staff" />
    </span>
  );
}

/**
 * The one line a page prints when Actual cost is picked and some of its figures are not served
 * on that basis yet: those figures are left blank rather than silently stating the billed amount.
 */
export function ActualCostPendingNote({ what }: { what: string }) {
  return (
    <p className="k-card mt-4 px-4 py-2.5 text-[12px] k-fg2">
      Actual cost: {what} not served at vendor cost yet, so they are left blank rather than showing the billed amount.
    </p>
  );
}
