import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Regression test: POST /v1/brand/icp-suggestion must pass keyType: "byok"
 * to brand-service. Without it, brand-service cannot look up the org's
 * Anthropic BYOK key and returns "No Anthropic API key found (keyType: byok)".
 *
 * Also verifies that a missing-key error returns 400 with a helpful message
 * instead of a generic 500.
 */

// Mock auth middleware to skip real auth
vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = "user_test123";
    req.orgId = "org_test456";
    req.authType = "jwt";
    next();
  },
  requireOrg: (req: any, res: any, next: any) => {
    if (!req.orgId) return res.status(400).json({ error: "Organization context required" });
    next();
  },
  AuthenticatedRequest: {},
}));

// Mock runs-client (imported by brand router)
vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
}));

import brandRouter from "../../src/routes/brand.js";

function createBrandApp() {
  const app = express();
  app.use(express.json());
  app.use("/v1", brandRouter);
  return app;
}

describe("POST /v1/brand/icp-suggestion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should include keyType: byok in the request body to brand-service", async () => {
    let capturedBody: Record<string, unknown> | undefined;

    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (typeof _url === "string" && _url.includes("/icp-suggestion")) {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          json: () => Promise.resolve({ icp: { person_titles: ["CTO"] } }),
        };
      }
      return { ok: true, json: () => Promise.resolve({}) };
    });

    const app = createBrandApp();
    await request(app)
      .post("/v1/brand/icp-suggestion")
      .send({ brandUrl: "https://example.com" });

    expect(capturedBody).toBeDefined();
    expect(capturedBody!.keyType).toBe("byok");
    expect(capturedBody!.url).toBe("https://example.com");
    expect(capturedBody!.orgId).toBe("org_test456");
  });

  it("should return 400 with helpful message when Anthropic BYOK key is missing", async () => {
    const errorBody = JSON.stringify({ error: "No Anthropic API key found (keyType: byok)" });
    global.fetch = vi.fn().mockImplementation(async (_url: string) => {
      if (typeof _url === "string" && _url.includes("/icp-suggestion")) {
        return {
          ok: false,
          status: 400,
          text: () => Promise.resolve(errorBody),
          json: () => Promise.resolve({ error: "No Anthropic API key found (keyType: byok)" }),
        };
      }
      return { ok: true, json: () => Promise.resolve({}) };
    });

    const app = createBrandApp();
    const res = await request(app)
      .post("/v1/brand/icp-suggestion")
      .send({ brandUrl: "https://example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Anthropic API key not configured");
    expect(res.body.error).toContain("BYOK");
  });

  it("should return 400 when brandUrl is missing", async () => {
    const app = createBrandApp();
    const res = await request(app)
      .post("/v1/brand/icp-suggestion")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid request");
  });
});
