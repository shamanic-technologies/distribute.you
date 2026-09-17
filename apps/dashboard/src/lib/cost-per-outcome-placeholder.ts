/**
 * The SHAPE a cost per outcome traces before it can be stated, drawn on a chart whose
 * axes carry no values.
 *
 * A campaign still learning has too few outcomes to divide its spend by, so there is no
 * curve to draw and the alternative — an empty box, or a paragraph explaining the
 * absence — says nothing a reader can hold on to. What this draws instead is the shape
 * itself: steep at first, then flattening, which is what the real thing does. Measured
 * on one production campaign over its first week: $36.82, $19.65, $12.93, $8.83, $7.97.
 *
 * It is an ILLUSTRATION and it is built so it cannot be read as a measurement — the
 * series carries no unit, the chart that renders it prints no tick on either axis, marks
 * no point and offers no tooltip. Nothing here is derived from any brand's data, and
 * nothing may be: the moment a real figure touches this function it stops being a
 * placeholder and becomes a number we made up.
 *
 * Deliberately alias-free so it carries real unit tests.
 */

/** Points drawn. Enough for the flattening to read; few enough to stay smooth on a half-width card. */
export const PLACEHOLDER_POINT_COUNT = 18;

/** Where the curve settles, as a share of where it starts. Above zero, so it flattens rather than dies. */
const FLOOR_SHARE = 0.16;

/** How fast it falls. Picked so the drop is spent by roughly the halfway point. */
const DECAY = 0.3;

export interface PlaceholderPoint {
  /** Position along the axis. Unitless — the chart prints no tick for it. */
  x: number;
  /** Height. Unitless, bounded to (0, 1]. Never a currency, never a count. */
  value: number;
}

/**
 * A decreasing curve that flattens onto a floor — steep, then slow, never reaching zero.
 *
 * Strictly decreasing by construction (the exponential term shrinks on every step), which
 * is the one property a reader takes from it: this gets cheaper, and the early progress is
 * the fastest. It starts at exactly 1 and ends above {@link FLOOR_SHARE} so the line sits
 * inside the plot rather than on its floor.
 */
export function placeholderCostCurve(points = PLACEHOLDER_POINT_COUNT): PlaceholderPoint[] {
  return Array.from({ length: points }, (_, i) => ({
    x: i,
    value: FLOOR_SHARE + (1 - FLOOR_SHARE) * Math.exp(-DECAY * i),
  }));
}
