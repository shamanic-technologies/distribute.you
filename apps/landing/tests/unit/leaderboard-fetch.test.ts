import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const fetchPath = path.resolve(
  __dirname,
  "../../src/lib/performance/fetch-leaderboard.ts"
);
const content = fs.readFileSync(fetchPath, "utf-8");

describe("Leaderboard fetch uses unified API URL", () => {
  it("should use NEXT_PUBLIC_DISTRIBUTE_API_URL, not API_SERVICE_URL", () => {
    expect(content).toContain("NEXT_PUBLIC_DISTRIBUTE_API_URL");
    expect(content).not.toContain("API_SERVICE_URL");
  });

  it("should default to URLS.api from shared content", () => {
    expect(content).toContain("URLS.api");
  });

  it("should use ADMIN_DISTRIBUTE_API_KEY for auth", () => {
    expect(content).toContain("ADMIN_DISTRIBUTE_API_KEY");
  });

  it("should NOT send x-org-id or x-user-id headers", () => {
    expect(content).not.toContain("x-org-id");
    expect(content).not.toContain("x-user-id");
  });
});
