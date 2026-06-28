import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  goalForOptimizationGoal,
  modelAvatar,
  objectiveForOptimizationGoal,
  outcomeNoun,
  projectionCostKey,
  selectBestModelEvidence,
} from "../src/lib/strategy-model";
import type { FeatureCandidate } from "../src/lib/api";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

function candidate(over: Partial<FeatureCandidate> & {
  workflowDynastySlug: string;
  audienceId: string | null;
  costGrain: "goal-global" | "audience";
  costPerOutcomeUsd: number | null;
}): FeatureCandidate {
  return {
    audienceId: over.audienceId,
    workflow: { workflowDynastySlug: over.workflowDynastySlug, workflowDynastyName: "Pelican" },
    goal: "meetingBooked",
    grain: over.costGrain === "audience" ? "audience" : "goal-global",
    costPerOutcomeUsd: over.costPerOutcomeUsd,
    conversion: { rate: 0.1, grain: "brand-goal", sampleSize: null },
    cost: {
      costPerLeadUsd: 1,
      clickUsd: 2,
      replyUsd: 3,
      grain: over.costGrain,
      sampleSize: { runs: 1, contacted: 1, clicks: 1, replies: 1 },
    },
  };
}

describe("strategy goal mapping", () => {
  it("maps the saved objective onto the candidates goal enum", () => {
    expect(goalForOptimizationGoal("signups")).toBe("signup");
    expect(goalForOptimizationGoal("sales_meetings")).toBe("meetingBooked");
  });
  it("maps the saved objective onto the projection objective", () => {
    expect(objectiveForOptimizationGoal("signups")).toBe("self-serve");
    expect(objectiveForOptimizationGoal("sales_meetings")).toBe("meeting-booked");
  });
  it("picks the projection cost field for the objective", () => {
    expect(projectionCostKey("signups")).toBe("costPerSignupUsd");
    expect(projectionCostKey("sales_meetings")).toBe("costPerMeetingBookedUsd");
  });
  it("names the outcome", () => {
    expect(outcomeNoun("signups")).toBe("signup");
    expect(outcomeNoun("sales_meetings")).toBe("meeting");
  });
});

describe("modelAvatar — deterministic placeholder face", () => {
  it("is stable for the same slug", () => {
    expect(modelAvatar("pelican-obsidian")).toEqual(modelAvatar("pelican-obsidian"));
  });
  it("returns an emoji + color", () => {
    const a = modelAvatar("anything");
    expect(typeof a.emoji).toBe("string");
    expect(a.color).toMatch(/^#/);
  });
});

describe("selectBestModelEvidence — groups served rows, never computes", () => {
  const candidates: FeatureCandidate[] = [
    candidate({ workflowDynastySlug: "best", audienceId: null, costGrain: "goal-global", costPerOutcomeUsd: 50 }),
    candidate({ workflowDynastySlug: "best", audienceId: "a1", costGrain: "audience", costPerOutcomeUsd: 40 }),
    candidate({ workflowDynastySlug: "best", audienceId: "a2", costGrain: "audience", costPerOutcomeUsd: 60 }),
    candidate({ workflowDynastySlug: "other", audienceId: "a3", costGrain: "audience", costPerOutcomeUsd: 99 }),
  ];

  it("returns the cross-org row for the best workflow", () => {
    const e = selectBestModelEvidence(candidates, "best");
    expect(e.crossOrg?.costPerOutcomeUsd).toBe(50);
  });
  it("returns only the best workflow's per-audience rows", () => {
    const e = selectBestModelEvidence(candidates, "best");
    expect(e.audiences.map((c) => c.audienceId).sort()).toEqual(["a1", "a2"]);
  });
  it("is empty when there is no best pick", () => {
    const e = selectBestModelEvidence(candidates, null);
    expect(e.crossOrg).toBeNull();
    expect(e.audiences).toEqual([]);
  });
});

describe("StrategyPage source guards", () => {
  const page = read("../src/components/strategy/strategy-page.tsx");

  it("is beta-gated on the email allowlist", () => {
    expect(page).toContain("useIsBetaUser");
    expect(page).toContain("if (!isBeta) return <NotAvailable />");
  });
  it("carries a beta MaturityBadge", () => {
    expect(page).toContain('<MaturityBadge level="beta" />');
  });
  it("reads the best model + 3-level cost per outcome from served endpoints", () => {
    expect(page).toContain("getWorkflowProjection");
    expect(page).toContain("fetchFeatureCandidates");
    expect(page).toContain("recommendedWorkflowDynastySlug");
    expect(page).toContain("selectBestModelEvidence");
  });
  it("surfaces the agency-domain framing", () => {
    expect(page).toContain("on your behalf");
    expect(page).toContain("warmed sending domains");
  });
  it("offers example emails + the reassessment explainer", () => {
    expect(page).toContain("listWorkflowExamples");
    expect(page).toContain("How we pick the best model");
  });
});

describe("Strategy nav entry", () => {
  const sidebar = read("../src/components/context-sidebar.tsx");
  it("is wired as a beta-gated brand-level item", () => {
    expect(sidebar).toContain('id: "strategy"');
    expect(sidebar).toContain("revenueOk && isBeta");
    expect(sidebar).toContain('maturity: "beta"');
  });
  it("has a route page", () => {
    const route = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/strategy/page.tsx",
    );
    expect(route).toContain("StrategyPage");
  });
});
