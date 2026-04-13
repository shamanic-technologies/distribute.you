import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const fetchPath = path.resolve(
  __dirname,
  "../../src/lib/performance/fetch-leaderboard.ts"
);
const content = fs.readFileSync(fetchPath, "utf-8");

describe("Performance leaderboard groups by base dynasty name", () => {
  it("defines exactly 3 base groups", () => {
    const groupMatches = content.match(/label:\s*"[^"]+"/g);
    expect(groupMatches).toHaveLength(3);
  });

  it("includes Hiring Cold Email Outreach group", () => {
    expect(content).toContain('"Hiring Cold Email Outreach"');
    expect(content).toContain('"hiring-cold-email-outreach"');
  });

  it("includes Sales Cold Email Outreach group", () => {
    expect(content).toContain('"Sales Cold Email Outreach"');
    expect(content).toContain('"sales-cold-email-outreach"');
  });

  it("includes PR Cold Email Outreach group merging sophia and berlin", () => {
    expect(content).toContain('"PR Cold Email Outreach"');
    expect(content).toContain('"pr-cold-email-outreach"');
    expect(content).toContain('"pr-cold-email-outreach-sophia"');
    expect(content).toContain('"pr-cold-email-outreach-berlin"');
  });

  it("filters features through resolveBaseGroup before fetching", () => {
    expect(content).toContain("resolveBaseGroup(f.dynastySlug) !== null");
  });

  it("aggregates brands per group via aggregateBrands", () => {
    expect(content).toContain("aggregateBrands(allBrandArrays)");
  });

  it("uses env-aware API URL resolution", () => {
    expect(content).toContain("resolveApiUrl");
    expect(content).toContain('hostname.includes("staging")');
  });
});
