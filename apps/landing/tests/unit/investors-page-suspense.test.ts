import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../../src/app/investors/page.tsx"
);
const skeletonsPath = path.resolve(
  __dirname,
  "../../src/components/investors/skeletons.tsx"
);
const dataSectionsPath = path.resolve(
  __dirname,
  "../../src/components/investors/data-sections.tsx"
);

describe("Investors page: Suspense + skeleton loaders", () => {
  describe("page.tsx", () => {
    const page = fs.readFileSync(pagePath, "utf-8");

    it("default export is NOT async (shell renders instantly)", () => {
      expect(page).not.toMatch(/export default async function InvestorsPage/);
      expect(page).toMatch(/export default function InvestorsPage/);
    });

    it("does NOT await fetchInvestorMetrics at top-level", () => {
      expect(page).not.toMatch(/await fetchInvestorMetrics/);
    });

    it("imports Suspense from react", () => {
      expect(page).toMatch(/import.*Suspense.*from\s+["']react["']/);
    });

    it("wraps data sections in <Suspense fallback=", () => {
      expect(page).toMatch(/<Suspense\s+fallback=/);
    });

    it("imports skeleton fallbacks", () => {
      expect(page).toMatch(/from\s+["']@\/components\/investors\/skeletons["']/);
    });

    it("imports async data sections", () => {
      expect(page).toMatch(/from\s+["']@\/components\/investors\/data-sections["']/);
    });
  });

  describe("skeletons.tsx", () => {
    it("file exists", () => {
      expect(fs.existsSync(skeletonsPath)).toBe(true);
    });

    const skeletons = fs.existsSync(skeletonsPath)
      ? fs.readFileSync(skeletonsPath, "utf-8")
      : "";

    it("exports skeleton for each data section", () => {
      expect(skeletons).toMatch(/export function CompanyOverviewSkeleton/);
      expect(skeletons).toMatch(/export function PlatformMetricsSkeleton/);
      expect(skeletons).toMatch(/export function RevenueCreditsSkeleton/);
      expect(skeletons).toMatch(/export function MonthlyGrowthSkeleton/);
      expect(skeletons).toMatch(/export function WeeklyGrowthSkeleton/);
    });

    it("uses animate-pulse for shimmer effect", () => {
      expect(skeletons).toMatch(/animate-pulse/);
    });
  });

  describe("data-sections.tsx", () => {
    it("file exists", () => {
      expect(fs.existsSync(dataSectionsPath)).toBe(true);
    });

    const dataSections = fs.existsSync(dataSectionsPath)
      ? fs.readFileSync(dataSectionsPath, "utf-8")
      : "";

    it("exports async section components", () => {
      expect(dataSections).toMatch(/export async function CompanyOverviewSection/);
      expect(dataSections).toMatch(/export async function PlatformMetricsSection/);
      expect(dataSections).toMatch(/export async function RevenueCreditsSection/);
      expect(dataSections).toMatch(/export async function MonthlyGrowthSection/);
      expect(dataSections).toMatch(/export async function WeeklyGrowthSection/);
    });

    it("uses cached fetcher to dedupe parallel section fetches", () => {
      expect(dataSections).toMatch(/import.*cache.*from\s+["']react["']/);
    });
  });
});
