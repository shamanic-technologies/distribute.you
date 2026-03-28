import { describe, it, expect } from "vitest";
import { workflowDisplayName } from "../src/lib/workflow-display-name";

describe("workflowDisplayName", () => {
  it("returns displayName when present (even if signatureName exists)", () => {
    expect(
      workflowDisplayName({
        signatureName: "mintaka",
        displayName: "Cold Outreach Jasmine",
        name: "sales-email-cold-outreach-headwater",
      })
    ).toBe("Cold Outreach Jasmine");
  });

  it("falls back to capitalized signatureName when displayName is null", () => {
    expect(
      workflowDisplayName({
        signatureName: "mintaka",
        displayName: null,
        name: "sales-email-cold-outreach-headwater",
      })
    ).toBe("Mintaka");
  });

  it("falls back to name when both signatureName and displayName are absent", () => {
    expect(
      workflowDisplayName({
        signatureName: null,
        displayName: null,
        name: "sales-email-cold-outreach-headwater",
      })
    ).toBe("sales-email-cold-outreach-headwater");
  });

  it("falls back to workflowSlug when name is also absent", () => {
    expect(
      workflowDisplayName({
        signatureName: null,
        displayName: null,
        workflowSlug: "sales-email-cold-outreach-headwater",
      })
    ).toBe("sales-email-cold-outreach-headwater");
  });

  it("handles empty signatureName as falsy", () => {
    expect(
      workflowDisplayName({
        signatureName: "",
        displayName: "fallback",
      })
    ).toBe("fallback");
  });

  it("handles non-string signatureName without crashing", () => {
    expect(
      workflowDisplayName({
        signatureName: 42 as unknown as string,
        displayName: "fallback",
      })
    ).toBe("fallback");
  });
});
