import { describe, it, expect } from "vitest";
import {
  DISTRIBUTION_OUTCOMES,
  DISTRIBUTION_STEPS,
} from "../src/outcomes.js";

describe("DISTRIBUTION_OUTCOMES", () => {
  it("has at least 6 distribution outcomes", () => {
    expect(DISTRIBUTION_OUTCOMES.length).toBeGreaterThanOrEqual(6);
  });

  it("each outcome has required fields", () => {
    const validColors = ["emerald", "cyan", "blue", "violet", "pink", "amber"];
    for (const o of DISTRIBUTION_OUTCOMES) {
      expect(o.id).toBeTruthy();
      expect(o.title).toBeTruthy();
      expect(o.description).toBeTruthy();
      expect(o.metric).toBeTruthy();
      expect(["live", "coming-soon"]).toContain(o.status);
      expect(validColors).toContain(o.color);
    }
  });

  it("each outcome has a unique color", () => {
    const colors = DISTRIBUTION_OUTCOMES.map((o) => o.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("has at least one live outcome", () => {
    const live = DISTRIBUTION_OUTCOMES.filter((o) => o.status === "live");
    expect(live.length).toBeGreaterThanOrEqual(1);
  });

  it("has unique ids", () => {
    const ids = DISTRIBUTION_OUTCOMES.map((o) => o.id);
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
