import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const fetchLeaderboardPath = path.resolve(
  __dirname,
  "../src/lib/fetch-leaderboard.ts"
);
const content = fs.readFileSync(fetchLeaderboardPath, "utf-8");

describe("Performance-service uses public ranked/best endpoints", () => {
  it("should call /v1/public/workflows/ranked instead of /v1/stats/leaderboard", () => {
    expect(content).toContain("/v1/public/workflows/ranked");
    expect(content).not.toContain("/v1/stats/leaderboard");
  });

  it("should call /v1/public/workflows/best for hero stats", () => {
    expect(content).toContain("/v1/public/workflows/best");
  });

  it("should transform ranked items to WorkflowLeaderboardEntry", () => {
    expect(content).toContain("rankedToWorkflowEntry");
    expect(content).toContain("stats.email?.broadcast");
    expect(content).toContain("stats.totalCostInUsdCents");
  });

  it("should compute featureSlug from category-channel-audienceType", () => {
    expect(content).toContain("workflow.category}-${item.workflow.channel}-${item.workflow.audienceType");
  });

  it("should aggregate brand stats from ranked items", () => {
    expect(content).toContain("aggregateBrandStats");
  });

  it("should build category sections from workflow entries", () => {
    expect(content).toContain("buildFeatureGroups");
  });

  it("should enrich brands from brand-service", () => {
    expect(content).toContain("enrichBrands");
    expect(content).toContain("/brands/batch");
  });

  it("should resolve brand domain for best/hero stats", () => {
    expect(content).toContain("resolveBrandDomain");
  });

  it("should still export the same public types", () => {
    expect(content).toContain("export interface BrandLeaderboardEntry");
    expect(content).toContain("export interface WorkflowLeaderboardEntry");
    expect(content).toContain("export interface HeroStats");
    expect(content).toContain("export interface FeatureGroupData");
    expect(content).toContain("export interface LeaderboardData");
    expect(content).toContain("export async function fetchLeaderboard");
  });
});

describe("Landing page uses public ranked endpoint", () => {
  const landingPath = path.resolve(
    __dirname,
    "../../landing/src/lib/fetch-leaderboard.ts"
  );
  const landingContent = fs.readFileSync(landingPath, "utf-8");

  it("should call /v1/public/workflows/ranked instead of /performance/leaderboard", () => {
    expect(landingContent).toContain("/v1/public/workflows/ranked");
    expect(landingContent).not.toContain("/performance/leaderboard");
  });
});

describe("Sales landing uses public best endpoint", () => {
  const salesPath = path.resolve(
    __dirname,
    "../../sales-cold-emails-landing/src/app/page.tsx"
  );
  const salesContent = fs.readFileSync(salesPath, "utf-8");

  it("should call /v1/public/workflows/best instead of /api/leaderboard", () => {
    expect(salesContent).toContain("/v1/public/workflows/best");
    expect(salesContent).not.toContain("/api/leaderboard");
  });
});
