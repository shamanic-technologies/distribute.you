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

  it("should NOT forward x-org-id header to the API", () => {
    // Headers are for auth, not filtering. The leaderboard is global data.
    expect(content).not.toMatch(/"x-org-id":\s*clerkOrgId/);
    expect(content).not.toMatch(/"x-org-id"/);
  });

  it("should NOT forward x-user-id header to the API", () => {
    expect(content).not.toMatch(/"x-user-id":\s*clerkUserId/);
    expect(content).not.toMatch(/"x-user-id"/);
  });

  it("should NOT send Authorization header to the API", () => {
    // The leaderboard endpoint should work without auth, like performance.distribute.you
    expect(content).not.toMatch(/Authorization.*Bearer/);
    expect(content).not.toContain("DISTRIBUTE_API_KEY");
  });

  it("should call the performance/leaderboard endpoint", () => {
    expect(content).toContain("/performance/leaderboard");
  });
});
