import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock auth (required by service-client transitive imports)
vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: vi.fn(),
  requireOrg: vi.fn(),
  requireUser: vi.fn(),
  AuthenticatedRequest: {},
}));

vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
}));

import { registerPlatformKeys } from "../../src/startup.js";

function setAllEnvVars() {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  process.env.APOLLO_API_KEY = "apollo-test";
  process.env.INSTANTLY_API_KEY = "instantly-test";
  process.env.FIRECRAWL_API_KEY = "fc-test";
  process.env.GEMINI_API_KEY = "gemini-test";
  process.env.POSTMARK_API_KEY = "postmark-test";
  process.env.STRIPE_SECRET_KEY = "sk_test_stripe";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
}

function deleteAllEnvVars() {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.APOLLO_API_KEY;
  delete process.env.INSTANTLY_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.POSTMARK_API_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
}

describe("registerPlatformKeys", () => {
  let fetchCalls: Array<{ url: string; body?: Record<string, unknown> }>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchCalls = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      fetchCalls.push({ url, body });

      if (url.includes("/internal/platform-keys")) {
        return new Response(JSON.stringify({ provider: body?.provider, maskedKey: "sk-...xxx", message: "Platform key saved" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should register all platform keys without appId", async () => {
    setAllEnvVars();

    await registerPlatformKeys();

    const platformKeyCalls = fetchCalls.filter((c) => c.url.includes("/internal/platform-keys"));
    expect(platformKeyCalls).toHaveLength(8);

    const providers = platformKeyCalls.map((c) => c.body?.provider);
    expect(providers).toContain("anthropic");
    expect(providers).toContain("apollo");
    expect(providers).toContain("instantly");
    expect(providers).toContain("firecrawl");
    expect(providers).toContain("gemini");
    expect(providers).toContain("postmark");
    expect(providers).toContain("stripe");
    expect(providers).toContain("stripe-webhook");

    for (const call of platformKeyCalls) {
      expect(call.body).not.toHaveProperty("appId");
    }
  });

  it("should throw when all env vars are missing", async () => {
    deleteAllEnvVars();
    await expect(registerPlatformKeys()).rejects.toThrow("Missing required env vars");
  });

  it("should throw when key-service returns an error", async () => {
    setAllEnvVars();

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      fetchCalls.push({ url, body });

      if (url.includes("/internal/platform-keys")) {
        return new Response(JSON.stringify({ error: "Service unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    await expect(registerPlatformKeys()).rejects.toThrow();
  });

  it("should throw when a single env var is missing", async () => {
    setAllEnvVars();
    delete process.env.STRIPE_SECRET_KEY;

    await expect(registerPlatformKeys()).rejects.toThrow("STRIPE_SECRET_KEY");
  });
});
