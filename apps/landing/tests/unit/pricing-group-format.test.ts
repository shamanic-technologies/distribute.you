import { describe, it, expect } from "vitest";
import { groupByProvider, formatPrice, type PlatformPrice } from "@/lib/pricing/fetch-prices";

const sample: PlatformPrice[] = [
  {
    name: "anthropic-sonnet-4.6-tokens-input",
    pricePerUnitInUsdCents: "0.0006000000",
    provider: "anthropic",
    providerDomain: "anthropic.com",
    type: "Input tokens (Sonnet 4.6)",
    unit: "1M tokens",
    effectiveFrom: "2025-01-01T00:00:00.000Z",
  },
  {
    name: "anthropic-sonnet-4.6-tokens-output",
    pricePerUnitInUsdCents: "0.0030000000",
    provider: "anthropic",
    providerDomain: "anthropic.com",
    type: "Output tokens (Sonnet 4.6)",
    unit: "1M tokens",
    effectiveFrom: "2025-01-01T00:00:00.000Z",
  },
  {
    name: "apollo-credit",
    pricePerUnitInUsdCents: "4.7200000000",
    provider: "apollo",
    providerDomain: "apollo.io",
    type: "Credit",
    unit: "credit",
    effectiveFrom: "2025-01-01T00:00:00.000Z",
  },
  {
    name: "twilio-sms-segment",
    pricePerUnitInUsdCents: "2.6600000000",
    provider: "twilio",
    providerDomain: "twilio.com",
    type: "SMS message",
    unit: "segment",
    effectiveFrom: "2025-01-01T00:00:00.000Z",
  },
];

describe("groupByProvider", () => {
  it("groups rows by provider, sorts providers alphabetically", () => {
    const groups = groupByProvider(sample);
    expect(groups.map((g) => g.provider)).toEqual(["anthropic", "apollo", "twilio"]);
  });

  it("preserves providerDomain from first row in each group", () => {
    const groups = groupByProvider(sample);
    expect(groups[0]).toMatchObject({ provider: "anthropic", providerDomain: "anthropic.com" });
    expect(groups[1]).toMatchObject({ provider: "apollo", providerDomain: "apollo.io" });
  });

  it("sorts rows within group by type alphabetically", () => {
    const groups = groupByProvider(sample);
    const anthropic = groups.find((g) => g.provider === "anthropic")!;
    expect(anthropic.rows.map((r) => r.type)).toEqual([
      "Input tokens (Sonnet 4.6)",
      "Output tokens (Sonnet 4.6)",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(groupByProvider([])).toEqual([]);
  });
});

describe("formatPrice", () => {
  it("formats large cents (>= $1) as dollars with 2 decimals", () => {
    expect(formatPrice("250.00")).toBe("$2.50");
    expect(formatPrice("100")).toBe("$1.00");
  });

  it("formats mid cents ($0.01–$1) as dollars with 4 decimals", () => {
    expect(formatPrice("4.7200000000")).toBe("$0.0472");
    expect(formatPrice("2.66")).toBe("$0.0266");
  });

  it("formats sub-cent magnitudes as cents with 4 significant digits", () => {
    expect(formatPrice("0.0006000000")).toBe("0.0006000 ¢");
    expect(formatPrice("0.0030000000")).toBe("0.003000 ¢");
  });

  it("returns $0 for zero", () => {
    expect(formatPrice("0")).toBe("$0");
    expect(formatPrice("0.0000000000")).toBe("$0");
  });

  it("throws on non-numeric input (fail-loud)", () => {
    expect(() => formatPrice("abc")).toThrow(/non-numeric/);
  });
});
