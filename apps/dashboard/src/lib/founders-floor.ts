// THE FOUNDER COUNT A VISITOR READS, floored so a `+` claim stays true between reads.
//
// Byte-equal rule to the landing's `founder-count.ts`: owner-set floors of ten. At
// 71 the strip says 70+, at 79 it still says 70+, and it only moves once 80 have
// signed up. Below one floor there is nothing honest to state, so the caller keeps
// whatever it shipped with rather than printing `0+`.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

export const FOUNDER_COUNT_FLOOR = 10;

export function foundersFloor(total: number | null | undefined): number | null {
  if (typeof total !== "number" || !Number.isFinite(total)) return null;
  const floored = Math.floor(total / FOUNDER_COUNT_FLOOR) * FOUNDER_COUNT_FLOOR;
  return floored > 0 ? floored : null;
}

export function foundersLine(floored: number): string {
  return `Loved by ${floored.toLocaleString("en-US")}+ founders`;
}
