import { describe, it, expect } from "vitest";
import {
  availableCreditCents,
  brandRunwayDays,
  brandRunwaySeverity,
  URGENT_RUNWAY_DAYS,
  WARNING_RUNWAY_DAYS,
} from "../src/lib/credit-runway";

describe("availableCreditCents", () => {
  it("reads balance_cents (= billing page Available: total − confirmed − provisioned)", () => {
    // $39.00 credited − $25.55 confirmed − $13.32 provisioned = $0.13 → balance_cents "13"
    expect(availableCreditCents({ balance_cents: "13" })).toBe(13);
  });
  it("handles a negative (overdraft) balance", () => {
    expect(availableCreditCents({ balance_cents: "-200" })).toBe(-200);
  });
});

describe("brandRunwayDays", () => {
  it("$25 available at $25/day → 1 day", () => {
    expect(brandRunwayDays(2500, 2500)).toBe(1);
  });
  it("floors partial days (conservative)", () => {
    expect(brandRunwayDays(5500, 2500)).toBe(2);
  });
  it("no daily budget set → null (never launched)", () => {
    expect(brandRunwayDays(5000, null)).toBeNull();
  });
  it("zero daily budget (paused) → null", () => {
    expect(brandRunwayDays(5000, 0)).toBeNull();
  });
  it("zero available at a budget → 0 days", () => {
    expect(brandRunwayDays(0, 2500)).toBe(0);
  });
  it("negative available → negative days (depleted)", () => {
    expect(brandRunwayDays(-100, 2500)).toBeLessThan(0);
  });
});

describe("brandRunwaySeverity", () => {
  it("auto-topup on → null (safety net in place)", () => {
    expect(brandRunwaySeverity(0, true)).toBeNull();
  });
  it("no daily budget (null runway) → null", () => {
    expect(brandRunwaySeverity(null, false)).toBeNull();
  });
  it(`runway ${URGENT_RUNWAY_DAYS} day, no auto-topup → urgent`, () => {
    expect(brandRunwaySeverity(URGENT_RUNWAY_DAYS, false)).toBe("urgent");
  });
  it("depleted (0 days) → urgent", () => {
    expect(brandRunwaySeverity(0, false)).toBe("urgent");
  });
  it("negative runway → urgent", () => {
    expect(brandRunwaySeverity(-3, false)).toBe("urgent");
  });
  it(`runway ${WARNING_RUNWAY_DAYS} days → warning`, () => {
    expect(brandRunwaySeverity(WARNING_RUNWAY_DAYS, false)).toBe("warning");
  });
  it("runway 2 days → warning", () => {
    expect(brandRunwaySeverity(2, false)).toBe("warning");
  });
  it("runway 10 days → null (plenty)", () => {
    expect(brandRunwaySeverity(10, false)).toBeNull();
  });
  // Indian-card / unsupported auto-reload is NOT suppressed: the brand still
  // needs the "add credits" nudge. has_auto_topup is false in that case (it can
  // never be enabled), so a low runway still surfaces a banner.
  it("unsupported auto-reload (has_auto_topup false) at low runway → banner", () => {
    expect(brandRunwaySeverity(1, false)).toBe("urgent");
  });
});
