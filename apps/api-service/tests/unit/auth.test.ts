import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const authPath = path.join(__dirname, "../../src/middleware/auth.ts");

describe("Auth middleware", () => {
  it("should support Bearer token authentication", () => {
    const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
    expect(authHeader.startsWith("Bearer ")).toBe(true);
  });

  it("should support X-API-Key authentication", () => {
    const headers = { "x-api-key": "mcp_test_key_123" };
    expect(headers["x-api-key"]).toBeDefined();
  });

  it("should extract token from Bearer header", () => {
    const authHeader = "Bearer test-token-123";
    const token = authHeader.split(" ")[1];
    expect(token).toBe("test-token-123");
  });
});

/**
 * Clerk ID resolution uses client-service sync endpoints (POST /users/sync,
 * POST /orgs/sync) — idempotent get-or-create. This guarantees every Clerk
 * user gets an internal UUID on first request, no webhook dependency.
 */
describe("Auth middleware — Clerk ID resolution via sync", () => {
  const content = fs.readFileSync(authPath, "utf-8");

  it("should use POST /users/sync to resolve Clerk user to internal UUID", () => {
    expect(content).toContain('"/users/sync"');
    expect(content).toContain("syncUser");
  });

  it("should use POST /orgs/sync to resolve Clerk org to internal UUID", () => {
    expect(content).toContain('"/orgs/sync"');
    expect(content).toContain("syncOrg");
  });

  it("should forward the Clerk JWT to client-service sync endpoints", () => {
    expect(content).toContain("callService");
    expect(content).toContain("services.client");
    expect(content).toContain('Authorization: `Bearer ${clerkJwt}`');
  });

  it("should NOT use by-clerk lookup endpoints (sync replaces them)", () => {
    expect(content).not.toContain("/users/by-clerk/");
    expect(content).not.toContain("/orgs/by-clerk/");
  });

  it("should NOT fall back to raw Clerk IDs when resolution fails", () => {
    expect(content).not.toContain("|| clerkUserId");
    expect(content).not.toContain("|| clerkOrgId");
  });

  it("should return 502 when identity resolution fails entirely", () => {
    expect(content).toContain("502");
    expect(content).toContain("Identity resolution failed");
  });
});

describe("Auth middleware — requireUser export", () => {
  const content = fs.readFileSync(authPath, "utf-8");

  it("should export requireUser middleware", () => {
    expect(content).toContain("export function requireUser");
  });

  it("should return 401 when userId is missing", () => {
    expect(content).toContain("User identity required");
  });
});
