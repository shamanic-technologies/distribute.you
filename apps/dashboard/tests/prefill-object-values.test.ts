import { describe, it, expect } from "vitest";
import { prefillToStringMap, type PrefilledField } from "../src/lib/api";

describe("prefillToStringMap", () => {
  it("should convert string values directly", () => {
    const prefilled: Record<string, PrefilledField> = {
      targetAudience: { value: "CTOs at SaaS startups", cached: false, sourceUrls: [] },
    };
    expect(prefillToStringMap(prefilled)).toEqual({ targetAudience: "CTOs at SaaS startups" });
  });

  it("should join array values with newlines", () => {
    const prefilled: Record<string, PrefilledField> = {
      targetAudience: { value: ["CTOs", "VPs of Engineering"], cached: false, sourceUrls: [] },
    };
    expect(prefillToStringMap(prefilled)).toEqual({ targetAudience: "CTOs\nVPs of Engineering" });
  });

  it("should stringify object values instead of rendering [object Object]", () => {
    const prefilled: Record<string, PrefilledField> = {
      urgency: { value: { text: "Limited time offer" } as unknown as string, cached: false, sourceUrls: [] },
      scarcity: { value: { text: "Only 5 spots" } as unknown as string, cached: false, sourceUrls: [] },
    };
    const result = prefillToStringMap(prefilled);
    expect(result.urgency).not.toBe("[object Object]");
    expect(result.scarcity).not.toBe("[object Object]");
    expect(typeof result.urgency).toBe("string");
    expect(typeof result.scarcity).toBe("string");
  });
});
