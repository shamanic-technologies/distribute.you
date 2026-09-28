"use client";

import { MaturityBadge } from "@/components/maturity-badge";
import { useStatBasis } from "@/lib/use-stat-basis";

/**
 * The staff switch between the MATURE figure every customer reads (the default) and the
 * FLASH one (everything to date), for debugging a Learning tag or a price that moved. It
 * sits in the top bar of every page that states a ratio and it is ONE setting: flipping it
 * here flips it on every such page and tab. Renders nothing for a non-staff reader.
 */
export function StatBasisSwitch() {
  const { isStaff, basis, setBasis } = useStatBasis();
  if (!isStaff) return null;
  return (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label="Figures">
      {(["mature", "flash"] as const).map((b) => (
        <button
          key={b}
          type="button"
          aria-pressed={basis === b}
          onClick={() => setBasis(b)}
          className={basis === b ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}
        >
          {b === "mature" ? "Mature" : "Flash"}
        </button>
      ))}
      <MaturityBadge level="staff" />
    </span>
  );
}
