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

function mockBillingResponse(billingMode: string) {
  return new Response(
    JSON.stringify({ balance_cents: 200, billing_mode: billingMode, depleted: false }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

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

      if (url.includes("/v1/accounts/balance")) {
        return mockBillingResponse("trial");
      }

      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call GET /v1/accounts/balance with x-app-id and x-org-id headers", async () => {
    await fetchKeySource("org-123");

    const billingCall = fetchCalls.find((c) => c.url.includes("/v1/accounts/balance"));
    expect(billingCall).toBeDefined();
    expect(billingCall!.headers!["x-app-id"]).toBe("mcpfactory");
    expect(billingCall!.headers!["x-org-id"]).toBe("org-123");
  });

  it("should return 'app' for trial billing mode", async () => {
    const result = await fetchKeySource("org-123");
    expect(result).toBe("app");
  });

  it("should return 'app' for payg billing mode", async () => {
    global.fetch = vi.fn().mockResolvedValue(mockBillingResponse("payg"));

    const result = await fetchKeySource("org-123");
    expect(result).toBe("app");
  });

  it("should return 'byok' for byok billing mode", async () => {
    global.fetch = vi.fn().mockResolvedValue(mockBillingResponse("byok"));

    const result = await fetchKeySource("org-123");
    expect(result).toBe("byok");
  });

  it("should throw when billing-service is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    await expect(fetchKeySource("org-123")).rejects.toThrow("Connection refused");
  });

  it("should throw when billing-service returns an error", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(fetchKeySource("org-123")).rejects.toThrow();
  });
});
