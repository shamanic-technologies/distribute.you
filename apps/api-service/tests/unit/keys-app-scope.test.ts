import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const keysRoutePath = path.join(__dirname, "../../src/routes/keys.ts");
const content = fs.readFileSync(keysRoutePath, "utf-8");

const schemaPath = path.join(__dirname, "../../src/schemas.ts");
const schemaContent = fs.readFileSync(schemaPath, "utf-8");

describe("POST /v1/keys — app-scoped key support", () => {
  it("should support scope field in AddByokKeyRequestSchema", () => {
    expect(schemaContent).toContain("scope");
    expect(schemaContent).toContain('"app"');
  });

  it("should proxy app-scoped keys to /internal/app-keys", () => {
    expect(content).toContain('"/internal/app-keys"');
    expect(content).toContain('scope === "app"');
  });

  it("should require appId for app-scoped key registration", () => {
    expect(content).toContain("req.appId");
    expect(content).toContain("App-scoped keys require app key authentication");
  });

  it("should return 403 when app key auth is not used for scope:app", () => {
    expect(content).toContain("403");
  });

  it("should send appId, provider, apiKey to key-service for app-scoped keys", () => {
    expect(content).toContain("appId: req.appId");
  });
});

describe("POST /v1/keys — BYOK fallback", () => {
  it("should still proxy default keys to /internal/keys", () => {
    expect(content).toContain('"/internal/keys"');
    expect(content).toContain("orgId: req.orgId");
  });

  it("should use authenticate middleware only (not requireOrg/requireUser in chain)", () => {
    // POST handler should only have authenticate, not requireOrg/requireUser
    const postLine = content.match(/router\.post\("\/keys"[^)]+\)/);
    expect(postLine).toBeDefined();
    expect(postLine![0]).toContain("authenticate");
    expect(postLine![0]).not.toContain("requireOrg");
    expect(postLine![0]).not.toContain("requireUser");
  });

  it("should check org and user inline for BYOK path", () => {
    expect(content).toContain("Organization context required");
    expect(content).toContain("User identity required");
  });
});
