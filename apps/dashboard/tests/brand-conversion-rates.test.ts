import { describe, expect, it } from "vitest";
import {
  arrowId,
  arrowRatePatch,
  formatRatePct,
  parseRateInput,
} from "../src/lib/brand-conversion-rates";

const stated = { fromStep: "Positive reply", toStep: "Meeting booked", ratePct: 30, stated: true, statedAt: "2026-09-25T00:00:00Z" };
const unstated = { fromStep: "Meeting booked", toStep: "Meeting attended", ratePct: null, stated: false, statedAt: null };

describe("parseRateInput", () => {
  it("reads a blank field as a clear, a number as a rate, and refuses the rest", () => {
    expect(parseRateInput("  ")).toBeNull();
    expect(parseRateInput("12,5")).toBe(12.5);
    expect(parseRateInput("40")).toBe(40);
    expect(parseRateInput("abc")).toBeUndefined();
    expect(parseRateInput("120")).toBeUndefined();
    expect(parseRateInput("-1")).toBeUndefined();
  });
});

describe("arrowRatePatch", () => {
  it("sends only the arrows whose value moved", () => {
    const { patch, invalid } = arrowRatePatch([stated, unstated], {
      [arrowId(stated)]: "30",
      [arrowId(unstated)]: "80",
    });
    expect(invalid).toEqual([]);
    expect(patch).toEqual([{ fromStep: "Meeting booked", toStep: "Meeting attended", ratePct: 80 }]);
  });

  it("clears a stated arrow the form emptied, and never clears an unstated one", () => {
    const { patch } = arrowRatePatch([stated, unstated], {
      [arrowId(stated)]: "",
      [arrowId(unstated)]: "",
    });
    expect(patch).toEqual([{ fromStep: "Positive reply", toStep: "Meeting booked", ratePct: null }]);
  });

  it("omits an arrow the form never touched", () => {
    expect(arrowRatePatch([stated, unstated], {}).patch).toEqual([]);
  });

  it("reports a value that is not a rate instead of dropping it", () => {
    const { patch, invalid } = arrowRatePatch([stated], { [arrowId(stated)]: "lots" });
    expect(patch).toEqual([]);
    expect(invalid).toEqual([arrowId(stated)]);
  });
});

describe("formatRatePct", () => {
  it("states at most one decimal and no trailing zero", () => {
    expect(formatRatePct(30)).toBe("30%");
    expect(formatRatePct(8.3222)).toBe("8.3%");
    expect(formatRatePct(0)).toBe("0%");
  });
});
