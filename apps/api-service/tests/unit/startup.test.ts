import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock auth (required by service-client transitive imports)
vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: vi.fn(),
  requireOrg: vi.fn(),
  AuthenticatedRequest: {},
}));

vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
}));

import { registerAppKeys } from "../../src/startup.js";

describe("registerAppKeys", () => {
  let fetchCalls: Array<{ url: string; body?: Record<string, unknown> }>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchCalls = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      fetchCalls.push({ url, body });

      if (url.includes("/internal/app-keys")) {
        return new Response(JSON.stringify({ provider: body?.provider, maskedKey: "sk-...xxx", message: "App key saved" }), {
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

  it("should register all keys when env vars are set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.APOLLO_API_KEY = "apollo-test";
    process.env.INSTANTLY_API_KEY = "instantly-test";
    process.env.FIRECRAWL_API_KEY = "fc-test";
    process.env.GEMINI_API_KEY = "gemini-test";

    await registerAppKeys();

    const appKeyCalls = fetchCalls.filter((c) => c.url.includes("/internal/app-keys"));
    expect(appKeyCalls).toHaveLength(5);

    const providers = appKeyCalls.map((c) => c.body?.provider);
    expect(providers).toContain("anthropic");
    expect(providers).toContain("apollo");
    expect(providers).toContain("instantly");
    expect(providers).toContain("firecrawl");
    expect(providers).toContain("gemini");

    // All should have appId = mcpfactory
    for (const call of appKeyCalls) {
      expect(call.body?.appId).toBe("mcpfactory");
    }
  });

  it("should throw when env vars are missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.APOLLO_API_KEY;
    delete process.env.INSTANTLY_API_KEY;
    delete process.env.FIRECRAWL_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await expect(registerAppKeys()).rejects.toThrow("Missing required env vars: ANTHROPIC_API_KEY, APOLLO_API_KEY, INSTANTLY_API_KEY, FIRECRAWL_API_KEY, GEMINI_API_KEY");

    // No fetch calls should have been made
    const appKeyCalls = fetchCalls.filter((c) => c.url.includes("/internal/app-keys"));
    expect(appKeyCalls).toHaveLength(0);
  });

  it("should throw when key-service returns an error", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.APOLLO_API_KEY = "apollo-test";
    process.env.INSTANTLY_API_KEY = "instantly-test";
    process.env.FIRECRAWL_API_KEY = "fc-test";
    process.env.GEMINI_API_KEY = "gemini-test";

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      fetchCalls.push({ url, body });

      if (url.includes("/internal/app-keys")) {
        return new Response(JSON.stringify({ error: "Service unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    await expect(registerAppKeys()).rejects.toThrow();
  });

  it("should throw when a single env var is missing", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.APOLLO_API_KEY;
    process.env.INSTANTLY_API_KEY = "instantly-test";
    process.env.FIRECRAWL_API_KEY = "fc-test";
    process.env.GEMINI_API_KEY = "gemini-test";

    await expect(registerAppKeys()).rejects.toThrow("Missing required env vars: APOLLO_API_KEY");
  });
});
