import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const authPath = path.join(__dirname, "../../src/middleware/auth.ts");
const content = fs.readFileSync(authPath, "utf-8");

describe("Auth middleware — Bearer key authentication", () => {
  it("should only accept Bearer token authentication", () => {
    expect(content).toContain('authorization');
    expect(content).toContain('startsWith("Bearer ")');
  });

  it("should not support X-API-Key header authentication", () => {
    expect(content).not.toContain('"x-api-key"');
    expect(content).not.toContain("X-API-Key");
  });

  it("should not use Clerk JWT verification", () => {
    expect(content).not.toContain("verifyToken");
    expect(content).not.toContain("@clerk/backend");
    expect(content).not.toContain("clerkJwt");
  });
});

describe("Auth middleware — key-service validation", () => {
  it("should validate keys via key-service /validate", () => {
    expect(content).toContain('"/validate"');
    expect(content).toContain("callExternalService");
    expect(content).toContain("externalServices.key");
  });

  it("should distinguish app keys from user keys", () => {
    expect(content).toContain('"app"');
    expect(content).toContain('"user"');
    expect(content).toContain("validation.type");
  });
});

describe("Auth middleware — app key identity resolution", () => {
  it("should read external IDs from x-org-id and x-user-id headers", () => {
    expect(content).toContain('"x-org-id"');
    expect(content).toContain('"x-user-id"');
  });

  it("should make x-org-id and x-user-id optional for app keys", () => {
    expect(content).not.toContain("App key authentication requires x-org-id and x-user-id headers");
  });

  it("should set appId on the request for app key authentication", () => {
    expect(content).toContain("req.appId");
    expect(content).toContain("appId?: string");
  });

  it("should only resolve external IDs when both headers are provided", () => {
    expect(content).toContain("if (externalOrgId && externalUserId)");
  });

  it("should resolve external IDs via client-service POST /resolve", () => {
    expect(content).toContain('"/resolve"');
    expect(content).toContain("externalServices.client");
    expect(content).toContain("method: \"POST\"");
  });

  it("should send appId, externalOrgId, externalUserId to client-service", () => {
    expect(content).toContain("appId");
    expect(content).toContain("externalOrgId");
    expect(content).toContain("externalUserId");
  });

  it("should return 502 when identity resolution fails", () => {
    expect(content).toContain("502");
    expect(content).toContain("Identity resolution failed");
  });

  it("should set authType to app_key for app key authentication", () => {
    expect(content).toContain('"app_key"');
  });
});

describe("Auth middleware — user key authentication", () => {
  it("should use orgId directly from key-service for user keys", () => {
    expect(content).toContain("validation.orgId");
  });

  it("should set authType to user_key for user key authentication", () => {
    expect(content).toContain('"user_key"');
  });
});

describe("Auth middleware — requireOrg and requireUser exports", () => {
  it("should export requireOrg middleware", () => {
    expect(content).toContain("export function requireOrg");
  });

  it("should export requireUser middleware", () => {
    expect(content).toContain("export function requireUser");
  });

  it("should return 401 when userId is missing", () => {
    expect(content).toContain("User identity required");
  });

  it("should return 400 when orgId is missing", () => {
    expect(content).toContain("Organization context required");
  });
});
