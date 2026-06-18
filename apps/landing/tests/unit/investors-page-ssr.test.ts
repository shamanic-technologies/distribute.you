import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(__dirname, "../../src/app/investors/page.tsx");
const dataSectionsPath = path.resolve(
  __dirname,
  "../../src/components/investors/data-sections.tsx"
);
const skeletonsPath = path.resolve(
  __dirname,
  "../../src/components/investors/skeletons.tsx"
);

// The investor metrics must render SSR-sync so AI scrapers (GPTBot, ClaudeBot,
// PerplexityBot) — which parse raw HTML only and do not resolve streamed
// <Suspense> content — index the real numbers, not a skeleton. (CLAUDE.md
// "Public marketing pages — no <Suspense> on indexable content".)
describe("Investors page: SSR-sync (scrapable, no Suspense)", () => {
  describe("page.tsx", () => {
    const page = fs.readFileSync(pagePath, "utf-8");

    it("does NOT import Suspense from react", () => {
      expect(page).not.toMatch(/import.*Suspense.*from\s+["']react["']/);
    });

    it("does NOT wrap data sections in <Suspense>", () => {
      expect(page).not.toMatch(/<Suspense/);
    });

    it("does NOT import skeleton fallbacks", () => {
      expect(page).not.toMatch(/investors\/skeletons/);
    });

    it("renders each metric section directly (SSR-sync)", () => {
      expect(page).toMatch(/<CompanyOverviewSection\s*\/>/);
      expect(page).toMatch(/<PlatformMetricsSection\s*\/>/);
      expect(page).toMatch(/<RevenueCreditsSection\s*\/>/);
      expect(page).toMatch(/<MonthlyGrowthSection\s*\/>/);
      expect(page).toMatch(/<WeeklyGrowthSection\s*\/>/);
    });

    it("imports the async data sections", () => {
      expect(page).toMatch(/from\s+["']@\/components\/investors\/data-sections["']/);
    });
  });

  describe("data-sections.tsx", () => {
    const dataSections = fs.readFileSync(dataSectionsPath, "utf-8");

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

    it("fails soft to zero metrics so a build-time fetch error never aborts the prerender", () => {
      expect(dataSections).toMatch(/try\s*\{/);
      expect(dataSections).toMatch(/catch/);
      expect(dataSections).toMatch(/EMPTY_INVESTOR_METRICS/);
    });
  });

  it("removed the dead skeleton module", () => {
    expect(fs.existsSync(skeletonsPath)).toBe(false);
  });
});
