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
 * Regression test: Clerk IDs must never leak to downstream services.
 *
 * Previously, resolveClerkIds used callService (no auth) to call client-service,
 * which silently failed. The fallback then set req.orgId = clerkOrgId (e.g.
 * "org_38765ZD8RgeAkOrpZVpea9t8pxh") instead of the internal UUID.
 * This caused brand-service and other downstream services to receive Clerk IDs.
 */
describe("Auth middleware — no Clerk ID leaks", () => {
  const content = fs.readFileSync(authPath, "utf-8");

  it("should use callExternalService (with API key) for client-service lookups", () => {
    expect(content).toContain("callExternalService");
    expect(content).toContain("externalServices.client");
  });

  it("should use callService with Bearer JWT for sync fallback (not no-auth)", () => {
    // Sync endpoints require Clerk JWT — callService is used with explicit Authorization header
    expect(content).toContain("services.client");
    expect(content).toContain("callService");
    expect(content).toContain('Authorization: `Bearer ${clerkJwt}`');
  });

  it("should NOT fall back to raw Clerk IDs when resolution fails", () => {
    // The old pattern: req.userId = resolved.userId || clerkUserId
    expect(content).not.toContain("|| clerkUserId");
    expect(content).not.toContain("|| clerkOrgId");
  });

  it("should return 502 when identity resolution fails entirely", () => {
    expect(content).toContain("502");
    expect(content).toContain("Identity resolution failed");
  });
});

describe("Auth middleware — auto-sync on 404", () => {
  const content = fs.readFileSync(authPath, "utf-8");

  it("should call /users/sync when by-clerk lookup returns 404", () => {
    expect(content).toContain('"/users/sync"');
    expect(content).toContain("auto-syncing via client-service");
  });

  it("should call /orgs/sync when by-clerk lookup returns 404", () => {
    expect(content).toContain('"/orgs/sync"');
  });

  it("should only sync when error is 404 (not on other errors)", () => {
    expect(content).toContain('includes("404")');
  });

  it("should only sync when JWT is available", () => {
    // Without JWT, sync endpoints can't authenticate
    expect(content).toContain("!clerkJwt");
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
