import { describe, it, expect } from "vitest";
import { workflowDisplayName } from "../src/lib/workflow-display-name";

describe("workflowDisplayName", () => {
  it("returns dynastyName when present (highest priority)", () => {
    expect(
      workflowDisplayName({
        dynastyName: "Cold Outreach Jasmine",
        signatureName: "mintaka",
        name: "sales-email-cold-outreach-headwater",
      })
    ).toBe("Cold Outreach Jasmine");
  });

  it("falls back to capitalized signatureName when dynastyName is null", () => {
    expect(
      workflowDisplayName({
        signatureName: "mintaka",
        dynastyName: null,
        name: "sales-email-cold-outreach-headwater",
      })
    ).toBe("Mintaka");
  });

  it("falls back to name when both signatureName and dynastyName are absent", () => {
    expect(
      workflowDisplayName({
        signatureName: null,
        dynastyName: null,
        name: "sales-email-cold-outreach-headwater",
      })
    ).toBe("sales-email-cold-outreach-headwater");
  });

  it("falls back to workflowSlug when name is also absent", () => {
    expect(
      workflowDisplayName({
        signatureName: null,
        dynastyName: null,
        workflowSlug: "sales-email-cold-outreach-headwater",
      })
    ).toBe("sales-email-cold-outreach-headwater");
  });

  it("handles empty signatureName as falsy", () => {
    expect(
      workflowDisplayName({
        signatureName: "",
        dynastyName: "fallback",
      })
    ).toBe("fallback");
  });

  it("handles non-string signatureName without crashing", () => {
    expect(
      workflowDisplayName({
        signatureName: 42 as unknown as string,
        dynastyName: "fallback",
      })
    ).toBe("fallback");
  });
});
