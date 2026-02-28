import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Feature page redesign", () => {
  const pagePath = path.resolve(
    __dirname,
    "../src/app/(dashboard)/features/[featureId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should be a client component", () => {
    expect(content).toContain('"use client"');
  });

  describe("Performance table columns", () => {
    it("should have Workflow column", () => {
      expect(content).toContain("Workflow");
    });

    it("should have % Opens column", () => {
      expect(content).toContain("% Opens");
      expect(content).toContain("openRate");
    });

    it("should have % Clicks column", () => {
      expect(content).toContain("% Clicks");
      expect(content).toContain("clickRate");
    });

    it("should have % Replies column", () => {
      expect(content).toContain("% Replies");
      expect(content).toContain("replyRate");
    });

    it("should have $/Open column", () => {
      expect(content).toContain("$/Open");
      expect(content).toContain("costPerOpenCents");
    });

    it("should have $/Click column", () => {
      expect(content).toContain("$/Click");
      expect(content).toContain("costPerClickCents");
    });

    it("should have $/Reply column", () => {
      expect(content).toContain("$/Reply");
      expect(content).toContain("costPerReplyCents");
    });
  });

  describe("Mode selector", () => {
    it("should have Autopilot mode", () => {
      expect(content).toContain("Autopilot");
      expect(content).toContain('"autopilot"');
    });

    it("should have Manual mode", () => {
      expect(content).toContain("Manual");
      expect(content).toContain('"manual"');
    });

    it("should have mode-selector test id", () => {
      expect(content).toContain("mode-selector");
    });
  });

  describe("Metric dropdown", () => {
    it("should have metric selector", () => {
      expect(content).toContain("metric-selector");
    });

    it("should have all metric options", () => {
      expect(content).toContain("$/Reply");
      expect(content).toContain("$/Click");
      expect(content).toContain("% Replies");
      expect(content).toContain("% Clicks");
    });
  });

  describe("Budget controls", () => {
    it("should have budget controls", () => {
      expect(content).toContain("budget-controls");
    });

    it("should have budget amount input", () => {
      expect(content).toContain("budgetAmount");
    });

    it("should have all budget frequencies", () => {
      expect(content).toContain("one-off");
      expect(content).toContain("daily");
      expect(content).toContain("weekly");
      expect(content).toContain("monthly");
    });
  });

  describe("Go button", () => {
    it("should have Go button", () => {
      expect(content).toContain("go-button");
      expect(content).toContain("Go →");
    });
  });

  describe("Status display", () => {
    it("should have status display", () => {
      expect(content).toContain("status-display");
    });

    it("should handle campaign statuses", () => {
      expect(content).toContain("ongoing");
      expect(content).toContain("paused");
      expect(content).toContain("completed");
      expect(content).toContain("failed");
    });

    it("should have stop and resume actions", () => {
      expect(content).toContain("stopCampaign");
      expect(content).toContain("resumeCampaign");
    });
  });

  describe("Data source", () => {
    it("should use fetchSectionLeaderboard for data", () => {
      expect(content).toContain("fetchSectionLeaderboard");
    });

    it("should NOT use WorkflowCard (old grid removed)", () => {
      expect(content).not.toContain("WorkflowCard");
      expect(content).not.toContain("WorkflowDetailPanel");
    });

    it("should use leaderboard entry type", () => {
      expect(content).toContain("WorkflowLeaderboardEntry");
    });
  });

  describe("Campaign creation", () => {
    it("should have campaign creation form", () => {
      expect(content).toContain("campaign-form");
      expect(content).toContain("createCampaign");
    });

    it("should have required campaign fields", () => {
      expect(content).toContain("brandUrl");
      expect(content).toContain("targetAudience");
      expect(content).toContain("targetOutcome");
      expect(content).toContain("workflowName");
    });
  });
});

describe("API leaderboard function", () => {
  const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
  const content = fs.readFileSync(apiPath, "utf-8");

  it("should have WorkflowLeaderboardEntry type", () => {
    expect(content).toContain("interface WorkflowLeaderboardEntry");
    expect(content).toContain("openRate");
    expect(content).toContain("clickRate");
    expect(content).toContain("costPerOpenCents");
    expect(content).toContain("costPerClickCents");
    expect(content).toContain("costPerReplyCents");
  });

  it("should have fetchSectionLeaderboard function", () => {
    expect(content).toContain("fetchSectionLeaderboard");
    expect(content).toContain("/performance/leaderboard");
  });

  it("should have createCampaign function", () => {
    expect(content).toContain("createCampaign");
    expect(content).toContain("workflowName");
    expect(content).toContain("brandUrl");
  });
});
