import { describe, it, expect } from "vitest";
import { computeBestStats, minPositive } from "../../src/lib/best-stats";
import type { BrandLeaderboardEntry, WorkflowLeaderboardEntry } from "../../src/lib/fetch-leaderboard";

function makeWorkflow(overrides: Partial<WorkflowLeaderboardEntry> = {}): WorkflowLeaderboardEntry {
  return {
    workflowName: "test-workflow",
    dynastyName: "Test Workflow",
    signatureName: null,
    category: null,
    featureSlug: null,
    runCount: 1,
    emailsSent: 100,
    emailsOpened: 20,
    emailsClicked: 5,
    emailsReplied: 3,
    totalCostUsdCents: 500,
    openRate: 0.2,
    clickRate: 0.05,
    replyRate: 0.03,
    costPerOpenCents: 25,
    costPerClickCents: 100,
    costPerReplyCents: 167,
    ...overrides,
  };
}

function makeBrand(overrides: Partial<BrandLeaderboardEntry> = {}): BrandLeaderboardEntry {
  return {
    brandId: "brand-1",
    brandUrl: "https://acme.com",
    brandDomain: "acme.com",
    emailsSent: 100,
    emailsOpened: 20,
    emailsClicked: 5,
    emailsReplied: 3,
    totalCostUsdCents: 500,
    openRate: 0.2,
    clickRate: 0.05,
    replyRate: 0.03,
    costPerOpenCents: 25,
    costPerClickCents: 100,
    costPerReplyCents: 167,
    ...overrides,
  };
}

describe("minPositive", () => {
  it("returns the smallest positive value", () => {
    expect(minPositive([10, 5, 20])).toBe(5);
  });

  it("ignores null and zero values", () => {
    expect(minPositive([null, 0, 15, null, 8])).toBe(8);
  });

  it("returns null when all values are null or zero", () => {
    expect(minPositive([null, 0, null])).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(minPositive([])).toBeNull();
  });
});

describe("computeBestStats", () => {
  describe("workflow tab", () => {
    it("picks max rates and min costs across workflows", () => {
      const workflows = [
        makeWorkflow({ openRate: 0.15, replyRate: 0.02, costPerOpenCents: 30, costPerReplyCents: 200 }),
        makeWorkflow({ openRate: 0.25, replyRate: 0.05, costPerOpenCents: 20, costPerReplyCents: 150 }),
        makeWorkflow({ openRate: 0.10, replyRate: 0.08, costPerOpenCents: 50, costPerReplyCents: 100 }),
      ];

      const result = computeBestStats(workflows, [], "workflow");

      expect(result.openRate).toBe(0.25);
      expect(result.replyRate).toBe(0.08);
      expect(result.costPerOpenCents).toBe(20);
      expect(result.costPerReplyCents).toBe(100);
    });

    it("ignores workflows with zero emailsSent for rates", () => {
      const workflows = [
        makeWorkflow({ emailsSent: 0, openRate: 0, replyRate: 0, costPerOpenCents: null, costPerReplyCents: null }),
        makeWorkflow({ emailsSent: 50, openRate: 0.10, replyRate: 0.04, costPerOpenCents: 40, costPerReplyCents: 120 }),
      ];

      const result = computeBestStats(workflows, [], "workflow");

      expect(result.openRate).toBe(0.10);
      expect(result.replyRate).toBe(0.04);
    });

    it("returns zeros when no workflows have emails", () => {
      const workflows = [
        makeWorkflow({ emailsSent: 0, openRate: 0, replyRate: 0 }),
      ];

      const result = computeBestStats(workflows, [], "workflow");

      expect(result.openRate).toBe(0);
      expect(result.replyRate).toBe(0);
    });

    it("returns null costs when all costs are null", () => {
      const workflows = [
        makeWorkflow({ costPerOpenCents: null, costPerReplyCents: null }),
      ];

      const result = computeBestStats(workflows, [], "workflow");

      expect(result.costPerOpenCents).toBeNull();
      expect(result.costPerReplyCents).toBeNull();
    });
  });

  describe("brand tab", () => {
    it("picks max rates and min costs across brands", () => {
      const brands = [
        makeBrand({ openRate: 0.12, replyRate: 0.03, costPerOpenCents: 35, costPerReplyCents: 180 }),
        makeBrand({ openRate: 0.22, replyRate: 0.06, costPerOpenCents: 18, costPerReplyCents: 90 }),
      ];

      const result = computeBestStats([], brands, "brand");

      expect(result.openRate).toBe(0.22);
      expect(result.replyRate).toBe(0.06);
      expect(result.costPerOpenCents).toBe(18);
      expect(result.costPerReplyCents).toBe(90);
    });

    it("ignores brands with zero emailsSent for rates", () => {
      const brands = [
        makeBrand({ emailsSent: 0, openRate: 0, replyRate: 0 }),
        makeBrand({ emailsSent: 30, openRate: 0.15, replyRate: 0.05 }),
      ];

      const result = computeBestStats([], brands, "brand");

      expect(result.openRate).toBe(0.15);
      expect(result.replyRate).toBe(0.05);
    });
  });
});
