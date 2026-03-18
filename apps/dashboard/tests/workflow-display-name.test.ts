import { describe, it, expect } from "vitest";
import { workflowDisplayName } from "../src/lib/workflow-display-name";

describe("workflowDisplayName", () => {
  it("returns capitalized signatureName when present", () => {
    expect(
      workflowDisplayName({
        signatureName: "mintaka",
        displayName: "sales-email-cold-outreach-jasmine",
        name: "sales-email-cold-outreach-headwater",
      })
    ).toBe("Mintaka");
  });

  it("falls back to displayName when signatureName is null", () => {
    expect(
      workflowDisplayName({
        signatureName: null,
        displayName: "sales-email-cold-outreach-jasmine",
        name: "sales-email-cold-outreach-headwater",
      })
    ).toBe("sales-email-cold-outreach-jasmine");
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

  it("falls back to workflowName when name is also absent", () => {
    expect(
      workflowDisplayName({
        signatureName: null,
        displayName: null,
        workflowName: "sales-email-cold-outreach-headwater",
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
});
