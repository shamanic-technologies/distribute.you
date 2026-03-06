import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const routePath = path.resolve(
  __dirname,
  "../src/app/api/performance/leaderboard/route.ts"
);
const content = fs.readFileSync(routePath, "utf-8");

describe("Leaderboard proxy sends identity headers", () => {
  it("should require Clerk auth for dashboard access", () => {
    expect(content).toContain("await auth()");
    expect(content).toContain("clerkUserId");
    expect(content).toContain("clerkOrgId");
    expect(content).toContain("Unauthorized");
  });

  it("should forward x-external-org-id header to the API", () => {
    expect(content).toMatch(/"x-external-org-id"/);
  });

  it("should forward x-external-user-id header to the API", () => {
    expect(content).toMatch(/"x-external-user-id"/);
  });

  it("should send X-API-Key for API auth", () => {
    expect(content).toContain("ADMIN_DISTRIBUTE_API_KEY");
    expect(content).toMatch(/X-API-Key/);
  });

  it("should call the performance/leaderboard endpoint", () => {
    expect(content).toContain("/performance/leaderboard");
  });
});
