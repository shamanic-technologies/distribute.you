import { describe, expect, it } from "vitest";
import { percentAxis, percentTick } from "../src/lib/percent-axis";

describe("percentAxis", () => {
  it("rounds the top just above the highest point", () => {
    expect(percentAxis(0.66)).toEqual({ top: 1, ticks: [0, 0.5, 1] });
    expect(percentAxis(37.5)).toEqual({ top: 50, ticks: [0, 25, 50] });
    expect(percentAxis(100)).toEqual({ top: 100, ticks: [0, 50, 100] });
  });
  it("never goes above 100%", () => {
    expect(percentAxis(140).top).toBe(100);
  });
  it("labels small ticks with their decimals", () => {
    expect([0, 0.05, 0.5, 1, 25, 50].map(percentTick)).toEqual(["0%", "0.05%", "0.5%", "1%", "25%", "50%"]);
  });
});
