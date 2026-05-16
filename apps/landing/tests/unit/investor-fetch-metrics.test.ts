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
  total_accounts: 15,
  accounts_with_payment_method: 8,
  total_credited_cents: "10000.4200000000",
  total_paid_cents: "8000.5500000000",
  total_revenue_cents: "8000.5500000000",
  total_local_credits_cents: "1999.8700000000",
  monthly_growth: [
    {
      period: "2026-04-01",
      credited_cents: "5000.4200000000",
      revenue_cents: "3500.0000000000",
    },
    {
      period: "2026-03-01",
      credited_cents: "5000.0000000000",
      revenue_cents: "4200.0000000000",
    },
  ],
  weekly_growth: [
    {
      period: "2026-04-20",
      credited_cents: "1000.0000000000",
      revenue_cents: "750.0000000000",
    },
    {
      period: "2026-04-13",
      credited_cents: "900.0000000000",
      revenue_cents: "700.0000000000",
    },
  ],
};

const mockRuns = {
  byStatus: { completed: 100, failed: 5, running: 2 },
  totalCostInUsdCents: "12345.6789012345",
  monthly: [
    { month: "2026-04", completed: 60, failed: 3, running: 1, totalCostInUsdCents: "6000.1234567890" },
    { month: "2026-03", completed: 40, failed: 2, running: 1, totalCostInUsdCents: "6345.5554444455" },
  ],
  weekly: [
    { period: "2026-04-20", completed: 35, failed: 1, running: 0, totalCostInUsdCents: "3200.1100000000" },
    { period: "2026-04-13", completed: 25, failed: 2, running: 1, totalCostInUsdCents: "2800.5500000000" },
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

  it("exposes totalCreditedCents and totalRevenueCents on billing summary", async () => {
    const result = await fetchInvestorMetrics("test.local");
    expect(result.billing.totalCreditedCents).toBe("10000.4200000000");
    expect(result.billing.totalRevenueCents).toBe("8000.5500000000");
    expect(result.billing.totalAccounts).toBe(15);
    expect(result.billing.accountsWithPaymentMethod).toBe(8);
  });

  it("exposes totalCostInUsdCents on runs summary (authoritative source for consumption)", async () => {
    const result = await fetchInvestorMetrics("test.local");
    expect(result.runs.totalCostInUsdCents).toBe("12345.6789012345");
  });

  it("sources monthly consumedCents from runs-service (billing-service no longer emits it)", async () => {
    const result = await fetchInvestorMetrics("test.local");
    const apr = result.monthlyGrowth.find((r) => r.month === "2026-04");
    expect(apr?.consumedCents).toBe("6000.1234567890");
    expect(apr?.creditedCents).toBe("5000.4200000000");
    expect(apr?.revenueCents).toBe("3500.0000000000");
  });

  it("merges billing credited+revenue with runs consumed on weekly rows (camelCase)", async () => {
    const result = await fetchInvestorMetrics("test.local");
    const wk = result.weeklyGrowth.find((r) => r.period === "2026-04-20");
    expect(wk?.creditedCents).toBe("1000.0000000000");
    expect(wk?.revenueCents).toBe("750.0000000000");
    expect(wk?.consumedCents).toBe("3200.1100000000");
  });

  it("returns zero cent strings for weeks present in billing but missing from runs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/public/stats/users")) return jsonResponse(mockUsers);
        if (url.includes("/public/stats/billing")) return jsonResponse(mockBilling);
        if (url.includes("/public/stats/runs"))
          return jsonResponse({ ...mockRuns, weekly: [] });
        throw new Error(`unexpected fetch ${url}`);
      })
    );
    const result = await fetchInvestorMetrics("test.local");
    const wk = result.weeklyGrowth.find((r) => r.period === "2026-04-20");
    expect(wk?.consumedCents).toBe("0");
  });

  it("merges users + runs + billing into unified monthly rows without precision loss", async () => {
    const result = await fetchInvestorMetrics("test.local");
    const apr = result.monthlyGrowth.find((r) => r.month === "2026-04");
    expect(apr).toBeTruthy();
    expect(apr?.newOrgs).toBe(2);
    expect(apr?.completedRuns).toBe(60);
    expect(apr?.consumedCents).toBe("6000.1234567890");
  });

  it("returns zero cent strings for months missing from runs and billing growth", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/public/stats/users")) return jsonResponse(mockUsers);
        if (url.includes("/public/stats/billing"))
          return jsonResponse({ ...mockBilling, monthly_growth: [] });
        if (url.includes("/public/stats/runs"))
          return jsonResponse({ ...mockRuns, monthly: [] });
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
