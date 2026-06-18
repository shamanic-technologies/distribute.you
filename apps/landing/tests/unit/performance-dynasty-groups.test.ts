import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const fetchPath = path.resolve(
  __dirname,
  "../../src/lib/performance/fetch-leaderboard.ts"
);
const content = fs.readFileSync(fetchPath, "utf-8");

describe("Performance leaderboard groups by base dynasty name", () => {
  it("defines exactly 1 base group (sales cold email only — other channels stay alpha)", () => {
    const groupMatches = content.match(/label:\s*"[^"]+"/g);
    expect(groupMatches).toHaveLength(1);
  });

  it("includes Sales Cold Email Outreach group", () => {
    expect(content).toContain('"Sales Cold Email Outreach"');
    expect(content).toContain('"sales-cold-email-outreach"');
  });

  it("does NOT surface non-GA channels (hiring / PR) on the public leaderboard", () => {
    expect(content).not.toContain('"Hiring Cold Email Outreach"');
    expect(content).not.toContain('"PR Cold Email Outreach"');
  });

  it("filters features through resolveBaseGroup before fetching", () => {
    expect(content).toContain("resolveBaseGroup(f.slug) !== null");
  });

  it("aggregates brands per group via aggregateBrands", () => {
    expect(content).toContain("aggregateBrands(allBrandArrays)");
  });

  it("uses env-aware API URL resolution", () => {
    expect(content).toContain("resolveApiUrl");
    expect(content).toContain('hostname.includes("staging")');
  });
});
