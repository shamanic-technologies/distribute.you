import { describe, it, expect } from "vitest";
import {
  WORKFLOW_DEFINITIONS,
  getWorkflowDefinition,
  getWorkflowDefinitionsByCategory,
  parseWorkflowName,
  getSectionKey,
  getSignatureName,
  getWorkflowCategory,
  getWorkflowDisplayName,
  SECTION_LABELS,
  WORKFLOW_CATEGORY_LABELS,
} from "../src/workflows.js";

describe("WORKFLOW_DEFINITIONS", () => {
  it("has at least 2 workflow definitions", () => {
    expect(WORKFLOW_DEFINITIONS.length).toBeGreaterThanOrEqual(2);
  });

  it("each definition has required fields", () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      expect(wf.sectionKey).toBeTruthy();
      expect(wf.label).toBeTruthy();
      expect(wf.description).toBeTruthy();
      expect(wf.category).toBeTruthy();
      expect(wf.channel).toBeTruthy();
      expect(wf.audienceType).toBeTruthy();
      expect(wf.icon).toBeTruthy();
    }
  });

  it("each sectionKey has a matching SECTION_LABELS entry", () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      expect(SECTION_LABELS[wf.sectionKey]).toBeTruthy();
    }
  });
});

describe("getWorkflowDefinition", () => {
  it("returns definition for known sectionKey", () => {
    const wf = getWorkflowDefinition("sales-email-cold-outreach");
    expect(wf).toBeDefined();
    expect(wf!.category).toBe("sales");
  });

  it("returns undefined for unknown sectionKey", () => {
    expect(getWorkflowDefinition("nonexistent")).toBeUndefined();
  });
});

describe("getWorkflowDefinitionsByCategory", () => {
  it("filters by sales", () => {
    const sales = getWorkflowDefinitionsByCategory("sales");
    expect(sales.length).toBeGreaterThanOrEqual(1);
    expect(sales.every((w) => w.category === "sales")).toBe(true);
  });

  it("filters by pr", () => {
    const pr = getWorkflowDefinitionsByCategory("pr");
    expect(pr.length).toBeGreaterThanOrEqual(1);
    expect(pr.every((w) => w.category === "pr")).toBe(true);
  });
});

describe("parseWorkflowName", () => {
  it("parses a valid workflow name", () => {
    const result = parseWorkflowName("sales-email-cold-outreach-sienna");
    expect(result).toEqual({
      category: "sales",
      channel: "email",
      audienceType: "cold-outreach",
      signatureName: "sienna",
      sectionKey: "sales-email-cold-outreach",
    });
  });

  it("parses pr workflow name", () => {
    const result = parseWorkflowName("pr-email-cold-outreach-sequoia");
    expect(result).toEqual({
      category: "pr",
      channel: "email",
      audienceType: "cold-outreach",
      signatureName: "sequoia",
      sectionKey: "pr-email-cold-outreach",
    });
  });

  it("returns null for invalid names", () => {
    expect(parseWorkflowName("invalid")).toBeNull();
    expect(parseWorkflowName("")).toBeNull();
    expect(parseWorkflowName("foo-bar")).toBeNull();
    expect(parseWorkflowName("unknown-email-cold-outreach-sienna")).toBeNull();
  });
});

describe("getSectionKey", () => {
  it("extracts section key from workflow name", () => {
    expect(getSectionKey("sales-email-cold-outreach-sienna")).toBe("sales-email-cold-outreach");
  });

  it("returns null for invalid names", () => {
    expect(getSectionKey("invalid")).toBeNull();
  });
});

describe("getSignatureName", () => {
  it("extracts signature name from workflow name", () => {
    expect(getSignatureName("sales-email-cold-outreach-sienna")).toBe("sienna");
  });

  it("returns null for invalid names", () => {
    expect(getSignatureName("invalid")).toBeNull();
  });
});

describe("getWorkflowCategory", () => {
  it("returns category for valid workflow name", () => {
    expect(getWorkflowCategory("sales-email-cold-outreach-sienna")).toBe("sales");
    expect(getWorkflowCategory("pr-email-cold-outreach-sequoia")).toBe("pr");
  });

  it("returns null for invalid names", () => {
    expect(getWorkflowCategory("invalid")).toBeNull();
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

describe("WORKFLOW_CATEGORY_LABELS", () => {
  it("has labels for all categories", () => {
    expect(WORKFLOW_CATEGORY_LABELS.sales).toBe("Sales");
    expect(WORKFLOW_CATEGORY_LABELS.pr).toBe("PR & Media");
  });
});
