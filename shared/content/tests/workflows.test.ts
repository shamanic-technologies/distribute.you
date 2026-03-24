import { describe, it, expect } from "vitest";
import {
  WORKFLOW_DEFINITIONS,
  getWorkflowDefinition,
  getWorkflowDefinitionsByCategory,
  parseWorkflowName,
  getFeatureSlug,
  getSignatureName,
  getWorkflowCategory,
  getWorkflowDisplayName,
  FEATURE_LABELS,
  WORKFLOW_CATEGORY_LABELS,
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
      expect(wf.category).toBeTruthy();
      expect(wf.channel).toBeTruthy();
      expect(wf.audienceType).toBeTruthy();
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
    expect(wf!.category).toBe("sales");
  });

  it("returns undefined for unknown featureSlug", () => {
    expect(getWorkflowDefinition("nonexistent")).toBeUndefined();
  });
});

describe("getWorkflowDefinitionsByCategory", () => {
  it("filters by sales", () => {
    const sales = getWorkflowDefinitionsByCategory("sales");
    expect(sales.length).toBeGreaterThanOrEqual(1);
    expect(sales.every((w) => w.category === "sales")).toBe(true);
  });

  it("filters by journalists", () => {
    const journalists = getWorkflowDefinitionsByCategory("journalists");
    expect(journalists.length).toBeGreaterThanOrEqual(2);
    expect(journalists.every((w) => w.category === "journalists")).toBe(true);
  });

  it("filters by outlets", () => {
    const outlets = getWorkflowDefinitionsByCategory("outlets");
    expect(outlets.length).toBeGreaterThanOrEqual(1);
    expect(outlets.every((w) => w.category === "outlets")).toBe(true);
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
      featureSlug: "sales-email-cold-outreach",
    });
  });

  it("parses journalists workflow name", () => {
    const result = parseWorkflowName("journalists-email-cold-outreach-sequoia");
    expect(result).toEqual({
      category: "journalists",
      channel: "email",
      audienceType: "cold-outreach",
      signatureName: "sequoia",
      featureSlug: "journalists-email-cold-outreach",
    });
  });

  it("parses press-kit generation workflow name", () => {
    const result = parseWorkflowName("press-kit-email-generation-v1");
    expect(result).toEqual({
      category: "press-kit",
      channel: "email",
      audienceType: "generation",
      signatureName: "v1",
      featureSlug: "press-kit-email-generation",
    });
  });

  it("parses outlets discovery workflow name", () => {
    const result = parseWorkflowName("outlets-database-discovery-cedar");
    expect(result).toEqual({
      category: "outlets",
      channel: "database",
      audienceType: "discovery",
      signatureName: "cedar",
      featureSlug: "outlets-database-discovery",
    });
  });

  it("parses journalists discovery workflow name", () => {
    const result = parseWorkflowName("journalists-database-discovery-birch");
    expect(result).toEqual({
      category: "journalists",
      channel: "database",
      audienceType: "discovery",
      signatureName: "birch",
      featureSlug: "journalists-database-discovery",
    });
  });

  it("returns null for invalid names", () => {
    expect(parseWorkflowName("invalid")).toBeNull();
    expect(parseWorkflowName("")).toBeNull();
    expect(parseWorkflowName("foo-bar")).toBeNull();
    expect(parseWorkflowName("unknown-email-cold-outreach-sienna")).toBeNull();
    // "pr" is no longer a known category
    expect(parseWorkflowName("pr-email-cold-outreach-sequoia")).toBeNull();
  });
});

describe("getFeatureSlug", () => {
  it("extracts section key from workflow name", () => {
    expect(getFeatureSlug("sales-email-cold-outreach-sienna")).toBe("sales-email-cold-outreach");
  });

  it("returns null for invalid names", () => {
    expect(getFeatureSlug("invalid")).toBeNull();
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
    expect(getWorkflowCategory("journalists-email-cold-outreach-sequoia")).toBe("journalists");
    expect(getWorkflowCategory("outlets-database-discovery-cedar")).toBe("outlets");
    expect(getWorkflowCategory("journalists-database-discovery-birch")).toBe("journalists");
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
    expect(WORKFLOW_CATEGORY_LABELS.journalists).toBe("Journalists");
    expect(WORKFLOW_CATEGORY_LABELS.outlets).toBe("Media Outlets");
    expect(WORKFLOW_CATEGORY_LABELS["press-kit"]).toBe("Press Kit");
  });
});
