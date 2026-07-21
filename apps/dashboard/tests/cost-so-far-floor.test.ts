import { describe, it, expect } from "vitest";
import { costSoFarFloorCents } from "../src/lib/cost-so-far-floor";

describe("costSoFarFloorCents", () => {
  it("returns the real ratio verbatim when features already computed it (>0 outcomes)", () => {
    // A real CPPR of $3.20 with replies present — never overridden by the floor.
    expect(costSoFarFloorCents(320, 9416, 5)).toBe(320);
  });

  it("floors to net committed spend when 0 outcomes but spend exists (the reported bug)", () => {
    // Brand Overview: Total spent $94.16, 0 positive replies → CPPR so far = $94.16.
    expect(costSoFarFloorCents(null, 9416, 0)).toBe(9416);
  });

  it("returns null when there is genuinely no spend (cold, nothing sent)", () => {
    expect(costSoFarFloorCents(null, 0, 0)).toBeNull();
    expect(costSoFarFloorCents(null, null, 0)).toBeNull();
  });

  it("does not floor when the ratio is null but outcomes are non-zero (unexpected state → stays null, no false number)", () => {
    expect(costSoFarFloorCents(null, 9416, 3)).toBeNull();
  });

  it("treats undefined cost/spend/count safely", () => {
    expect(costSoFarFloorCents(undefined, undefined, undefined)).toBeNull();
    expect(costSoFarFloorCents(undefined, 500, 0)).toBe(500);
  });

  it("a real $0 ratio (not null) is returned as-is, never re-floored to spend", () => {
    // costCents === 0 is a real value (0 is not null); keep it.
    expect(costSoFarFloorCents(0, 9416, 0)).toBe(0);
  });
});
