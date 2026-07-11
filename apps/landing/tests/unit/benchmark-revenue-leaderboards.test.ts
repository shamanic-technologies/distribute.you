import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const tablePath = path.resolve(
  __dirname,
  "../../src/components/performance/leaderboard-table.tsx",
);
const typePath = path.resolve(
  __dirname,
  "../../src/lib/performance/fetch-leaderboard.ts",
);
const pagePath = path.resolve(
  __dirname,
  "../../src/app/benchmarks/page.tsx",
);

const tableContent = fs.readFileSync(tablePath, "utf-8");
const typeContent = fs.readFileSync(typePath, "utf-8");
const pageContent = fs.readFileSync(pagePath, "utf-8");

describe("benchmark revenue leaderboards", () => {
  it("threads expected revenue and ROI through workflow leaderboard rows", () => {
    expect(typeContent).toContain("expectedRevenueUsd: number | null");
    expect(typeContent).toContain("roiMultiple: number | null");
    expect(tableContent.match(/Expected revenue/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(tableContent.match(/sortKey=\"roiMultiple\"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(tableContent).toContain("formatRevenueUsd(wf.expectedRevenueUsd)");
    expect(tableContent).toContain("formatRoi(wf.roiMultiple)");
  });

  // NOTE: the benchmark-level revenue/ROI totals were removed when /benchmarks
  // was repurposed into the cost-per-outcome overview (funnel + outcome cards).
  // The workflow leaderboard component + types above still power /performance.
});
