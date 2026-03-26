import { describe, it, expect } from "vitest";
import {
  WORKFLOW_DEFINITIONS,
  getWorkflowDefinition,
  getWorkflowDisplayName,
  FEATURE_LABELS,
} from "../src/workflows.js";

describe("WORKFLOW_DEFINITIONS", () => {
  it("has at least 2 workflow definitions", () => {
    expect(WORKFLOW_DEFINITIONS.length).toBeGreaterThanOrEqual(2);
  });

  it("each definition has required fields", () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      expect(wf.featureSlug).toBeTruthy();
      expect(wf.label).toBeTruthy();
      expect(wf.description).toBeTruthy();
      expect(wf.icon).toBeTruthy();
      expect(typeof wf.implemented).toBe("boolean");
    }
  });

  it("each featureSlug has a matching FEATURE_LABELS entry", () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      expect(FEATURE_LABELS[wf.featureSlug]).toBeTruthy();
    }
  });
});

describe("getWorkflowDefinition", () => {
  it("returns definition for known featureSlug", () => {
    const wf = getWorkflowDefinition("sales-email-cold-outreach");
    expect(wf).toBeDefined();
    expect(wf!.featureSlug).toBe("sales-email-cold-outreach");
  });

  it("returns undefined for unknown featureSlug", () => {
    expect(getWorkflowDefinition("nonexistent")).toBeUndefined();
  });
});

describe("getWorkflowDisplayName", () => {
  it("capitalizes the signature name for valid workflow names", () => {
    expect(getWorkflowDisplayName("sales-email-cold-outreach-sienna")).toBe("Sienna");
  });

  it("title-cases the raw name for invalid format", () => {
    expect(getWorkflowDisplayName("my-custom-thing")).toBe("My Custom Thing");
  });
});
