import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: vi.fn(),
  requireOrg: vi.fn(),
  AuthenticatedRequest: {},
}));

vi.mock("@mcpfactory/runs-client", () => ({
  getRunsBatch: vi.fn().mockResolvedValue(new Map()),
}));

import { fetchKeySource } from "../../src/lib/billing.js";

describe("fetchKeySource", () => {
  let fetchCalls: Array<{ url: string; headers?: Record<string, string> }>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchCalls = [];

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = Object.fromEntries(
        Object.entries(init?.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
      );
      fetchCalls.push({ url, headers });

      if (url.includes("/billing-mode")) {
        return new Response(JSON.stringify({ billingMode: "pay-as-you-go" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should pass x-app-id: mcpfactory header to billing-service", async () => {
    await fetchKeySource("org-123");

    const billingCall = fetchCalls.find((c) => c.url.includes("/billing-mode"));
    expect(billingCall).toBeDefined();
    expect(billingCall!.headers!["x-app-id"]).toBe("mcpfactory");
  });

  it("should return 'app' for pay-as-you-go billing mode", async () => {
    const result = await fetchKeySource("org-123");
    expect(result).toBe("app");
  });

  it("should return 'byok' for byok billing mode", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ billingMode: "byok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await fetchKeySource("org-123");
    expect(result).toBe("byok");
  });

  it("should default to 'app' when billing-service is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const result = await fetchKeySource("org-123");
    expect(result).toBe("app");
  });
});
