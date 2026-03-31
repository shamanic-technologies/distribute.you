import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const fetchLeaderboardPath = path.resolve(
  __dirname,
  "../src/lib/fetch-leaderboard.ts"
);
const content = fs.readFileSync(fetchLeaderboardPath, "utf-8");

describe("Performance-service uses public ranked/best endpoints", () => {
  it("should call /public/features to get feature list", () => {
    expect(content).toContain("/public/features");
  });

  it("should call /v1/public/features/ranked with featureDynastySlug and objective params", () => {
    expect(content).toContain("/v1/public/features/ranked");
    expect(content).toContain("featureDynastySlug");
    expect(content).toContain("objective");
  });

  it("should call /v1/public/features/best with featureDynastySlug for hero stats", () => {
    expect(content).toContain("/v1/public/features/best");
    expect(content).toContain("featureDynastySlug");
  });

  it("should merge ranked results by workflow slug", () => {
    expect(content).toContain("mergeRankedResults");
  });

  it("should make 4 parallel calls per feature for objectives: emailsSent, emailsOpened, emailsClicked, emailsReplied", () => {
    expect(content).toContain("emailsSent");
    expect(content).toContain("emailsOpened");
    expect(content).toContain("emailsClicked");
    expect(content).toContain("emailsReplied");
  });

  it("should aggregate brand stats from ranked items", () => {
    expect(content).toContain("aggregateBrandsFromRankedItems");
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

  it("should contain featureDynastySlug=sales-cold-email-outreach in the ranked URL", () => {
    expect(landingContent).toContain("featureDynastySlug=sales-cold-email-outreach");
    expect(landingContent).toContain("/v1/public/features/ranked");
  });

  it("should contain objective=emailsReplied in the ranked URL", () => {
    expect(landingContent).toContain("objective=emailsReplied");
  });

  it("should not use the old /performance/leaderboard endpoint", () => {
    expect(landingContent).not.toContain("/performance/leaderboard");
  });
});

describe("Sales landing uses public best endpoint", () => {
  const salesPath = path.resolve(
    __dirname,
    "../../sales-cold-emails-landing/src/app/page.tsx"
  );
  const salesContent = fs.readFileSync(salesPath, "utf-8");

  it("should call /v1/public/features/best with featureDynastySlug=sales-cold-email-outreach", () => {
    expect(salesContent).toContain("featureDynastySlug=sales-cold-email-outreach");
    expect(salesContent).toContain("/v1/public/features/best");
  });

  it("should not use the old /api/leaderboard endpoint", () => {
    expect(salesContent).not.toContain("/api/leaderboard");
  });
});
