import { describe, it, expect } from "vitest";
import {
  DISTRIBUTION_FEATURES,
  DISTRIBUTION_STEPS,
} from "../src/features.js";

describe("DISTRIBUTION_FEATURES", () => {
  it("is sales-cold-email only (the off-message channels were stripped)", () => {
    expect(DISTRIBUTION_FEATURES).toHaveLength(1);
    expect(DISTRIBUTION_FEATURES[0].id).toBe("sales-outreach");
    const ids = DISTRIBUTION_FEATURES.map((f) => f.id);
    expect(ids).not.toContain("journalist-outreach");
    expect(ids).not.toContain("vc-outreach");
    expect(ids).not.toContain("hiring-outreach");
    expect(ids).not.toContain("influencer-outreach");
    expect(ids).not.toContain("linkedin-outreach");
  });

  it("each feature has required fields", () => {
    const validColors = ["emerald", "cyan", "blue", "violet", "pink", "amber"];
    for (const f of DISTRIBUTION_FEATURES) {
      expect(f.id).toBeTruthy();
      expect(f.title).toBeTruthy();
      expect(f.description).toBeTruthy();
      expect(f.metric).toBeTruthy();
      expect(["live", "coming-soon"]).toContain(f.status);
      expect(validColors).toContain(f.color);
    }
  });

  it("has at least one live feature", () => {
    const live = DISTRIBUTION_FEATURES.filter((f) => f.status === "live");
    expect(live.length).toBeGreaterThanOrEqual(1);
  });

  it("has unique ids", () => {
    const ids = DISTRIBUTION_FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("DISTRIBUTION_STEPS", () => {
  it("has 3 steps", () => {
    expect(DISTRIBUTION_STEPS).toHaveLength(3);
  });

  it("steps are numbered sequentially", () => {
    DISTRIBUTION_STEPS.forEach((step, i) => {
      expect(step.number).toBe(i + 1);
    });
  });

  it("each step has required fields", () => {
    for (const step of DISTRIBUTION_STEPS) {
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });
});
