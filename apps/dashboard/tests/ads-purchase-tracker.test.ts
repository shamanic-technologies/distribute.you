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

  it("should read the top-up amount from the pending_topup return param", () => {
    expect(content).toContain('searchParams.get("pending_topup")');
  });

  it("should convert cents to dollars for the conversion value", () => {
    expect(content).toContain("/ 100");
  });

  it("should send value + USD currency to gtag (maximize conversion value)", () => {
    expect(content).toContain("value:");
    expect(content).toContain('currency: "USD"');
  });

  it("should omit the value when the amount is absent or zero", () => {
    // gate: only attach value params when cents > 0, else fire valueless
    expect(content).toContain("cents > 0");
    expect(content).toContain("valueParams");
  });
});
