import { describe, it, expect } from "vitest";
import { workflowDisplayName } from "../src/lib/workflow-display-name";

describe("workflowDisplayName", () => {
  it("returns workflowDynastyName when present (highest priority)", () => {
    expect(
      workflowDisplayName({
        workflowDynastyName: "Cold Outreach Jasmine",
        workflowDynastySignatureName: "mintaka",
        workflowName: "sales-email-cold-outreach-headwater",
      })
    ).toBe("Cold Outreach Jasmine");
  });

  it("falls back to capitalized workflowDynastySignatureName when workflowDynastyName is null", () => {
    expect(
      workflowDisplayName({
        workflowDynastySignatureName: "mintaka",
        workflowDynastyName: null,
        workflowName: "sales-email-cold-outreach-headwater",
      })
    ).toBe("Mintaka");
  });

  it("falls back to workflowName when both workflowDynastySignatureName and workflowDynastyName are absent", () => {
    expect(
      workflowDisplayName({
        workflowDynastySignatureName: null,
        workflowDynastyName: null,
        workflowName: "sales-email-cold-outreach-headwater",
      })
    ).toBe("sales-email-cold-outreach-headwater");
  });

  it("falls back to workflowSlug when workflowName is also absent", () => {
    expect(
      workflowDisplayName({
        workflowDynastySignatureName: null,
        workflowDynastyName: null,
        workflowSlug: "sales-email-cold-outreach-headwater",
      })
    ).toBe("sales-email-cold-outreach-headwater");
  });

  it("handles empty workflowDynastySignatureName as falsy", () => {
    expect(
      workflowDisplayName({
        workflowDynastySignatureName: "",
        workflowDynastyName: "fallback",
      })
    ).toBe("fallback");
  });

  it("handles non-string workflowDynastySignatureName without crashing", () => {
    expect(
      workflowDisplayName({
        workflowDynastySignatureName: 42 as unknown as string,
        workflowDynastyName: "fallback",
      })
    ).toBe("fallback");
  });
});
