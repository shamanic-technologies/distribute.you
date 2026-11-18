import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { autoTopupLine, autoTopupWhen, parseReloadAmountCents } from "../src/lib/v2/auto-topup-line";

// BILLING-RELOAD-COPY-1118: the Billing "Auto top-up" line prints the threshold AND the
// amount billing serves for the org. Owner 2026-11-18: the threshold is $0 for everyone,
// editable nowhere; the amount is the client's to change.
describe("auto top-up sentence", () => {
  it("reads the served $0 threshold as 'reaches $0'", () => {
    expect(autoTopupLine(0, 1000)).toBe("When your balance reaches $0, we add $10 from your card.");
  });

  it("an account billing has not moved yet still reads its own threshold", () => {
    expect(autoTopupLine(500, 1000)).toBe("When your balance falls below $5, we add $10 from your card.");
    expect(autoTopupWhen(250)).toBe("When your balance falls below $2.50, we add");
  });

  it("never adds the threshold to the amount", () => {
    expect(autoTopupLine(500, 1000)).not.toContain("$15");
  });

  it("returns null (loud) when billing serves a figure missing", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(autoTopupWhen(null)).toBeNull();
    expect(autoTopupLine(0, undefined)).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("parseReloadAmountCents", () => {
  it("takes whole dollars, with or without $ and commas", () => {
    expect(parseReloadAmountCents("10")).toBe(1000);
    expect(parseReloadAmountCents(" $25 ")).toBe(2500);
    expect(parseReloadAmountCents("1,000")).toBe(100000);
  });
  it("takes $0: it turns auto top-up off (owner 2026-11-18)", () => {
    expect(parseReloadAmountCents("0")).toBe(0);
    expect(parseReloadAmountCents("$0")).toBe(0);
  });
  it("refuses cents, negatives and words (the minimum is billing's)", () => {
    expect(parseReloadAmountCents("10.50")).toBeNull();
    expect(parseReloadAmountCents("-5")).toBeNull();
    expect(parseReloadAmountCents("ten")).toBeNull();
  });
});

describe("Billing page auto top-up card", () => {
  const src = readFileSync(join(__dirname, "../src/components/v2/billing-page.tsx"), "utf8");
  const amount = readFileSync(join(__dirname, "../src/components/v2/reload-amount.tsx"), "utf8");

  it("has no hard-coded threshold sentence", () => {
    expect(src).not.toContain("When your balance reaches $0, we add ${");
  });

  it("reads the served threshold and amount, the amount editable in place", () => {
    expect(src).toContain("thresholdCents={account?.topup_threshold_cents}");
    expect(src).toContain("amountCents={account?.topup_amount_cents}");
    expect(src).toContain("<ReloadAmount amountCents={amountCents} onSave={onSave} />");
  });

  it("saves the amount alone (billing holds the $0 threshold)", () => {
    expect(src).toContain("else await configureAutoTopup(cents);");
  });

  it("states billing's own minimum on a refusal", () => {
    expect(amount).toContain("err.body?.minimum_cents");
    expect(amount).toContain("onBlur={commit}");
  });
});
