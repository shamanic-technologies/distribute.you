"use client";

import { useStatBasis } from "@/lib/use-stat-basis";

/**
 * The staff switch: AUTO (what every customer reads, the half with the higher return), or
 * a pinned MATURE / FLASH half, for debugging a Learning tag or a price that moved. It
 * sits in the top bar of every page that states a ratio and it is ONE setting: flipping it
 * here flips it on every such page and tab. Renders nothing outside staff mode.
 */
export function StatBasisSwitch() {
  const { isStaff, choice, basis, setBasis } = useStatBasis();
  if (!isStaff) return null;
  return (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label="Figures">
      {(["auto", "mature", "flash"] as const).map((b) => (
        <button
          key={b}
          type="button"
          aria-pressed={choice === b}
          onClick={() => setBasis(b)}
          className={choice === b ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}
        >
          {/* Auto names the half it landed on, so staff sees what customers read. */}
          {b === "auto" ? `Auto (${basis === "flash" ? "Flash" : "Mature"})` : b === "mature" ? "Mature" : "Flash"}
        </button>
      ))}
    </span>
  );
}
