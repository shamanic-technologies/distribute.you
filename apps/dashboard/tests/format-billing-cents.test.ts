import { describe, it, expect } from "vitest";
import { formatBillingCents, formatBillingCentsWhole } from "../src/lib/format-number";

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

describe("formatBillingCentsWhole", () => {
  it("drops the cents a whole-dollar offer never had", () => {
    expect(formatBillingCentsWhole("34700")).toBe("$347");
    expect(formatBillingCentsWhole("50000")).toBe("$500");
  });

  it("ceils a partial dollar rather than understating a bar", () => {
    // The remaining-to-unlock figure is genuinely fractional. Rounding it DOWN
    // would state a lower bar than the one billing actually holds.
    expect(formatBillingCentsWhole("37601")).toBe("$377");
    expect(formatBillingCentsWhole("1")).toBe("$1");
  });

  it("keeps zero at zero", () => {
    expect(formatBillingCentsWhole("0")).toBe("$0");
    expect(formatBillingCentsWhole("0.0000000000")).toBe("$0");
  });

  it("separates thousands", () => {
    expect(formatBillingCentsWhole("123456789")).toBe("$1,234,568");
  });

  it("leaves charges alone", () => {
    // An exact amount someone PAID must never round; that is why the billing
    // page is exempt from the adaptive rule in the first place.
    expect(formatBillingCents("34700")).toBe("$347.00");
  });
});
