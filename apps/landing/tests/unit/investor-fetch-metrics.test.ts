import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { fetchInvestorMetrics } from "@/lib/investors/fetch-metrics";

const mockUsers = {
  totalOrgs: 10,
  totalUsers: 25,
  monthlyGrowth: [
    { month: "2026-04", newOrgs: 2, newUsers: 5 },
    { month: "2026-03", newOrgs: 1, newUsers: 3 },
  ],
};

const mockBilling = {
  totalAccounts: 15,
  accountsWithPaymentMethod: 8,
  totalCreditBalanceCents: "1234.5678901234",
  totalCreditedCents: "10000.4200000000",
  totalConsumedCents: "8765.5800000000",
  monthlyGrowth: [
    {
      period: "2026-04-01",
      credited_cents: "5000.4200000000",
      consumed_cents: "4000.1100000000",
      revenue_cents: "3500.0000000000",
    },
    {
      period: "2026-03-01",
      credited_cents: "5000.0000000000",
      consumed_cents: "4765.4700000000",
      revenue_cents: "4200.0000000000",
    },
  ],
  weeklyGrowth: [
    {
      period: "2026-04-20",
      credited_cents: "1000.0000000000",
      consumed_cents: "850.5000000000",
      revenue_cents: "750.0000000000",
    },
    {
      period: "2026-04-13",
      credited_cents: "900.0000000000",
      consumed_cents: "750.0000000000",
      revenue_cents: "700.0000000000",
    },
  ],
};

const mockRuns = {
  byStatus: { completed: 100, failed: 5, running: 2 },
  monthly: [
    { month: "2026-04", completed: 60, failed: 3, running: 1 },
    { month: "2026-03", completed: 40, failed: 2, running: 1 },
  ],
};

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("fetchInvestorMetrics — fractional decimal-string cents", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/public/stats/users")) return jsonResponse(mockUsers);
        if (url.includes("/public/stats/billing")) return jsonResponse(mockBilling);
        if (url.includes("/public/stats/runs")) return jsonResponse(mockRuns);
        throw new Error(`unexpected fetch ${url}`);
      })
    );
    vi.stubEnv("NEXT_PUBLIC_DISTRIBUTE_API_URL", "https://api.test.local");
    vi.stubEnv("ADMIN_DISTRIBUTE_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("preserves decimal-string cents on billing summary fields", async () => {
    const result = await fetchInvestorMetrics("test.local");
    expect(result.billing.totalCreditedCents).toBe("10000.4200000000");
    expect(result.billing.totalConsumedCents).toBe("8765.5800000000");
    expect(result.billing.totalCreditBalanceCents).toBe("1234.5678901234");
  });

  it("preserves decimal-string cents on monthly rows", async () => {
    const result = await fetchInvestorMetrics("test.local");
    const apr = result.monthlyGrowth.find((r) => r.month === "2026-04");
    expect(apr?.creditedCents).toBe("5000.4200000000");
    expect(apr?.consumedCents).toBe("4000.1100000000");
    expect(apr?.revenueCents).toBe("3500.0000000000");
  });

  it("preserves decimal-string cents on weekly rows", async () => {
    const result = await fetchInvestorMetrics("test.local");
    const wk = result.weeklyGrowth.find((r) => r.period === "2026-04-20");
    expect(wk?.consumed_cents).toBe("850.5000000000");
    expect(wk?.credited_cents).toBe("1000.0000000000");
    expect(wk?.revenue_cents).toBe("750.0000000000");
  });

  it("merges users + runs + billing into unified monthly rows without precision loss", async () => {
    const result = await fetchInvestorMetrics("test.local");
    const apr = result.monthlyGrowth.find((r) => r.month === "2026-04");
    expect(apr).toBeTruthy();
    expect(apr?.newOrgs).toBe(2);
    expect(apr?.completedRuns).toBe(60);
    expect(apr?.consumedCents).toBe("4000.1100000000");
  });

  it("returns empty cent strings (zero) for months missing from billing growth", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/public/stats/users")) return jsonResponse(mockUsers);
        if (url.includes("/public/stats/billing"))
          return jsonResponse({ ...mockBilling, monthlyGrowth: [] });
        if (url.includes("/public/stats/runs")) return jsonResponse(mockRuns);
        throw new Error(`unexpected fetch ${url}`);
      })
    );
    const result = await fetchInvestorMetrics("test.local");
    const apr = result.monthlyGrowth.find((r) => r.month === "2026-04");
    expect(apr?.consumedCents).toBe("0");
    expect(apr?.creditedCents).toBe("0");
    expect(apr?.revenueCents).toBe("0");
  });
});
