import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const fetchMetricsPath = path.resolve(
  __dirname,
  "../../src/lib/investors/fetch-metrics.ts"
);
const fetchMetrics = fs.readFileSync(fetchMetricsPath, "utf-8");

const pagePath = path.resolve(
  __dirname,
  "../../src/app/investors/page.tsx"
);
const page = fs.readFileSync(pagePath, "utf-8");

describe("Investor metrics: billing + runs aggregates", () => {
  describe("fetch-metrics.ts", () => {
    it("BillingStatsResponse uses snake_case shape (billing-service v3 wire)", () => {
      expect(fetchMetrics).toMatch(/total_accounts:\s*number/);
      expect(fetchMetrics).toMatch(/accounts_with_payment_method:\s*number/);
      expect(fetchMetrics).toMatch(/total_credited_cents:\s*string/);
      expect(fetchMetrics).toMatch(/total_revenue_cents:\s*string/);
      expect(fetchMetrics).toMatch(/total_paid_cents:\s*string/);
      expect(fetchMetrics).toMatch(/total_local_credits_cents:\s*string/);
      expect(fetchMetrics).toMatch(/monthly_growth:/);
      expect(fetchMetrics).toMatch(/weekly_growth:/);
    });

    it("BillingStatsResponse does NOT keep camelCase or dropped fields", () => {
      expect(fetchMetrics).not.toMatch(/totalCreditBalanceCents/);
      expect(fetchMetrics).not.toMatch(/totalConsumedCents/);
      expect(fetchMetrics).not.toMatch(/monthlyGrowth:\s*BillingGrowthRow/);
    });

    it("BillingGrowthRow drops consumed_cents (no longer on wire)", () => {
      const block = fetchMetrics.match(/interface BillingGrowthRow[\s\S]*?\}/);
      expect(block).toBeTruthy();
      expect(block?.[0]).not.toContain("consumed_cents");
      expect(block?.[0]).toContain("credited_cents");
      expect(block?.[0]).toContain("revenue_cents");
    });

    it("RunsStatsResponse includes totalCostInUsdCents top-level + per-month", () => {
      expect(fetchMetrics).toMatch(/interface RunsStatsResponse[\s\S]*?totalCostInUsdCents:\s*string/);
      expect(fetchMetrics).toMatch(/monthly:\s*\{[\s\S]*?totalCostInUsdCents:\s*string/);
    });

    it("InvestorMetrics.billing exposes totalRevenueCents + totalCreditedCents", () => {
      expect(fetchMetrics).toMatch(/totalRevenueCents:\s*string/);
      expect(fetchMetrics).toMatch(/totalCreditedCents:\s*string/);
    });

    it("InvestorMetrics.runs exposes totalCostInUsdCents", () => {
      expect(fetchMetrics).toMatch(/runs:\s*\{[\s\S]*?totalCostInUsdCents:\s*string/);
    });

    it("InvestorMetrics exposes weeklyGrowth", () => {
      expect(fetchMetrics).toMatch(/interface InvestorMetrics[\s\S]*?weeklyGrowth:/);
    });

    it("MonthlyRow includes creditedCents, consumedCents, revenueCents", () => {
      expect(fetchMetrics).toMatch(/interface MonthlyRow[\s\S]*?creditedCents:/);
      expect(fetchMetrics).toMatch(/interface MonthlyRow[\s\S]*?consumedCents:/);
      expect(fetchMetrics).toMatch(/interface MonthlyRow[\s\S]*?revenueCents:/);
    });
  });

  describe("investors/page.tsx", () => {
    it("Revenue & Credits section renders Total Consumed and Revenue cards", () => {
      expect(page).toContain("Total Consumed");
      expect(page).toContain("Revenue");
      expect(page).toContain("metrics.runs.totalCostInUsdCents");
      expect(page).toContain("metrics.billing.totalRevenueCents");
    });

    it("does NOT render dropped Outstanding Balance / Credits Loaded cards", () => {
      expect(page).not.toContain("Outstanding Balance");
      expect(page).not.toContain("Total Credits Loaded");
    });

    it("Monthly Growth table has Credits Spent and Revenue columns", () => {
      expect(page).toContain("Credits Spent");
      expect(page).toContain("Revenue");
    });

    it("has a Weekly Growth section", () => {
      expect(page).toContain("Weekly Growth");
    });

    it("Weekly Growth section uses revenue_cents per row (consumed_cents dropped from wire)", () => {
      const weeklySection = page.slice(page.indexOf("Weekly Growth"));
      expect(weeklySection).toContain("Credits Loaded");
      expect(weeklySection).toContain("Revenue");
      expect(weeklySection).not.toContain("row.consumed_cents");
    });
  });
});
