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

    await registerAppKeys();

    const appKeyCalls = fetchCalls.filter((c) => c.url.includes("/internal/app-keys"));
    expect(appKeyCalls).toHaveLength(3);

    const providers = appKeyCalls.map((c) => c.body?.provider);
    expect(providers).toContain("anthropic");
    expect(providers).toContain("apollo");
    expect(providers).toContain("instantly");

    // All should have appId = mcpfactory
    for (const call of appKeyCalls) {
      expect(call.body?.appId).toBe("mcpfactory");
    }
  });

  it("should skip keys with missing env vars without crashing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.APOLLO_API_KEY;
    delete process.env.INSTANTLY_API_KEY;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await registerAppKeys();

    const appKeyCalls = fetchCalls.filter((c) => c.url.includes("/internal/app-keys"));
    expect(appKeyCalls).toHaveLength(0);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ANTHROPIC_API_KEY not set"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("APOLLO_API_KEY not set"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("INSTANTLY_API_KEY not set"));
  });

  it("should not crash when key-service call fails", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.APOLLO_API_KEY;
    delete process.env.INSTANTLY_API_KEY;

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

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Should not throw
    await registerAppKeys();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("App key registration failed:"),
      expect.any(String)
    );
  });

  it("should register only keys with env vars set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.APOLLO_API_KEY;
    process.env.INSTANTLY_API_KEY = "instantly-test";

    await registerAppKeys();

    const appKeyCalls = fetchCalls.filter((c) => c.url.includes("/internal/app-keys"));
    expect(appKeyCalls).toHaveLength(2);

    const providers = appKeyCalls.map((c) => c.body?.provider);
    expect(providers).toContain("anthropic");
    expect(providers).toContain("instantly");
    expect(providers).not.toContain("apollo");
  });
});
