import { describe, it, expect } from "vitest";
import { shownReturn, shownReturnHalf } from "../src/lib/maturity";

/**
 * The curve drawn under a return is the one whose last point IS that return
 * (features-service v0.179.81 serves the flash twin beside the mature curve).
 */
const pair = (isMature: boolean | null, flash: number | null, mature: number | null) => ({
  isMature,
  flash: flash == null ? null : { roiMultiple: flash },
  mature: mature == null ? null : { roiMultiple: mature },
});

describe("shownReturnHalf names the half shownReturn states", () => {
  const cases: [ReturnType<typeof pair> | null, "flash" | "mature", "flash" | "mature" | null][] = [
    [pair(true, 1.6, 1.3), "mature", "mature"],
    [pair(false, 1.6, 0.8), "mature", "flash"],
    [pair(false, 0.9, 0.8), "mature", null],
    [pair(true, 1.6, 1.3), "flash", "flash"],
    [null, "mature", null],
  ];
  for (const [p, basis, half] of cases) {
    it(`${JSON.stringify(p)} on ${basis} -> ${half}`, () => {
      expect(shownReturnHalf(p, basis)).toBe(half);
      const shown = shownReturn(p, basis);
      if (half === "flash") expect(shown.value).toBe(p?.flash?.roiMultiple);
      if (half === "mature") expect(shown.value).toBe(p?.mature?.roiMultiple);
      if (half === null && p) expect(shown.learning).toBe(true);
    });
  }
});
