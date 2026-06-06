import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  closesPerBudgetUsd,
  costPerCloseUsd,
  projectSales,
  salesUnitCostsUsd,
  METRIC_COST_PER_POSITIVE_REPLY,
  METRIC_COST_PER_CLICK,
  type SalesEcon,
} from "../src/lib/sales-funnel-economics";

// Round-trip economics for the sales-cold-email campaign-create funnel.
// meeting-booked SUMS the reply route + the click route (the same budget funds both);
// self-serve is clicks-only; the unified ROI comparator is cost-per-close.

const econ: SalesEcon = {
  ltv: 4000,
  r2m: 0.4, // positive reply → meeting
  v2m: 0.2, // website visit → meeting
  m2c: 0.25, // meeting → close
  v2c: 0.05, // website visit → close (self-serve)
};

// $/click and $/positive-reply are stored in CENTS.
const both = { [METRIC_COST_PER_CLICK]: 1500, [METRIC_COST_PER_POSITIVE_REPLY]: 3000 }; // $15 / $30
const clickOnly = { [METRIC_COST_PER_CLICK]: 1500, [METRIC_COST_PER_POSITIVE_REPLY]: null };
const replyOnly = { [METRIC_COST_PER_CLICK]: null, [METRIC_COST_PER_POSITIVE_REPLY]: 3000 };
const neither = { [METRIC_COST_PER_CLICK]: null, [METRIC_COST_PER_POSITIVE_REPLY]: null };

describe("salesUnitCostsUsd", () => {
  it("converts populated cents to USD, nulls the absent/zero ones", () => {
    expect(salesUnitCostsUsd(both)).toEqual({ replyUsd: 30, clickUsd: 15 });
    expect(salesUnitCostsUsd(clickOnly)).toEqual({ replyUsd: null, clickUsd: 15 });
    expect(salesUnitCostsUsd({ [METRIC_COST_PER_CLICK]: 0 })).toEqual({ replyUsd: null, clickUsd: null });
  });
});

describe("closesPerBudgetUsd — self-serve (clicks only)", () => {
  it("uses v2c / clickUsd", () => {
    // 0.05 / 15 = 0.003333 closes per $1
    expect(closesPerBudgetUsd(both, "self-serve", econ)).toBeCloseTo(0.05 / 15, 10);
  });
  it("is 0 when there is no click cost", () => {
    expect(closesPerBudgetUsd(replyOnly, "self-serve", econ)).toBe(0);
  });
});

describe("closesPerBudgetUsd — meeting-booked (SUMS both routes)", () => {
  it("sums reply route + click route when both costs exist", () => {
    // meetings/$ = r2m/reply + v2m/click = 0.4/30 + 0.2/15 ; closes/$ = ×m2c
    const expected = (0.4 / 30 + 0.2 / 15) * 0.25;
    expect(closesPerBudgetUsd(both, "meeting-booked", econ)).toBeCloseTo(expected, 10);
  });
  it("reply-only → reply term only", () => {
    expect(closesPerBudgetUsd(replyOnly, "meeting-booked", econ)).toBeCloseTo((0.4 / 30) * 0.25, 10);
  });
  it("click-only → click term only", () => {
    expect(closesPerBudgetUsd(clickOnly, "meeting-booked", econ)).toBeCloseTo((0.2 / 15) * 0.25, 10);
  });
  it("both-cost workflow beats the same workflow with only one route (higher closes/$)", () => {
    expect(closesPerBudgetUsd(both, "meeting-booked", econ)).toBeGreaterThan(
      closesPerBudgetUsd(replyOnly, "meeting-booked", econ),
    );
    expect(closesPerBudgetUsd(both, "meeting-booked", econ)).toBeGreaterThan(
      closesPerBudgetUsd(clickOnly, "meeting-booked", econ),
    );
  });
});

describe("costPerCloseUsd", () => {
  it("is the reciprocal of closes-per-budget", () => {
    const cpb = closesPerBudgetUsd(both, "meeting-booked", econ);
    expect(costPerCloseUsd(both, "meeting-booked", econ)).toBeCloseTo(1 / cpb, 6);
  });
  it("is null when no cost is populated (→ excluded from auto-pick)", () => {
    expect(costPerCloseUsd(neither, "meeting-booked", econ)).toBeNull();
    expect(costPerCloseUsd(neither, "self-serve", econ)).toBeNull();
  });
  it("lower cost-per-close = better ROI ranking key (both < single route)", () => {
    expect(costPerCloseUsd(both, "meeting-booked", econ)!).toBeLessThan(
      costPerCloseUsd(replyOnly, "meeting-booked", econ)!,
    );
  });
});

describe("projectSales — self-serve", () => {
  it("budget → visits → closes → revenue, no meetings", () => {
    const p = projectSales(both, "self-serve", econ, 1500)!;
    expect(p.visits).toBeCloseTo(100, 6); // 1500 / 15
    expect(p.meetings).toBeNull();
    expect(p.replies).toBeNull();
    expect(p.closes).toBeCloseTo(5, 6); // 100 × 0.05
    expect(p.revenue).toBeCloseTo(20000, 6); // 5 × 4000
  });
  it("null when no click cost", () => {
    expect(projectSales(replyOnly, "self-serve", econ, 1500)).toBeNull();
  });
});

describe("projectSales — meeting-booked (summed meetings)", () => {
  it("meetings = replies×r2m + visits×v2m", () => {
    const p = projectSales(both, "meeting-booked", econ, 300)!;
    expect(p.replies).toBeCloseTo(10, 6); // 300 / 30
    expect(p.visits).toBeCloseTo(20, 6); // 300 / 15
    const expectedMeetings = 10 * 0.4 + 20 * 0.2; // 4 + 4 = 8
    expect(p.meetings).toBeCloseTo(expectedMeetings, 6);
    expect(p.closes).toBeCloseTo(expectedMeetings * 0.25, 6); // 2
    expect(p.revenue).toBeCloseTo(expectedMeetings * 0.25 * 4000, 6); // 8000
  });
  it("reply-only contributes only the reply route", () => {
    const p = projectSales(replyOnly, "meeting-booked", econ, 300)!;
    expect(p.replies).toBeCloseTo(10, 6);
    expect(p.visits).toBeNull();
    expect(p.meetings).toBeCloseTo(10 * 0.4, 6); // 4
  });
  it("null when budget is non-positive", () => {
    expect(projectSales(both, "meeting-booked", econ, 0)).toBeNull();
  });
});

// Source-substring guards on the page — tsc can't catch copy / wiring drift (#1252).
describe("campaign-create page wires the ROI funnel", () => {
  const pagePath = path.resolve(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
  );
  const page = fs.readFileSync(pagePath, "utf-8");

  it("imports the pure econ helpers from the lib", () => {
    expect(page).toContain("projectSales");
    expect(page).toContain("costPerCloseUsd");
    expect(page).toContain("sales-funnel-economics");
  });

  it("label shows both unit costs (positive reply + website visit) when populated", () => {
    expect(page).toContain("positive reply");
    expect(page).toContain("website visit");
  });

  it("activates the website-visit→meeting input in the projection (no longer dead)", () => {
    expect(page).toContain("econVisitToMeeting");
  });

  it("auto-pick + modal rank on the ROI comparator, not a single hardcoded metric", () => {
    expect(page).toContain("costPerCloseUsd");
    // the old hardcoded single-metric pick constant is gone
    expect(page).not.toContain("SALES_PICK_METRIC");
  });
});
