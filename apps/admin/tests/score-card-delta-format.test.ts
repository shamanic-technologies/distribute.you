import { describe, it, expect } from "vitest";
import { formatDelta } from "../src/components/visibility/score-card";

describe("formatDelta", () => {
  it("renders percent format with pp suffix", () => {
    const r = formatDelta(0.46, "percent", false);
    expect(r?.text).toBe("▲ 46.0pp");
    expect(r?.className).toBe("text-green-600");
  });

  it("renders absolute format without pp suffix for small deltas", () => {
    const r = formatDelta(-0.12, "absolute", false);
    expect(r?.text).toBe("▼ 0.12");
    expect(r?.className).toBe("text-red-600");
  });

  it("renders absolute format without pp suffix for large deltas", () => {
    const r = formatDelta(2.5, "absolute", false);
    expect(r?.text).toBe("▲ 2.50");
  });

  it("returns null for null/undefined/zero delta", () => {
    expect(formatDelta(null, "percent", false)).toBeNull();
    expect(formatDelta(undefined, "absolute", false)).toBeNull();
    expect(formatDelta(0, "percent", false)).toBeNull();
  });

  it("inverts color when deltaInverted=true and delta negative", () => {
    const r = formatDelta(-0.05, "percent", true);
    expect(r?.text).toBe("▼ 5.0pp");
    expect(r?.className).toBe("text-green-600");
  });

  it("inverts color when deltaInverted=true and delta positive (bad)", () => {
    const r = formatDelta(0.05, "percent", true);
    expect(r?.className).toBe("text-red-600");
  });
});
