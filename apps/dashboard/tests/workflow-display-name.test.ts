import { describe, it, expect } from "vitest";
import { workflowDisplayName } from "../src/lib/workflow-display-name";

describe("workflowDisplayName", () => {
  it("returns workflowDynastyName when present (highest priority)", () => {
    expect(
      workflowDisplayName({
        workflowDynastyName: "Cold Outreach Jasmine",
        signatureName: "mintaka",
        workflowName: "sales-email-cold-outreach-headwater",
      })
    ).toBe("Cold Outreach Jasmine");
  });

  it("falls back to capitalized signatureName when workflowDynastyName is null", () => {
    expect(
      workflowDisplayName({
        signatureName: "mintaka",
        workflowDynastyName: null,
        workflowName: "sales-email-cold-outreach-headwater",
      })
    ).toBe("Mintaka");
  });

  it("falls back to workflowName when both signatureName and workflowDynastyName are absent", () => {
    expect(
      workflowDisplayName({
        signatureName: null,
        workflowDynastyName: null,
        workflowName: "sales-email-cold-outreach-headwater",
      })
    ).toBe("sales-email-cold-outreach-headwater");
  });

  it("falls back to workflowSlug when workflowName is also absent", () => {
    expect(
      workflowDisplayName({
        signatureName: null,
        workflowDynastyName: null,
        workflowSlug: "sales-email-cold-outreach-headwater",
      })
    ).toBe("sales-email-cold-outreach-headwater");
  });

  it("handles empty signatureName as falsy", () => {
    expect(
      workflowDisplayName({
        signatureName: "",
        workflowDynastyName: "fallback",
      })
    ).toBe("fallback");
  });

  it("handles non-string signatureName without crashing", () => {
    expect(
      workflowDisplayName({
        signatureName: 42 as unknown as string,
        workflowDynastyName: "fallback",
      })
    ).toBe("fallback");
  });
});
