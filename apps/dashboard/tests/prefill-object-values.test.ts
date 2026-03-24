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

  it("should flatten JSON object values with elements array", () => {
    const prefilled = {
      urgency: { value: '{"elements":["Monthly KPI requirements","Token Generation Event planned for Q1"]}' },
    };
    const result = prefillToStringMap(prefilled);
    expect(result.urgency).toBe("Monthly KPI requirements\nToken Generation Event planned for Q1");
  });

  it("should flatten JSON object values with mixed null fields", () => {
    const prefilled = {
      riskReversal: { value: '{"notes":"Rewards paid after KPI verification","trials":null,"guarantees":null,"refundPolicy":null}' },
    };
    const result = prefillToStringMap(prefilled);
    expect(result.riskReversal).toBe("Rewards paid after KPI verification");
  });

  it("should flatten nested JSON objects", () => {
    const prefilled = {
      socialProof: { value: '{"metrics":{"users":1491,"donated":"$3,105.3"},"caseStudies":null,"testimonials":null}' },
    };
    const result = prefillToStringMap(prefilled);
    expect(result.socialProof).toContain("1491");
    expect(result.socialProof).toContain("$3,105.3");
  });

  it("should return plain strings unchanged", () => {
    const prefilled = {
      valueForTarget: { value: "The world's first trustless social welfare system" },
    };
    expect(prefillToStringMap(prefilled)).toEqual({
      valueForTarget: "The world's first trustless social welfare system",
    });
  });
});
