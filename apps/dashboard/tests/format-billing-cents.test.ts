import { describe, it, expect } from "vitest";
import { formatBillingCents } from "../src/lib/format-number";

describe("formatBillingCents", () => {
  it("ceils a fractional-cent string up to the next whole cent (AC-4)", () => {
    expect(formatBillingCents("99.9999999999")).toBe("$1.00");
  });

  it("ceils any non-integer cents to the next whole cent", () => {
    expect(formatBillingCents("100.42")).toBe("$1.01");
    expect(formatBillingCents("100.0001")).toBe("$1.01");
    expect(formatBillingCents("250.50")).toBe("$2.51");
  });

  it("preserves whole-cent values", () => {
    expect(formatBillingCents("100")).toBe("$1.00");
    expect(formatBillingCents("100.0000000000")).toBe("$1.00");
    expect(formatBillingCents("2500")).toBe("$25.00");
  });

  it("accepts numeric input (FE-computed integer cents)", () => {
    expect(formatBillingCents(2500)).toBe("$25.00");
    expect(formatBillingCents(0)).toBe("$0.00");
  });

  it("formats large amounts with thousand separators", () => {
    expect(formatBillingCents("1234567")).toBe("$12,345.67");
    expect(formatBillingCents("1234567.89")).toBe("$12,345.68");
  });

  it("rounds zero to $0.00", () => {
    expect(formatBillingCents("0")).toBe("$0.00");
    expect(formatBillingCents("0.0000000000")).toBe("$0.00");
  });
});
