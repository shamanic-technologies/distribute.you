import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { autoTopupLine } from "../src/lib/v2/auto-topup-line";

// BILLING-RELOAD-COPY-1118: the Billing "Auto top-up" line prints the threshold AND the
// amount billing serves for the org, never a hard-coded "$0" (owner 2026-11-18, Ethan's
// account read "reaches $0, we add $15" for a "$10 below $5" reload).
describe("autoTopupLine", () => {
  it("prints the served threshold and amount", () => {
    expect(autoTopupLine(500, 1000)).toBe("When your balance falls below $5, we add $10 from your card.");
  });

  it("keeps cents when a figure is not whole dollars", () => {
    expect(autoTopupLine(250, 1550)).toBe("When your balance falls below $2.50, we add $15.50 from your card.");
  });

  it("never adds the threshold to the amount", () => {
    expect(autoTopupLine(500, 1000)).not.toContain("$15");
  });

  it("returns null (loud) when billing serves a figure missing", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(autoTopupLine(null, 1000)).toBeNull();
    expect(autoTopupLine(500, undefined)).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("Billing page auto top-up sentence", () => {
  const src = readFileSync(join(__dirname, "../src/components/v2/billing-page.tsx"), "utf8");

  it("has no hard-coded $0 threshold", () => {
    expect(src).not.toContain("When your balance reaches $0");
  });

  it("builds the line from both served fields", () => {
    expect(src).toContain("autoTopupLine(account?.topup_threshold_cents, account?.topup_amount_cents)");
  });
});
