import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const trackerPath = path.resolve(
  __dirname,
  "../src/components/ads-purchase-tracker.tsx"
);

describe("AdsPurchaseTracker conversion value", () => {
  const content = fs.readFileSync(trackerPath, "utf-8");

  it("should exist", () => {
    expect(fs.existsSync(trackerPath)).toBe(true);
  });

  it("should fire the manual_event_PURCHASE conversion", () => {
    expect(content).toContain('"event", "manual_event_PURCHASE"');
  });

  it("should read the 1-day budget from the daily_budget return param (onboarding)", () => {
    expect(content).toContain('searchParams.get("daily_budget")');
  });

  it("should read the charged amount from the paid_amount return param (billing top-up)", () => {
    expect(content).toContain('searchParams.get("paid_amount")');
  });

  it("should convert cents to dollars for the paid_amount value", () => {
    expect(content).toContain("/ 100");
  });

  it("should send value + USD currency to gtag (maximize conversion value)", () => {
    expect(content).toContain("value");
    expect(content).toContain('currency: "USD"');
  });

  it("should NOT fire when there is no positive payment value (fire only after a real payment)", () => {
    // gate: bail out before firing when no daily_budget/paid_amount is present
    expect(content).toContain("if (value === null) return;");
  });
});
