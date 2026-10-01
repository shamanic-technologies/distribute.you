import { describe, it, expect } from "vitest";
import { availableCreditCents } from "../src/lib/credit-runway";

describe("availableCreditCents", () => {
  it("reads balance_cents (= billing page Available: total − confirmed − provisioned)", () => {
    // $39.00 credited − $25.55 confirmed − $13.32 provisioned = $0.13 → balance_cents "13"
    expect(availableCreditCents({ balance_cents: "13" })).toBe(13);
  });
  it("handles a negative (overdraft) balance", () => {
    expect(availableCreditCents({ balance_cents: "-200" })).toBe(-200);
  });
});

