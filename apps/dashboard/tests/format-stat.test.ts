import { describe, it, expect } from "vitest";
import { formatStatValue, sortDirectionForType } from "../src/lib/format-stat";

describe("formatStatValue", () => {
  it("returns em dash for null/undefined values", () => {
    expect(formatStatValue(null, { type: "count", label: "X" })).toBe("\u2014");
    expect(formatStatValue(undefined, { type: "count", label: "X" })).toBe("\u2014");
  });

  it("returns raw string when no registry entry", () => {
    expect(formatStatValue(42, undefined)).toBe("42");
  });

  it("formats count with locale string", () => {
    expect(formatStatValue(1234, { type: "count", label: "Emails" })).toBe("1,234");
    expect(formatStatValue(0, { type: "count", label: "Emails" })).toBe("0");
  });

  it("formats rate as percentage", () => {
    expect(formatStatValue(0.256, { type: "rate", label: "Open Rate" })).toBe("25.6%");
    expect(formatStatValue(1, { type: "rate", label: "Rate" })).toBe("100.0%");
  });

  it("returns em dash for zero rate", () => {
    expect(formatStatValue(0, { type: "rate", label: "Rate" })).toBe("\u2014");
  });

  it("formats currency from cents to dollars", () => {
    expect(formatStatValue(1250, { type: "currency", label: "Cost" })).toBe("$12.50");
    expect(formatStatValue(5, { type: "currency", label: "Cost" })).toBe("$0.05");
  });

  it("returns em dash for zero currency", () => {
    expect(formatStatValue(0, { type: "currency", label: "Cost" })).toBe("\u2014");
  });
});

describe("sortDirectionForType", () => {
  it("returns asc for currency (lower cost is better)", () => {
    expect(sortDirectionForType("currency")).toBe("asc");
  });

  it("returns desc for count (higher is better)", () => {
    expect(sortDirectionForType("count")).toBe("desc");
  });

  it("returns desc for rate (higher is better)", () => {
    expect(sortDirectionForType("rate")).toBe("desc");
  });

  it("returns desc for undefined type", () => {
    expect(sortDirectionForType(undefined)).toBe("desc");
  });
});
