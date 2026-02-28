import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Feature campaigns list page", () => {
  const pagePath = path.resolve(
    __dirname,
    "../src/app/(dashboard)/features/[featureId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should be a client component", () => {
    expect(content).toContain('"use client"');
  });

  describe("Campaigns list", () => {
    it("should have campaigns-list test id", () => {
      expect(content).toContain("campaigns-list");
    });

    it("should have campaign-card test id", () => {
      expect(content).toContain("campaign-card");
    });

    it("should use listCampaigns for data", () => {
      expect(content).toContain("listCampaigns");
    });

    it("should use getCampaignBatchStats for stats", () => {
      expect(content).toContain("getCampaignBatchStats");
    });

    it("should filter campaigns by featureId", () => {
      expect(content).toContain("workflowName?.startsWith(featureId)");
    });
  });

  describe("Create Campaign link", () => {
    it("should have create-campaign-link test id", () => {
      expect(content).toContain("create-campaign-link");
    });

    it("should link to /new subpage", () => {
      expect(content).toContain("/features/${featureId}/new");
    });

    it("should show Create Campaign text", () => {
      expect(content).toContain("Create Campaign");
    });
  });

  describe("Stats overview", () => {
    it("should have campaigns-stats test id", () => {
      expect(content).toContain("campaigns-stats");
    });

    it("should show aggregated stat cards", () => {
      expect(content).toContain("Campaigns");
      expect(content).toContain("Leads");
      expect(content).toContain("Sent");
      expect(content).toContain("Opened");
      expect(content).toContain("Replied");
      expect(content).toContain("Total Cost");
    });
  });

  describe("Campaign card details", () => {
    it("should show campaign status badges", () => {
      expect(content).toContain("ongoing");
      expect(content).toContain("completed");
      expect(content).toContain("failed");
    });

    it("should show campaign stats", () => {
      expect(content).toContain("leadsServed");
      expect(content).toContain("emailsSent");
      expect(content).toContain("emailsReplied");
    });

    it("should show time ago for creation", () => {
      expect(content).toContain("timeAgo");
      expect(content).toContain("createdAt");
    });
  });

  it("should NOT contain old workflow table content", () => {
    expect(content).not.toContain("SortHeader");
    expect(content).not.toContain("mode-selector");
    expect(content).not.toContain("Autopilot");
    expect(content).not.toContain("budget-controls");
  });
});

describe("Create campaign page", () => {
  const pagePath = path.resolve(
    __dirname,
    "../src/app/(dashboard)/features/[featureId]/new/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should be a client component", () => {
    expect(content).toContain('"use client"');
  });

  it("should have back link to campaigns", () => {
    expect(content).toContain("Back to campaigns");
    expect(content).toContain("/features/${featureId}");
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

  describe("Sort direction", () => {
    it("should sort cost metrics ascending by default (lower is better)", () => {
      expect(content).toContain("defaultSortDir");
      expect(content).toContain('COST_METRICS');
      expect(content).toContain('"asc"');
    });

    it("should sort rate metrics descending by default (higher is better)", () => {
      expect(content).toContain('"desc"');
    });

    it("should include all cost metrics in COST_METRICS set", () => {
      expect(content).toContain("costPerOpenCents");
      expect(content).toContain("costPerClickCents");
      expect(content).toContain("costPerReplyCents");
    });

    it("should use defaultSortDir when changing metric via dropdown", () => {
      expect(content).toContain("setSortDir(defaultSortDir(key))");
    });

    it("should use defaultSortDir when changing metric via header click", () => {
      expect(content).toContain("setSortDir(defaultSortDir(key))");
    });

    it("should initialize sort direction as asc for default costPerReplyCents metric", () => {
      expect(content).toContain('useState<"asc" | "desc">("asc")');
    });
  });

  describe("Data source", () => {
    it("should use fetchSectionLeaderboard for data", () => {
      expect(content).toContain("fetchSectionLeaderboard");
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

  it("should have brandId in Campaign type", () => {
    expect(content).toContain("brandId: string | null");
  });
});
