import { describe, it, expect } from "vitest";
import {
  DISTRIBUTION_FEATURES,
  DISTRIBUTION_STEPS,
  SALES_FEATURES,
  SALES_STEPS,
  SALES_FAQ,
  SUPPORTED_CLIENTS,
  BYOK_PROVIDERS,
} from "../src/features.js";

describe("DISTRIBUTION_FEATURES", () => {
  it("has at least 6 distribution features", () => {
    expect(DISTRIBUTION_FEATURES.length).toBeGreaterThanOrEqual(6);
  });

  it("each feature has required fields", () => {
    for (const f of DISTRIBUTION_FEATURES) {
      expect(f.id).toBeTruthy();
      expect(f.title).toBeTruthy();
      expect(f.description).toBeTruthy();
      expect(f.metric).toBeTruthy();
      expect(["live", "coming-soon"]).toContain(f.status);
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

describe("existing exports still work", () => {
  it("SALES_FEATURES is still exported", () => {
    expect(SALES_FEATURES.length).toBeGreaterThanOrEqual(1);
  });

  it("SALES_STEPS is still exported", () => {
    expect(SALES_STEPS.length).toBeGreaterThanOrEqual(1);
  });

  it("SALES_FAQ is still exported", () => {
    expect(SALES_FAQ.length).toBeGreaterThanOrEqual(1);
  });

  it("SUPPORTED_CLIENTS is still exported", () => {
    expect(SUPPORTED_CLIENTS.length).toBeGreaterThanOrEqual(1);
  });

  it("BYOK_PROVIDERS is still exported", () => {
    expect(BYOK_PROVIDERS.length).toBeGreaterThanOrEqual(1);
  });
});
