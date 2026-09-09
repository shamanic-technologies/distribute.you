import { describe, expect, it } from "vitest";
import { formatCostUsd, formatReturnMultiple } from "../../src/lib/landing-format";

describe("formatReturnMultiple", () => {
  it("keeps one decimal under 10x, because the decimal is the answer there", () => {
    expect(formatReturnMultiple(2.1112218935072433)).toEqual({ text: "2.1", decimals: 1 });
    expect(formatReturnMultiple(7.509853259718874)).toEqual({ text: "7.5", decimals: 1 });
    expect(formatReturnMultiple(1.8660101075547495)).toEqual({ text: "1.9", decimals: 1 });
  });

  it("drops it from 10x up, where it is precision we do not have", () => {
    expect(formatReturnMultiple(10)).toEqual({ text: "10", decimals: 0 });
    expect(formatReturnMultiple(41.2)).toEqual({ text: "41", decimals: 0 });
  });
});

describe("formatCostUsd", () => {
  it("renders exactly what the page shipped by hand, so a reseed changes the number and not the way it reads", () => {
    expect(formatCostUsd(1223.62)).toBe("$1,224");
    expect(formatCostUsd(4.148716216216216)).toBe("$4.1");
    expect(formatCostUsd(192.925)).toBe("$193");
  });

  it("groups thousands", () => {
    expect(formatCostUsd(12345.6)).toBe("$12,346");
  });

  it("keeps a decimal on a small price, where a rounded dollar loses the answer", () => {
    expect(formatCostUsd(0.29)).toBe("$0.3");
    expect(formatCostUsd(9.99)).toBe("$10.0");
  });
});
