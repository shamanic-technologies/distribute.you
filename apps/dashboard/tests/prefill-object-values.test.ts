import { describe, it, expect } from "vitest";
import { prefillToStringMap } from "../src/lib/api";

describe("prefillToStringMap", () => {
  it("should extract string values from format=text response", () => {
    const prefilled = {
      targetAudience: { value: "CTOs at SaaS startups" },
      targetOutcome: { value: "Book sales demos" },
    };
    expect(prefillToStringMap(prefilled)).toEqual({
      targetAudience: "CTOs at SaaS startups",
      targetOutcome: "Book sales demos",
    });
  });

  it("should convert null values to empty strings", () => {
    const prefilled = {
      urgency: { value: null },
      scarcity: { value: null },
    };
    expect(prefillToStringMap(prefilled)).toEqual({
      urgency: "",
      scarcity: "",
    });
  });

  it("should pass through plain strings unchanged", () => {
    const prefilled = {
      valueForTarget: { value: "The world's first trustless social welfare system" },
    };
    expect(prefillToStringMap(prefilled)).toEqual({
      valueForTarget: "The world's first trustless social welfare system",
    });
  });
});
