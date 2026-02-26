import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("POST /v1/auth/provision route", () => {
  const routePath = path.join(__dirname, "../../src/routes/auth.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  it("should have a POST /auth/provision route", () => {
    expect(content).toContain('"/auth/provision"');
    expect(content).toContain("router.post");
  });

  it("should NOT use authenticate or requireOrg middleware (public endpoint)", () => {
    // The route handler should be: router.post("/auth/provision", async (req, res) => ...)
    // NOT: router.post("/auth/provision", authenticate, requireOrg, async ...)
    const routeLine = content.match(/router\.post\(\s*"\/auth\/provision"[^)]+\)/);
    expect(routeLine).toBeDefined();
    expect(routeLine![0]).not.toContain("authenticate");
    expect(routeLine![0]).not.toContain("requireOrg");
  });

  it("should validate request body with ProvisionRequestSchema", () => {
    expect(content).toContain("ProvisionRequestSchema");
    expect(content).toContain("safeParse");
  });

  it("should call client-service POST /anonymous-users with hardcoded appId and API key auth", () => {
    expect(content).toContain("externalServices.client");
    expect(content).toContain("callExternalService");
    expect(content).toContain("/anonymous-users");
    expect(content).toContain('appId: "mcpfactory"');
  });

  it("should forward optional firstName, lastName, and profilePicture", () => {
    expect(content).toContain("firstName");
    expect(content).toContain("lastName");
    expect(content).toContain("profilePicture");
  });

  it("should call key-service POST /internal/api-keys/session", () => {
    expect(content).toContain("externalServices.key");
    expect(content).toContain("/internal/api-keys/session");
  });

  it("should return apiKey, userId, and orgId", () => {
    expect(content).toContain("apiKey: keyResult.key");
    expect(content).toContain("userId: clientResult.user.id");
    expect(content).toContain("orgId: clientResult.org.id");
  });

  it("should return 400 on invalid request", () => {
    expect(content).toContain("400");
    expect(content).toContain("Invalid request");
  });

  it("should return 502 when client-service fails", () => {
    expect(content).toContain("502");
    expect(content).toContain("client-service unavailable");
  });

  it("should return 502 when key-service fails", () => {
    expect(content).toContain("key-service unavailable");
  });
});

describe("ProvisionRequestSchema and ProvisionResponseSchema", () => {
  const schemaPath = path.join(__dirname, "../../src/schemas.ts");
  const content = fs.readFileSync(schemaPath, "utf-8");

  it("should define ProvisionRequestSchema with email and optional profile fields", () => {
    expect(content).toContain("ProvisionRequestSchema");
    expect(content).toContain('"ProvisionRequest"');
    expect(content).toContain("email:");
    expect(content).toContain("firstName:");
    expect(content).toContain("lastName:");
    expect(content).toContain("profilePicture:");
    // appId should NOT be in the public schema
    const schemaBlock = content.slice(
      content.indexOf("ProvisionRequestSchema"),
      content.indexOf(".openapi(\"ProvisionRequest\")")
    );
    expect(schemaBlock).not.toContain("appId");
  });

  it("should define ProvisionResponseSchema with apiKey, userId, orgId", () => {
    expect(content).toContain("ProvisionResponseSchema");
    expect(content).toContain('"ProvisionResponse"');
  });

  it("should register POST /v1/auth/provision in OpenAPI without auth", () => {
    expect(content).toContain('path: "/v1/auth/provision"');
    expect(content).toContain('method: "post"');
    expect(content).toContain('tags: ["Auth"]');
    // Should NOT have security (public endpoint)
    const authSection = content.slice(
      content.indexOf('path: "/v1/auth/provision"'),
      content.indexOf('path: "/v1/auth/provision"') + 500
    );
    expect(authSection).not.toContain("security: authed");
  });
});

describe("Auth route is mounted in index.ts", () => {
  const indexPath = path.join(__dirname, "../../src/index.ts");
  const content = fs.readFileSync(indexPath, "utf-8");

  it("should import and mount auth routes", () => {
    expect(content).toContain("authRoutes");
    expect(content).toContain("./routes/auth");
  });
});

describe("Internal headers use x-org-id / x-user-id (not clerk)", () => {
  const headersPath = path.join(__dirname, "../../src/lib/internal-headers.ts");
  const content = fs.readFileSync(headersPath, "utf-8");

  it("should use x-org-id header", () => {
    expect(content).toContain('"x-org-id"');
    expect(content).not.toContain("x-clerk-org-id");
  });

  it("should use x-user-id header", () => {
    expect(content).toContain('"x-user-id"');
    expect(content).not.toContain("x-clerk-user-id");
  });
});

describe("runs-client uses orgId/userId (not clerkOrgId/clerkUserId)", () => {
  const runsClientPath = path.join(__dirname, "../../../../shared/runs-client/src/index.ts");
  const content = fs.readFileSync(runsClientPath, "utf-8");

  it("CreateRunParams should use orgId, not clerkOrgId", () => {
    const createRunSection = content.slice(
      content.indexOf("CreateRunParams"),
      content.indexOf("CreateRunParams") + 200
    );
    expect(createRunSection).toContain("orgId: string");
    expect(createRunSection).not.toContain("clerkOrgId");
  });

  it("ListRunsParams should use orgId, not clerkOrgId", () => {
    const listRunsSection = content.slice(
      content.indexOf("ListRunsParams"),
      content.indexOf("ListRunsParams") + 200
    );
    expect(listRunsSection).toContain("orgId: string");
    expect(listRunsSection).not.toContain("clerkOrgId");
  });
});
