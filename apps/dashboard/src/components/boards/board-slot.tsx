"use client";

/**
 * The dashed outline a card leaves behind, and the one it is heading for.
 *
 * A drag with no slots reads as a card that vanished: the column it came from collapses
 * under the finger, and the column it is going to gives no sign it will take it until the
 * person has already let go. Both are the same control, rendered twice:
 *
 *   - `origin` keeps the source card's space while it is in the air, so nothing reflows
 *     under the pointer and the reader can still see where the card WAS.
 *   - `target` opens the space it would land in, BEFORE release, so a drop is a thing you
 *     confirm rather than a thing you find out about.
 *
 * Deliberately the card's own height rather than a thin line: a board whose rows shift by
 * a few pixels on hover is harder to aim at than one that opens a real gap.
 */
export function BoardSlot({ variant, height }: { variant: "origin" | "target"; height?: number }) {
  const tone =
    variant === "target" ? "border-purple-200 bg-purple-50/60" : "border-gray-200 bg-gray-50";
  return (
    <div
      aria-hidden
      data-testid={`board-slot-${variant}`}
      style={height ? { height } : undefined}
      className={`rounded-lg border-2 border-dashed ${tone} ${height ? "" : "min-h-[52px]"}`}
    />
  );
}
