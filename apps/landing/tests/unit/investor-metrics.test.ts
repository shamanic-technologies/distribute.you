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

describe("Investor metrics: billing growth data", () => {
  describe("fetch-metrics.ts", () => {
    it("BillingStatsResponse includes monthlyGrowth array", () => {
      expect(fetchMetrics).toMatch(/interface BillingStatsResponse[\s\S]*?monthlyGrowth:/);
    });

    it("BillingStatsResponse includes weeklyGrowth array", () => {
      expect(fetchMetrics).toMatch(/interface BillingStatsResponse[\s\S]*?weeklyGrowth:/);
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
    it("Monthly Growth table has Credits Spent and Revenue columns", () => {
      expect(page).toContain("Credits Spent");
      expect(page).toContain("Revenue");
    });

    it("has a Weekly Growth section", () => {
      expect(page).toContain("Weekly Growth");
    });

    it("Weekly Growth table has period, Credits Loaded, Credits Spent, Revenue columns", () => {
      // The weekly table should render billing growth columns
      // We check for the section + column headers existing in the page
      const weeklySection = page.slice(page.indexOf("Weekly Growth"));
      expect(weeklySection).toContain("Credits Loaded");
      expect(weeklySection).toContain("Credits Spent");
      expect(weeklySection).toContain("Revenue");
    });
  });
});
