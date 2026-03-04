import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/outcomes/[outcomeId]/new/page.tsx"
);
const content = fs.readFileSync(pagePath, "utf-8");

describe("Go button enabled when no leaderboard data but workflows exist", () => {
  it("should build displayRows from outcomeWorkflows when sorted is empty", () => {
    // displayRows falls back to outcomeWorkflows when no leaderboard data
    expect(content).toContain("if (sorted.length > 0) return sorted");
    expect(content).toContain("outcomeWorkflows.map");
  });

  it("should derive effectiveSelection from displayRows, not just sorted", () => {
    // effectiveSelection must use displayRows (which includes fallback workflows)
    expect(content).toContain("displayRows[0]?.workflowName");
    // It must NOT only depend on sorted (which would be null when no leaderboard)
    expect(content).not.toMatch(
      /effectiveSelection\s*=\s*mode\s*===\s*"autopilot"\s*\?\s*sorted\[0\]/
    );
  });

  it("should show workflow table when displayRows exist (not just sorted)", () => {
    // The empty-state guard must check displayRows, not sorted
    expect(content).toContain("displayRows.length === 0");
  });

  it("should compute outcomeWorkflows from workflowsData filtered by outcomeId", () => {
    expect(content).toContain(
      'w.name.startsWith(outcomeId)'
    );
    expect(content).toContain("outcomeWorkflows");
  });
});
