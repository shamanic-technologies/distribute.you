import { describe, it, expect } from "vitest";
import {
  WORKFLOW_DEFINITIONS,
  getWorkflowDefinition,
  getWorkflowDefinitionsByCategory,
  getWorkflowDefinitionsByTag,
  getWorkflowDefinitionsByOutcome,
  parseWorkflowName,
  getSectionKey,
  getSignatureName,
  getWorkflowCategory,
  getWorkflowDisplayName,
  SECTION_LABELS,
  WORKFLOW_CATEGORY_LABELS,
  OUTCOME_LABELS,
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
      expect(typeof wf.implemented).toBe("boolean");
      expect(Array.isArray(wf.targetOutcomes)).toBe(true);
      expect(wf.targetOutcomes.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(wf.tags)).toBe(true);
      expect(wf.tags.length).toBeGreaterThanOrEqual(1);
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

  it("filters by journalists", () => {
    const journalists = getWorkflowDefinitionsByCategory("journalists");
    expect(journalists.length).toBeGreaterThanOrEqual(1);
    expect(journalists.every((w) => w.category === "journalists")).toBe(true);
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

  it("parses journalists workflow name", () => {
    const result = parseWorkflowName("journalists-email-cold-outreach-sequoia");
    expect(result).toEqual({
      category: "journalists",
      channel: "email",
      audienceType: "cold-outreach",
      signatureName: "sequoia",
      sectionKey: "journalists-email-cold-outreach",
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
    expect(getWorkflowCategory("journalists-email-cold-outreach-sequoia")).toBe("journalists");
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

describe("getWorkflowDefinitionsByTag", () => {
  it("filters by email tag", () => {
    const email = getWorkflowDefinitionsByTag("email");
    expect(email.length).toBeGreaterThanOrEqual(1);
    expect(email.every((w) => w.tags.includes("email"))).toBe(true);
  });

  it("filters by outbound tag", () => {
    const outbound = getWorkflowDefinitionsByTag("outbound");
    expect(outbound.length).toBeGreaterThanOrEqual(1);
    expect(outbound.every((w) => w.tags.includes("outbound"))).toBe(true);
  });

  it("returns empty for unknown tag", () => {
    expect(getWorkflowDefinitionsByTag("nonexistent")).toHaveLength(0);
  });
});

describe("getWorkflowDefinitionsByOutcome", () => {
  it("finds workflows targeting interested-replies", () => {
    const replies = getWorkflowDefinitionsByOutcome("interested-replies");
    expect(replies.length).toBeGreaterThanOrEqual(1);
    expect(replies.every((w) => w.targetOutcomes.includes("interested-replies"))).toBe(true);
  });

  it("finds workflows targeting press-coverage", () => {
    const press = getWorkflowDefinitionsByOutcome("press-coverage");
    expect(press.length).toBeGreaterThanOrEqual(1);
    expect(press[0].sectionKey).toBe("journalists-email-cold-outreach");
  });

  it("returns empty for unknown outcome", () => {
    expect(getWorkflowDefinitionsByOutcome("interested-replies")).not.toHaveLength(0);
  });
});

describe("WORKFLOW_CATEGORY_LABELS", () => {
  it("has labels for all categories", () => {
    expect(WORKFLOW_CATEGORY_LABELS.sales).toBe("Sales");
    expect(WORKFLOW_CATEGORY_LABELS.journalists).toBe("Journalists");
  });
});

describe("OUTCOME_LABELS", () => {
  it("has labels for all outcome types used in workflow definitions", () => {
    for (const wf of WORKFLOW_DEFINITIONS) {
      for (const outcome of wf.targetOutcomes) {
        expect(OUTCOME_LABELS[outcome]).toBeTruthy();
      }
    }
  });

  it("has expected labels", () => {
    expect(OUTCOME_LABELS["interested-replies"]).toBe("Sales Replies");
    expect(OUTCOME_LABELS["press-coverage"]).toBe("Press Coverage");
  });
});
