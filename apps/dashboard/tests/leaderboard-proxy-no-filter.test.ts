import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const routePath = path.resolve(
  __dirname,
  "../src/app/api/performance/leaderboard/route.ts"
);
const content = fs.readFileSync(routePath, "utf-8");

describe("Leaderboard proxy must not send filtering headers", () => {
  it("should still require Clerk auth for dashboard access", () => {
    expect(content).toContain("await auth()");
    expect(content).toContain("clerkUserId");
    expect(content).toContain("clerkOrgId");
    expect(content).toContain("Unauthorized");
  });

  it("should NOT forward x-external-org-id header to the API", () => {
    // Headers are for identity, not filtering. The leaderboard is global data.
    expect(content).not.toMatch(/"x-external-org-id"/);
    expect(content).not.toMatch(/"x-org-id"/);
  });

  it("should NOT forward x-external-user-id header to the API", () => {
    expect(content).not.toMatch(/"x-external-user-id"/);
    expect(content).not.toMatch(/"x-user-id"/);
  });

  it("should send X-API-Key for API auth", () => {
    expect(content).toContain("ADMIN_DISTRIBUTE_API_KEY");
    expect(content).toMatch(/X-API-Key/);
  });

  it("should call the performance/leaderboard endpoint", () => {
    expect(content).toContain("/performance/leaderboard");
  });
});
