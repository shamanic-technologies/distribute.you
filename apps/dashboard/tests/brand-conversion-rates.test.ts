import { describe, expect, it } from "vitest";
import {
  legId,
  legRatePatch,
  formatRatePct,
  parseRateInput,
} from "../src/lib/brand-conversion-rates";

const stated = { fromStep: "Positive reply", toStep: "Meeting booked", ratePct: 30, stated: true };
const unstated = { fromStep: "Meeting booked", toStep: "Meeting attended", ratePct: null, stated: false };

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

describe("legRatePatch", () => {
  it("sends only the legs whose value moved", () => {
    const { patch, invalid } = legRatePatch([stated, unstated], {
      [legId(stated)]: "30",
      [legId(unstated)]: "80",
    });
    expect(invalid).toEqual([]);
    expect(patch).toEqual([{ fromStep: "Meeting booked", toStep: "Meeting attended", ratePct: 80 }]);
  });

  it("clears a stated leg the form emptied, and never clears an unstated one", () => {
    const { patch } = legRatePatch([stated, unstated], {
      [legId(stated)]: "",
      [legId(unstated)]: "",
    });
    expect(patch).toEqual([{ fromStep: "Positive reply", toStep: "Meeting booked", ratePct: null }]);
  });

  it("omits a leg the form never touched", () => {
    expect(legRatePatch([stated, unstated], {}).patch).toEqual([]);
  });

  it("reports a value that is not a rate instead of dropping it", () => {
    const { patch, invalid } = legRatePatch([stated], { [legId(stated)]: "lots" });
    expect(patch).toEqual([]);
    expect(invalid).toEqual([legId(stated)]);
  });
});

describe("formatRatePct", () => {
  it("states at most one decimal and no trailing zero", () => {
    expect(formatRatePct(30)).toBe("30%");
    expect(formatRatePct(8.3222)).toBe("8.3%");
    expect(formatRatePct(0)).toBe("0%");
  });
});
